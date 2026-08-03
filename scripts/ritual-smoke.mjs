import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:5173';
const OUT = 'tmp/ritual';
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const shots = [];
const logs = [];

const loginRes = await fetch(`${BASE}/api/auth`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'login', email: 'audit@example.com', password: 'audit123' })
});
const loginData = await loginRes.json();
if (!loginData.token) throw new Error(`login failed: ${JSON.stringify(loginData).slice(0, 200)}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') {
    const text = m.text().slice(0, 500);
    logs.push(`console.error: ${text}`);
    problems.push(`console.error: ${text.slice(0, 240)}`);
  }
});
page.on('pageerror', (e) => {
  const text = String(e).slice(0, 500);
  logs.push(`pageerror: ${text}`);
  problems.push(`pageerror: ${text.slice(0, 240)}`);
});

const shot = async (name, wait = 700) => {
  await page.waitForTimeout(wait);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  shots.push(file);
};

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate((data) => {
  localStorage.setItem('album-circle-session', JSON.stringify(data));
}, { token: loginData.token, user: loginData.user });

await page.goto(`${BASE}/?room=audit-room`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: '我的', exact: true }).first().click();
await page.waitForTimeout(1200);

const entry = page.getByRole('button', { name: /开始灵魂仪式/ });
await entry.waitFor({ timeout: 15000 });
await entry.scrollIntoViewIfNeeded();
await shot('01-entry');

await entry.click();
await shot('02-summon', 900);

await page.waitForSelector('.ritual-choice, .ac-range', { timeout: 60000 });
await shot('03-question-1', 900);

const answerCurrent = async (index) => {
  const choices = page.locator('.ritual-choice');
  const count = await choices.count();
  if (count > 0) {
    await choices.nth(index % count).click();
    return 'choice';
  }
  const range = page.locator('input.ac-range[type="range"]').last();
  if (await range.count()) {
    await range.fill('78');
    await page.getByRole('button', { name: /就这个位置/ }).click();
    return 'dial';
  }
  const input = page.locator('.ritual-veil input.ac-input');
  if (await input.count()) {
    await input.fill('退潮');
    await page.getByRole('button', { name: /落笔/ }).click();
    return 'word';
  }
  return 'unknown';
};

const kinds = [];
for (let step = 0; step < 4; step += 1) {
  const stillQuiz = await page.locator('.ritual-veil').count();
  if (!stillQuiz) break;
  const weaving = await page.getByText('牌面正在重排').count();
  if (weaving) break;
  const kind = await answerCurrent(step);
  kinds.push(kind);
  await page.waitForTimeout(900);
  if (step < 3) await shot(`04-question-${step + 2}`, 500);
}
if (!kinds.includes('dial')) problems.push('滑块题没有被渲染或未命中');
if (!kinds.includes('word')) problems.push('写词题没有被渲染或未命中');

await shot('05-weaving', 1200);

await page.waitForSelector('.soul-card', { timeout: 300000 });
await shot('06-reveal', 2200);

const starmapNodes = await page.locator('.soul-starmap-node').count();
if (starmapNodes < 3) problems.push(`星图节点太少：${starmapNodes}`);
const cardTitle = await page.locator('.soul-card h3').first().innerText().catch(() => '');
if (!cardTitle.trim()) problems.push('灵魂卡标题为空');

await page.getByRole('button', { name: /生成分享卡/ }).click();
await page.waitForSelector('img[alt="音乐灵魂卡预览"]', { timeout: 20000 });
await shot('07-share', 1200);
const shareSize = await page.locator('img[alt="音乐灵魂卡预览"]').evaluate((el) => el.naturalWidth);
if (shareSize < 500) problems.push(`分享卡画布异常：naturalWidth=${shareSize}`);
await page.getByRole('button', { name: '关闭' }).click();
await page.waitForTimeout(400);

await page.getByRole('button', { name: /看完整侧写/ }).click();
await page.waitForTimeout(1600);
await shot('08-report-top', 900);
const reportCard = await page.locator('#persona-report .soul-card').count();
if (!reportCard) problems.push('完整报告里缺少灵魂卡');
const emotionBars = await page.locator('#persona-report .emotion-bar-fill').count();
if (emotionBars < 4) problems.push(`报告里情绪光谱条太少：${emotionBars}`);

await page.locator('#persona-report').screenshot({ path: `${OUT}/09-report-full.png` });
shots.push(`${OUT}/09-report-full.png`);

const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
mpage.on('pageerror', (e) => logs.push(`mobile pageerror: ${String(e).slice(0, 500)}`));
await mpage.goto(BASE, { waitUntil: 'domcontentloaded' });
await mpage.evaluate((data) => {
  localStorage.setItem('album-circle-session', JSON.stringify(data));
}, { token: loginData.token, user: loginData.user });
await mpage.goto(`${BASE}/?room=audit-room`, { waitUntil: 'networkidle' });
await mpage.waitForTimeout(1500);
await mpage.getByRole('button', { name: '我的', exact: true }).first().click();
await mpage.waitForTimeout(1200);
const mEntry = mpage.getByRole('button', { name: /开始灵魂仪式/ });
await mEntry.scrollIntoViewIfNeeded();
await mEntry.click();
await mpage.waitForSelector('.ritual-choice', { timeout: 60000 });
await mpage.waitForTimeout(900);
await mpage.screenshot({ path: `${OUT}/10-mobile-question.png` });
shots.push(`${OUT}/10-mobile-question.png`);

await browser.close();

console.log('kinds answered:', kinds.join(', '));
console.log('shots:', shots.join('\n  '));
if (logs.length) {
  console.log('\nLOGS:');
  logs.forEach((l) => console.log(' -', l));
}
if (problems.length) {
  console.log('\nPROBLEMS:');
  problems.forEach((p) => console.log(' -', p));
  process.exit(1);
}
console.log('\nRITUAL SMOKE OK');