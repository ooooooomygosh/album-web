/**
 * check-prod-smoke.mjs — 生产站点落地冒烟：加载首页，捕获 console.error / pageerror，确认应用挂载。
 */
import { chromium } from 'playwright';

const URL = process.env.PROD_URL || 'https://album-circle.vercel.app/';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text();
    if (/favicon|net::ERR|Failed to load resource/i.test(t)) return;
    errors.push(t.slice(0, 200));
  }
});
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(3000);

const mounted = await page.evaluate(() => ({
  hasEmailInput: !!document.querySelector('input[type="email"]'),
  buttons: document.querySelectorAll('button').length,
  bodyText: (document.body.innerText || '').trim().length
}));

console.log('mounted:', mounted);
console.log('console/page errors:', errors.length);
errors.slice(0, 10).forEach((e) => console.log('  -', e));
await browser.close();
console.log(errors.length === 0 && mounted.buttons > 0 ? 'SMOKE_OK' : 'SMOKE_FAIL');
process.exit(errors.length === 0 && mounted.buttons > 0 ? 0 : 1);
