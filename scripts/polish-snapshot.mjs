// Lightweight visual capture for the polish layer.
import { chromium } from 'playwright';

const URL = process.env.SCREEN_URL || 'http://localhost:4173/';
const OUT = process.env.SCREEN_OUT || 'artifacts/polish-visual.png';

async function shoot() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  // wait for hydration
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  // try to register a throwaway account
  const email = `polish_${Date.now()}@album.local`;
  await page.fill('input[type="email"], input[name="email"]', email).catch(() => null);
  await page.fill('input[type="password"], input[name="password"]', 'PolishTest!9').catch(() => null);
  const submit = await page.$('button[type="submit"]');
  if (submit) await submit.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT, fullPage: false });
  console.log('saved', OUT);
  await browser.close();
}

shoot().catch((err) => {
  console.error(err);
  process.exit(1);
});