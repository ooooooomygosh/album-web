/**
 * check-detail-render.mjs
 * 严格验证“进入房间后点击封面能真正进入详情页（视图渲染，而非仅 URL 变化）”。
 * 覆盖子代理验收清单：
 *  1) cabinet 点封面 → 详情页渲染（标题匹配、陈列柜网格消失、URL 含 item=）
 *  2) 浏览器后退 → 回详情（popstate 路径未被破坏）
 *  3) 详情页返回展柜 → cabinet 重新出现
 */
import { chromium } from 'playwright';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:5173';

const loginRes = await fetch(`${BASE}/api/auth`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'login', email: 'audit@example.com', password: 'audit123' })
});
const loginData = await loginRes.json();
if (!loginData.token) { console.error('登录失败', loginData); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 240)));
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text();
    if (/favicon|net::ERR|Failed to load resource/i.test(t)) return;
    errors.push('[console.error] ' + t.slice(0, 240));
  }
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate((d) => localStorage.setItem('album-circle-session', JSON.stringify(d)), {
  token: loginData.token,
  user: loginData.user
});
await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

// 读第一个封面标题（来自 aria-label: “打开 {artist} 的 {title} 详情”）
const firstTile = page.locator('[data-tile]').first();
await firstTile.scrollIntoViewIfNeeded();
const aria = await firstTile.getAttribute('aria-label');
const mm = aria && aria.match(/的\s+(.+?)\s+详情/);
const clickedTitle = mm ? mm[1] : null;
const tileCountBefore = await page.locator('[data-tile]').count();
console.log(`点击前: 封面数=${tileCountBefore}, aria="${aria}", 解析标题="${clickedTitle}"`);

await firstTile.click({ timeout: 6000 });
await page.waitForTimeout(1600);

const after = await page.evaluate(() => {
  const h2 = document.querySelector('h2.ac-h1');
  const cabinetList = document.querySelector('[role="list"][aria-label="专辑陈列柜"]');
  return {
    url: location.search,
    detailTitle: h2 ? h2.textContent.trim() : null,
    hasDetailHeading: !!h2,
    cabinetListGone: !cabinetList
  };
});
console.log('点击后:', after);

const urlHasItem = after.url.includes('item=');
const titleMatches = !!clickedTitle && !!after.detailTitle && after.detailTitle.includes(clickedTitle);
const cabinetGone = after.cabinetListGone;
console.log(`断言: urlHasItem=${urlHasItem} titleMatches=${titleMatches} cabinetGone=${cabinetGone}`);

// 浏览器后退 → 回详情（popstate 路径）
await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1200);
const afterBack = await page.evaluate(() => ({
  url: location.search,
  detailTitle: (document.querySelector('h2.ac-h1') || {}).textContent || null,
  cabinetTiles: document.querySelectorAll('[data-tile]').length
}));
console.log('后退后:', afterBack);

// 重新前进到详情（详情内返回展柜）
await page.goForward({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1200);
const afterFwd = await page.evaluate(() => ({
  url: location.search,
  hasDetail: !!document.querySelector('h2.ac-h1')
}));
console.log('前进后:', afterFwd);

// 后退应回到展柜（pushState 语义正确），前进应回到详情页
const backToCabinet = !afterBack.url.includes('item=') && afterBack.cabinetTiles > 0;
const pass =
  urlHasItem &&
  titleMatches &&
  cabinetGone &&
  backToCabinet &&
  afterFwd.hasDetail &&
  errors.length === 0;

if (errors.length) { console.log('运行期错误:\n' + errors.join('\n')); }
console.log(pass ? 'DETAIL_RENDER_OK ✅ 点击封面真正进入详情页' : 'DETAIL_RENDER_FAIL ❌');
await browser.close();
process.exit(pass ? 0 : 1);
