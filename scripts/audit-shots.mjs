import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE || 'http://localhost:5173';
const OUT = 'tmp/audit';
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-small-320', width: 320, height: 640 }
];

const consoleIssues = [];

const browser = await chromium.launch();
for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.width < 800,
    hasTouch: vp.width < 800
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      consoleIssues.push({ vp: vp.name, type: m.type(), text: m.text().slice(0, 300) });
    }
  });
  page.on('pageerror', (e) => consoleIssues.push({ vp: vp.name, type: 'pageerror', text: String(e).slice(0, 300) }));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${vp.name}.png`, fullPage: false });

  // 横向溢出检测
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    const offenders = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > de.clientWidth + 2 || r.left < -2)) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 70),
          right: Math.round(r.right),
          left: Math.round(r.left)
        });
      }
    });
    return {
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      offenders: offenders.slice(0, 12)
    };
  });

  // 触控目标尺寸检测
  const smallTargets = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a, [role="button"], input, select').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 60),
          text: (el.textContent || '').trim().slice(0, 30),
          w: Math.round(r.width),
          h: Math.round(r.height)
        });
      }
    });
    return out.slice(0, 20);
  });

  fs.writeFileSync(`${OUT}/${vp.name}.json`, JSON.stringify({ overflow, smallTargets }, null, 2));
  console.log(`[${vp.name}] scrollW=${overflow.scrollW} clientW=${overflow.clientW} overflowEls=${overflow.offenders.length} smallTargets=${smallTargets.length}`);
  await ctx.close();
}

// 可访问性/语义快照（桌面）
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(2000);

const a11y = await page.evaluate(() => {
  const q = (s) => Array.from(document.querySelectorAll(s));
  return {
    landmarks: {
      header: q('header').length,
      nav: q('nav').length,
      main: q('main').length,
      footer: q('footer').length,
      section: q('section').length
    },
    headings: q('h1,h2,h3,h4,h5,h6').map((h) => `${h.tagName}: ${(h.textContent || '').trim().slice(0, 45)}`).slice(0, 25),
    imgNoAlt: q('img').filter((i) => !i.hasAttribute('alt')).length,
    imgTotal: q('img').length,
    imgNoLazy: q('img').filter((i) => i.loading !== 'lazy').length,
    btnNoLabel: q('button').filter((b) => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
    btnTotal: q('button').length,
    inputNoLabel: q('input,select,textarea').filter((i) => {
      if (i.type === 'hidden') return false;
      const id = i.id;
      return !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby') && !(id && document.querySelector(`label[for="${id}"]`)) && !i.closest('label');
    }).length,
    inputTotal: q('input,select,textarea').length,
    ariaLiveRegions: q('[aria-live]').length,
    skipLink: q('a[href^="#"]').filter((a) => /skip|跳过|主要内容/i.test(a.textContent || '')).length,
    focusVisibleRules: 'see css',
    docLang: document.documentElement.lang,
    title: document.title
  };
});

const perf = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const res = performance.getEntriesByType('resource');
  const byType = {};
  res.forEach((r) => {
    const t = r.initiatorType || 'other';
    byType[t] = byType[t] || { count: 0, bytes: 0 };
    byType[t].count += 1;
    byType[t].bytes += r.transferSize || 0;
  });
  return {
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    loadEvent: Math.round(nav.loadEventEnd || 0),
    resourceCount: res.length,
    byType,
    domNodes: document.querySelectorAll('*').length
  };
});

fs.writeFileSync(`${OUT}/a11y-perf.json`, JSON.stringify({ a11y, perf, consoleIssues }, null, 2));
console.log('\n--- A11y ---');
console.log(JSON.stringify(a11y, null, 2));
console.log('\n--- Perf ---');
console.log(JSON.stringify(perf, null, 2));
console.log('\n--- Console issues:', consoleIssues.length);
consoleIssues.slice(0, 10).forEach((c) => console.log(`  [${c.vp}][${c.type}] ${c.text}`));

await browser.close();
