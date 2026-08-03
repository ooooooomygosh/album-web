import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:5173';
const OUT = 'tmp/audit';
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
  { name: 'laptop-1280', width: 1280, height: 800, mobile: false },
  { name: 'tablet-834', width: 834, height: 1112, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'mobile-small-320', width: 320, height: 640, mobile: true }
];

const consoleIssues = [];
const browser = await chromium.launch();

// 登录拿到 token
const loginRes = await fetch(`${BASE}/api/auth`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'login', email: 'audit@example.com', password: 'audit123' })
});
const loginData = await loginRes.json();
const token = loginData.token;

async function auditViewport(vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      consoleIssues.push({ vp: vp.name, type: m.type(), text: m.text().slice(0, 300) });
    }
  });
  page.on('pageerror', (e) => consoleIssues.push({ vp: vp.name, type: 'pageerror', text: String(e).slice(0, 300) }));

  // 写入 token 实现自动登录
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(800);
  await page.evaluate((data) => { localStorage.setItem('album-circle-session', JSON.stringify(data)); }, { token, user: loginData.user });

  const shot = async (suffix, wait = 1000) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${vp.name}-${suffix}.png`, fullPage: false });
  };

  // lobby / room dashboard
  await page.goto(`${BASE}/?room=`, { waitUntil: 'networkidle' });
  await shot('lobby', 1500);

  // cabinet
  await page.goto(`${BASE}/?room=audit-room&view=cabinet`, { waitUntil: 'networkidle' });
  await shot('cabinet', 2500);

  // detail
  await page.goto(`${BASE}/?room=audit-room&item=b9dfee478c9242d1af87`, { waitUntil: 'networkidle' });
  await shot('detail', 2500);

  // search dialog
  await page.goto(`${BASE}/?room=audit-room&add=1`, { waitUntil: 'networkidle' });
  await shot('search', 2000);

  // settings
  await page.goto(`${BASE}/?settings=1`, { waitUntil: 'networkidle' });
  await shot('settings', 1500);

  // a11y/perf metrics only from desktop
  let a11y = null;
  let perf = null;
  let overflow = null;
  let smallTargets = null;

  overflow = await page.evaluate(() => {
    const de = document.documentElement;
    const offenders = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > de.clientWidth + 2 || r.left < -2)) {
        offenders.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 70), right: Math.round(r.right), left: Math.round(r.left) });
      }
    });
    return { scrollW: de.scrollWidth, clientW: de.clientWidth, offenders: offenders.slice(0, 12) };
  });

  smallTargets = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a, [role="button"], input, select').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
        out.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60), text: (el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    return out.slice(0, 20);
  });

  if (vp.width === 1440) {
    a11y = await page.evaluate(() => {
      const q = (s) => Array.from(document.querySelectorAll(s));
      return {
        landmarks: { header: q('header').length, nav: q('nav').length, main: q('main').length, footer: q('footer').length, section: q('section').length },
        headings: q('h1,h2,h3,h4,h5,h6').map((h) => `${h.tagName}: ${(h.textContent || '').trim().slice(0, 45)}`).slice(0, 30),
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
        docLang: document.documentElement.lang,
        title: document.title
      };
    });
    perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const res = performance.getEntriesByType('resource');
      const byType = {};
      res.forEach((r) => {
        const t = r.initiatorType || 'other';
        byType[t] = byType[t] || { count: 0, bytes: 0 };
        byType[t].count += 1;
        byType[t].bytes += r.transferSize || 0;
      });
      return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0), loadEvent: Math.round(nav.loadEventEnd || 0), resourceCount: res.length, byType, domNodes: document.querySelectorAll('*').length };
    });
  }

  fs.writeFileSync(`${OUT}/${vp.name}.json`, JSON.stringify({ overflow, smallTargets, a11y, perf }, null, 2));
  console.log(`[${vp.name}] overflowEls=${overflow.offenders.length} smallTargets=${smallTargets.length} domNodes=${perf?.domNodes || 'n/a'}`);
  await ctx.close();
}

for (const vp of viewports) await auditViewport(vp);

console.log('\n--- Console issues:', consoleIssues.length);
consoleIssues.slice(0, 15).forEach((c) => console.log(`  [${c.vp}][${c.type}] ${c.text}`));

await browser.close();
