/**
 * check-bg.mjs — 极光背景可见性的确定性实证（隔离复现）
 * 复现 App 根结构：根 div (position:relative; background:#040507) 内含 fixed -z-10 极光色块。
 *   - 无 isolation：根 div 不形成堆叠上下文 -> 极光 -z-10 参与 html 层 -> 被根不透明背景盖住 -> HIDDEN
 *   - 加 isolation:isolate：根形成堆叠上下文 -> 极光 -z-10 落在根背景之上 -> VISIBLE
 * 用 setContent 渲染，色块放在无其它内容的角落，截图采样中心像素判定。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = process.env.AUDIT_OUT || 'tmp/verify';
fs.mkdirSync(OUT, { recursive: true });
const png = path.join(OUT, 'bg-probe.png');
const py = '/Users/yanghongming/.workbuddy/binaries/python/envs/default/bin/python';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box;}
  body{background:#060709;}
  .root{position:relative;min-height:100vh;background:#040507;}
  .root.isolate{isolation:isolate;}
  .aurora{position:fixed;inset:0;z-index:-10;pointer-events:none;}
  .blob{position:absolute;top:60px;left:60px;width:220px;height:220px;background:rgb(255,0,255);}
</style></head><body>
  <div class="root" id="root"><div class="aurora"><div class="blob"></div></div></div>
</body></html>`;

const sample = (cx, cy) => {
  const code = `from PIL import Image
im=Image.open(${JSON.stringify(png)}).convert('RGB')
px=im.getpixel((${cx},${cy}))
print('PIXEL',px)
r,g,b=px
hidden = r<30 and g<30 and b<35
vis = r>160 and g<110 and b>160
print('RESULT', 'VISIBLE_MAGENTA' if vis else ('HIDDEN_BEHIND_BG' if hidden else 'OTHER'))`;
  fs.writeFileSync(path.join(OUT, 'sample.py'), code);
  return execFileSync(py, [path.join(OUT, 'sample.py')]).toString().trim();
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: 'load' });

// 1) 无 isolate（复现回归）：应 HIDDEN
await page.evaluate(() => { document.getElementById('root').classList.remove('isolate'); });
await page.screenshot({ path: png });
console.log('[no-isolate]', sample(170, 170));

// 2) 加 isolate（修复）：应 VISIBLE
await page.evaluate(() => { document.getElementById('root').classList.add('isolate'); });
await page.waitForTimeout(50);
await page.screenshot({ path: png });
console.log('[isolate]   ', sample(170, 170));

await browser.close();
