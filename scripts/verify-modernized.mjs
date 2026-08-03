/**
 * verify-modernized.mjs
 * Tailwind + Zustand 全面重构后的运行时验收：
 *  - 多设备断点截图（5 档）
 *  - 全视图遍历（登录/大厅/展柜/详情/沉浸阅读/搜索/添加/设置/长廊）
 *  - console error / pageerror 零容忍
 *  - 横向溢出、触控目标尺寸、a11y 结构、性能指标
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:5173';
const OUT = process.env.AUDIT_OUT || 'tmp/verify';
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
  { name: 'laptop-1280', width: 1280, height: 800, mobile: false },
  { name: 'tablet-834', width: 834, height: 1112, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'mobile-320', width: 320, height: 640, mobile: true }
];

const issues = [];
const report = { viewports: {}, consoleIssues: [], summary: {} };

// ---- 登录 ----
const loginRes = await fetch(`${BASE}/api/auth`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'login', email: 'audit@example.com', password: 'audit123' })
});
const loginData = await loginRes.json();
if (!loginData.token) {
  console.error('登录失败', loginData);
  process.exit(1);
}
console.log(`✓ 登录成功 ${loginData.user.email}`);

const browser = await chromium.launch();

// ---- 先用桌面视口探测一个可用 item id ----
let probeItemId = null;
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((d) => localStorage.setItem('album-circle-session', JSON.stringify(d)), {
    token: loginData.token,
    user: loginData.user
  });
  await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  probeItemId = await page.evaluate(() => {
    const el = document.querySelector('[data-item-id]');
    return el?.getAttribute('data-item-id') || null;
  });
  await ctx.close();
}
console.log(`✓ 探测到 item id: ${probeItemId || '(无，将跳过详情页)'}`);

async function auditViewport(vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile
  });
  const page = await ctx.newPage();
  const localIssues = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const text = m.text();
      // 忽略网络层 404（本地无第三方图源）与 vite hmr 噪音
      if (/favicon|net::ERR|Failed to load resource/i.test(text)) return;
      localIssues.push({ vp: vp.name, type: 'console.error', text: text.slice(0, 260) });
    }
  });
  page.on('pageerror', (e) => localIssues.push({ vp: vp.name, type: 'pageerror', text: String(e).slice(0, 260) }));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate((d) => localStorage.setItem('album-circle-session', JSON.stringify(d)), {
    token: loginData.token,
    user: loginData.user
  });

  const shot = async (suffix, wait = 1200) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-${suffix}.png`), fullPage: false });
  };

  const probe = async (label) => {
    const data = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > de.clientWidth + 2 || r.left < -2)) {
          const style = window.getComputedStyle(el);
          const isDecorative =
            (style.pointerEvents === 'none' && Number(style.zIndex) < 0) ||
            el.getAttribute('aria-hidden') === 'true' ||
            el.classList.contains('fixed') && Number(style.zIndex) < 10;
          overflow.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 60),
            right: Math.round(r.right),
            decorative: isDecorative
          });
        }
      });
      const small = [];
      document.querySelectorAll('button, a[href], [role="button"], input, select').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32)) {
          small.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24),
            w: Math.round(r.width),
            h: Math.round(r.height)
          });
        }
      });
      return {
        scrollW: de.scrollWidth,
        clientW: de.clientWidth,
        hOverflow: de.scrollWidth > de.clientWidth + 2 && overflow.some((o) => !o.decorative),
        overflowEls: overflow.slice(0, 8),
        smallTargets: small.slice(0, 10),
        smallTargetCount: small.length,
        blankScreen: (document.body.innerText || '').trim().length < 20,
        rootIsolate: !!document.querySelector('div.min-h-screen')?.classList.contains('isolate'),
        auroraPresent: !!document.querySelector('[data-aurora]'),
        invisibleTiles: (() => {
          let n = 0; const samples = [];
          document.querySelectorAll('[data-tile]').forEach((t) => {
            const reveal = t.closest('.tile-reveal') || t;
            const op = parseFloat(getComputedStyle(reveal).opacity || '1');
            if (op < 0.5) { n++; if (samples.length < 6) samples.push({ id: t.getAttribute('data-item-id'), op: Math.round(op * 100) / 100 }); }
          });
          return { count: n, total: document.querySelectorAll('[data-tile]').length, samples };
        })()
      };
    });
    return { label, ...data };
  };

  const probes = [];

  // 1) 大厅
  await page.goto(`${BASE}/?room=`, { waitUntil: 'networkidle' });
  await shot('01-lobby', 1600);
  probes.push(await probe('lobby'));

  // 2) 展柜
  await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
  await shot('02-cabinet', 2600);
  probes.push(await probe('cabinet'));

  // 3) 详情
  if (probeItemId) {
    await page.goto(`${BASE}/?room=audit-room&item=${probeItemId}`, { waitUntil: 'networkidle' });
    await shot('03-detail', 2400);
    probes.push(await probe('detail'));

    // 3b) 沉浸阅读
    const immersiveBtn = page.locator('button', { hasText: '沉浸阅读' }).filter({ visible: true }).first();
    if (await immersiveBtn.count()) {
      await immersiveBtn.scrollIntoViewIfNeeded();
      await immersiveBtn.click({ timeout: 3000 });
      const overlay = page.locator('div[role="dialog"][aria-label$="沉浸阅读"]').first();
      await overlay.waitFor({ state: 'visible', timeout: 3000 });
      await shot('04-immersive', 1200);
      probes.push(await probe('immersive'));
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  // 4) 添加音乐
  await page.goto(`${BASE}/?room=audit-room&add=1`, { waitUntil: 'networkidle' });
  await shot('05-add', 1800);
  probes.push(await probe('add'));

  // 5) 设置 / 个人页
  await page.goto(`${BASE}/?settings=1`, { waitUntil: 'networkidle' });
  await shot('06-settings', 1600);
  probes.push(await probe('settings'));

  // 6) 封面长廊（3D）—— 点击顶部品牌按钮打开
  await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const corridorOpened = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="打开隐藏封面长廊"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (corridorOpened) {
    await shot('07-corridor', 2200);
    probes.push(await probe('corridor'));
    await page.keyboard.press('Escape').catch(() => {});
  }

  // a11y & perf（仅桌面）
  let a11y = null;
  let perf = null;
  if (vp.width === 1440) {
    await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    a11y = await page.evaluate(() => {
      const q = (s) => Array.from(document.querySelectorAll(s));
      return {
        landmarks: { header: q('header').length, nav: q('nav').length, main: q('main').length, aside: q('aside').length },
        headingOrder: q('h1,h2,h3').map((h) => h.tagName).slice(0, 20),
        imgTotal: q('img').length,
        imgNoAlt: q('img').filter((i) => !i.hasAttribute('alt')).length,
        btnTotal: q('button').length,
        btnNoLabel: q('button').filter((b) => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
        inputTotal: q('input,select,textarea').length,
        inputNoLabel: q('input,select,textarea').filter((i) => {
          if (i.type === 'hidden') return false;
          return !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')
            && !(i.id && document.querySelector(`label[for="${i.id}"]`)) && !i.closest('label');
        }).length,
        ariaLive: q('[aria-live]').length,
        skipLink: q('.skip-link, a[href="#main-content"]').length,
        docLang: document.documentElement.lang || '(missing)',
        title: document.title
      };
    });
    perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const res = performance.getEntriesByType('resource');
      let cssBytes = 0; let jsBytes = 0;
      res.forEach((r) => {
        if (r.name.endsWith('.css') || r.initiatorType === 'link') cssBytes += r.transferSize || 0;
        if (/\.m?js/.test(r.name) || r.initiatorType === 'script') jsBytes += r.transferSize || 0;
      });
      return {
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
        loadEvent: Math.round(nav.loadEventEnd || 0),
        domNodes: document.querySelectorAll('*').length,
        resourceCount: res.length,
        cssBytes, jsBytes,
        styleSheets: document.styleSheets.length,
        cssRules: [...document.styleSheets].reduce((n, s) => {
          try { return n + s.cssRules.length; } catch { return n; }
        }, 0)
      };
    });
  }

  issues.push(...localIssues);
  report.viewports[vp.name] = { probes, a11y, perf, consoleIssues: localIssues };

  const badOverflow = probes.filter((p) => p.hOverflow);
  const blanks = probes.filter((p) => p.blankScreen);
  const invis = probes.filter((p) => p.invisibleTiles && p.invisibleTiles.count > 0);
  console.log(
    `[${vp.name}] views=${probes.length} overflow=${badOverflow.length ? badOverflow.map((p) => p.label).join(',') : '0'} `
    + `blank=${blanks.length ? blanks.map((p) => p.label).join(',') : '0'} `
    + `invisTiles=${invis.length ? invis.map((p) => `${p.label}:${p.invisibleTiles.count}/${p.invisibleTiles.total}`).join(',') : '0'} errors=${localIssues.length}`
  );
  await ctx.close();
}

for (const vp of viewports) await auditViewport(vp);
await browser.close();

report.consoleIssues = issues;
report.summary = {
  totalConsoleIssues: issues.length,
  overflowViews: Object.entries(report.viewports).flatMap(([vp, d]) =>
    d.probes.filter((p) => p.hOverflow).map((p) => `${vp}/${p.label}`)),
  blankViews: Object.entries(report.viewports).flatMap(([vp, d]) =>
    d.probes.filter((p) => p.blankScreen).map((p) => `${vp}/${p.label}`)),
  invisibleTileViews: Object.entries(report.viewports).flatMap(([vp, d]) =>
    d.probes.filter((p) => p.invisibleTiles && p.invisibleTiles.count > 0).map((p) => `${vp}/${p.label}:${p.invisibleTiles.count}/${p.invisibleTiles.total}`))
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log('\n════════ 汇总 ════════');
console.log('console/page errors :', issues.length);
issues.slice(0, 20).forEach((i) => console.log(`  [${i.vp}][${i.type}] ${i.text}`));
console.log('横向溢出视图        :', report.summary.overflowViews.join(', ') || '无');
console.log('空白视图            :', report.summary.blankViews.join(', ') || '无');
console.log('不可见瓦片视图      :', report.summary.invisibleTileViews.join(', ') || '无');
const d = report.viewports['desktop-1440'];
if (d?.a11y) console.log('a11y                :', JSON.stringify(d.a11y));
if (d?.perf) console.log('perf                :', JSON.stringify(d.perf));
console.log(`截图输出            : ${OUT}/`);
process.exit(issues.length ? 1 : 0);
