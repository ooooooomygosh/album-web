import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE || 'https://album-circle.vercel.app';
const OUT = process.env.AUDIT_OUT || 'tmp/verify-prod';
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
  { name: 'mobile-390', width: 390, height: 844, mobile: true }
];

const browser = await chromium.launch();
const issues = [];

for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') issues.push({ vp: vp.name, text: m.text().slice(0, 260) });
  });
  page.on('pageerror', (e) => issues.push({ vp: vp.name, text: String(e).slice(0, 260) }));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${vp.name}-landing.png`, fullPage: false });
  console.log(`[${vp.name}] landed, title: ${await page.title()}`);
  await ctx.close();
}

await browser.close();
console.log('\nProduction landing issues:', issues.length);
issues.forEach((i) => console.log(`  [${i.vp}] ${i.text}`));
process.exit(issues.length ? 1 : 0);
