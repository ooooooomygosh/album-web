/**
 * check-click.mjs — 验证点击展柜封面能打开详情页（覆盖“封面点不进去”的回归）。
 */
import { chromium } from 'playwright';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:5173';
const loginRes = await fetch(`${BASE}/api/auth`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'login', email: 'audit@example.com', password: 'audit123' })
});
const loginData = await loginRes.json();
if (!loginData.token) { console.error('登录失败', loginData); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate((d) => localStorage.setItem('album-circle-session', JSON.stringify(d)), { token: loginData.token, user: loginData.user });
await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const before = await page.evaluate(() => ({
  tiles: document.querySelectorAll('[data-tile]').length,
  hasItem: !!document.querySelector('[data-item-id]'),
  url: location.search
}));
console.log('before click:', before);

// 点击第一个可见封面
const tile = page.locator('[data-tile]').first();
await tile.scrollIntoViewIfNeeded();
await tile.click({ timeout: 5000 });
await page.waitForTimeout(1500);

const after = await page.evaluate(() => {
  const detailBtn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').includes('沉浸阅读'));
  return {
    url: location.search,
    hasItem: !!document.querySelector('[data-item-id]'),
    detailBtnVisible: !!(detailBtn && detailBtn.offsetParent !== null),
    reviewText: (document.body.innerText || '').includes('评论') || (document.body.innerText || '').includes('沉浸')
  };
});
console.log('after click :', after);

const ok = after.hasItem && (after.url.includes('item=') || after.detailBtnVisible);
console.log(ok ? 'CLICK_OK: 封面点击成功打开详情' : 'CLICK_FAIL: 点击未打开详情');
await browser.close();
process.exit(ok ? 0 : 1);
