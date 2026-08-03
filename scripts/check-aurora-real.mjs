/**
 * check-aurora-real.mjs — 在真实运行的应用里像素级验证极光可见性。
 * 做法：登录进展柜 -> 隐藏 main/header/nav（仅留根背景与极光）-> 把极光首块强制洋红 ->
 * 截图采样该块中心像素。洋红=极光绘制在根背景之上（修复后预期）；深色=被根背景盖住（回归）。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:5173';
const OUT = process.env.AUDIT_OUT || 'tmp/verify';
fs.mkdirSync(OUT, { recursive: true });
const png = path.join(OUT, 'aurora-real.png');
const py = '/Users/yanghongming/.workbuddy/binaries/python/envs/default/bin/python';

const loginRes = await fetch(`${BASE}/api/auth`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'login', email: 'audit@example.com', password: 'audit123' })
});
const loginData = await loginRes.json();
if (!loginData.token) { console.error('登录失败', loginData); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate((d) => localStorage.setItem('album-circle-session', JSON.stringify(d)), { token: loginData.token, user: loginData.user });
await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const root = document.querySelector('div.min-h-screen');
  const aurora = document.querySelector('[data-aurora]');
  const blob = aurora?.querySelector('div');
  // 隐藏主内容，仅留根背景与极光
  ['main', 'header', 'nav'].forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });
  });
  if (blob) blob.style.cssText = 'position:absolute;top:300px;left:300px;width:240px;height:240px;background:rgb(255,0,255);opacity:1;filter:none;mix-blend-mode:normal;';
  const r = blob?.getBoundingClientRect();
  return {
    rootIsolate: !!root?.classList.contains('isolate'),
    auroraPresent: !!aurora,
    cx: r ? Math.round(r.left + r.width / 2) : null,
    cy: r ? Math.round(r.top + r.height / 2) : null
  };
});
console.log('root.isolate =', info.rootIsolate, '| aurora present =', info.auroraPresent);
if (info.cx == null) { console.log('BLOB_MISSING'); await browser.close(); process.exit(1); }

await page.waitForTimeout(120);
await page.screenshot({ path: png });
await browser.close();

const code = `from PIL import Image
im=Image.open(${JSON.stringify(png)}).convert('RGB')
px=im.getpixel((${info.cx},${info.cy}))
print('PIXEL',px)
r,g,b=px
vis = r>80 and b>80 and g<70
hidden = r<30 and g<30 and b<35
print('RESULT', 'VISIBLE_MAGENTA' if vis else ('HIDDEN_BEHIND_BG' if hidden else 'OTHER'))`;
fs.writeFileSync(path.join(OUT, 'sample.py'), code);
console.log(execFileSync(py, [path.join(OUT, 'sample.py')]).toString().trim());
console.log('probe center =', { x: info.cx, y: info.cy });
