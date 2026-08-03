/**
 * check-nav-robust.mjs
 * 多场景复现导航切换，覆盖用户真实操作流：
 *  - 起始态: 展柜 / 详情页
 *  - 视图端口: 桌面(1440) / 移动(390)
 *  - 流程: 进入评论 → 再点展柜（应回到陈列柜）
 * 任一场景失败即输出 FAIL 并附快照。
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
const results = [];

const snap = (page) => page.evaluate(() => {
  const reviewBox = document.querySelector('#review-comment-draft');
  const cabinetList = document.querySelector('[role="list"][aria-label="专辑陈列柜"]');
  const detailHeading = document.querySelector('h2.ac-h1');
  const reviewBtn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '评论');
  const showroomBtn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '展柜');
  const visible = (el) => !!el && el.offsetParent !== null;
  return {
    url: location.search,
    reviewVisible: visible(reviewBox),
    cabinetVisible: visible(cabinetList),
    detailVisible: visible(detailHeading),
    reviewActive: reviewBtn?.getAttribute('aria-current') === 'page',
    showroomActive: showroomBtn?.getAttribute('aria-current') === 'page',
  };
});

async function runScenario(name, viewport, startState) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 200)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((d) => localStorage.setItem('album-circle-session', JSON.stringify(d)), { token: loginData.token, user: loginData.user });
  await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  if (startState === 'detail') {
    const tile = page.locator('[data-tile]').first();
    await tile.scrollIntoViewIfNeeded();
    await tile.click({ timeout: 6000 });
    await page.waitForTimeout(1500);
  }

  const start = await snap(page);
  // 点评论
  await page.getByRole('button', { name: '评论', exact: true }).click({ timeout: 6000 });
  await page.waitForTimeout(1100);
  const afterReview = await snap(page);
  // 点展柜
  await page.getByRole('button', { name: '展柜', exact: true }).click({ timeout: 6000 });
  await page.waitForTimeout(1400);
  const afterShowroom = await snap(page);

  const reviewOpened = afterReview.reviewVisible;
  const showroomReturned = afterShowroom.cabinetVisible && afterShowroom.showroomActive && !afterShowroom.reviewVisible;
  const pass = reviewOpened && showroomReturned && errors.length === 0;
  results.push({ name, pass, start, afterReview, afterShowroom, errors });
  console.log(`\n=== ${name} ===`);
  console.log('start:', start);
  console.log('afterReview:', afterReview);
  console.log('afterShowroom:', afterShowroom);
  if (errors.length) console.log('errors:', errors.join(' | '));
  console.log(pass ? 'PASS' : 'FAIL ❌');
  await ctx.close();
}

await runScenario('桌面+展柜起步', { width: 1440, height: 900 }, 'cabinet');
await runScenario('桌面+详情起步', { width: 1440, height: 900 }, 'detail');
await runScenario('移动+展柜起步', { width: 390, height: 844 }, 'cabinet');
await runScenario('移动+详情起步', { width: 390, height: 844 }, 'detail');

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n汇总: ${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
