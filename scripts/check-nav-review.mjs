/**
 * check-nav-review.mjs
 * 复现并验证导航回归：进入房间 → 点击“评论” → 再点击“展柜”应回到陈列柜。
 * 重点观察：点击展柜后是否真的切回 cabinet（role=list 重新出现），并捕获控制台/页面错误。
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
await page.evaluate((d) => localStorage.setItem('album-circle-session', JSON.stringify(d)), { token: loginData.token, user: loginData.user });
await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

const snap = () => page.evaluate(() => {
  const reviewBox = document.querySelector('#review-comment-draft');
  const cabinetList = document.querySelector('[role="list"][aria-label="专辑陈列柜"]');
  const detailHeading = document.querySelector('h2.ac-h1');
  const reviewBtn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '评论');
  const showroomBtn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '展柜');
  return {
    url: location.search,
    reviewVisible: !!reviewBox,
    cabinetVisible: !!cabinetList,
    detailVisible: !!detailHeading,
    reviewActive: reviewBtn?.getAttribute('aria-current') === 'page',
    showroomActive: showroomBtn?.getAttribute('aria-current') === 'page',
  };
});

const start = await snap();
console.log('初始(展柜):', start);

// 1) 点击“评论”导航
const reviewNav = page.getByRole('button', { name: '评论', exact: true });
await reviewNav.click({ timeout: 6000 });
await page.waitForTimeout(1200);
const afterReview = await snap();
console.log('点击评论后:', afterReview);

// 2) 再点击“展柜”导航
const showroomNav = page.getByRole('button', { name: '展柜', exact: true });
await showroomNav.click({ timeout: 6000 });
await page.waitForTimeout(1400);
const afterShowroom = await snap();
console.log('点击展柜后:', afterShowroom);

if (errors.length) console.log('运行期错误:\n' + errors.join('\n'));

const reviewOpened = afterReview.reviewVisible && afterReview.reviewActive;
const showroomReturned = afterShowroom.cabinetVisible && afterShowroom.showroomActive && !afterShowroom.reviewVisible;
const pass = reviewOpened && showroomReturned && errors.length === 0;

console.log(`断言: reviewOpened=${reviewOpened} showroomReturned=${showroomReturned}`);
console.log(pass ? 'NAV_REVIEW_OK ✅ 评论→展柜 切换正常' : 'NAV_REVIEW_FAIL ❌ 评论→展柜 切换异常');
await browser.close();
process.exit(pass ? 0 : 1);
