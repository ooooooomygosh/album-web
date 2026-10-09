/** Reproducible product screenshots of the actual renderer, with original
 * demonstration albums. No login, native actions, personal profile or data.
 * Headless only: never creates a visible window on either display.
 * BROWSER_EXECUTABLE may point to an already installed Chromium.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/package.json'));
const { chromium } = require('playwright');
const output = path.resolve(process.env.SHOWCASE_OUTPUT || path.join(root, 'docs/images/showcase'));
const evidence = path.join(root, 'desktop/test-results/product-presentation');
const port = Number(process.env.SHOWCASE_PORT || 4183), origin = `http://127.0.0.1:${port}`;
await fs.mkdir(output, { recursive: true }); await fs.mkdir(evidence, { recursive: true });
const report = { startedAt: new Date().toISOString(), fixtureData: true, originalAlbumArt: true, headless: true, realAccountsUsed: false, nativeIntegrationTested: false, checks: [], screenshots: [], errors: [], unexpectedRequests: [] };
const check = name => { report.checks.push(name); console.log('PASS ' + name); };
const ALBUMS = [
  ['Snowfall Tapes', '#24324f', '#f2d7a6', 'moon'], ['Ember & Oak', '#5a2a17', '#f4a259', 'fire'],
  ['Midnight Kettle', '#1d2b2a', '#9fd8b8', 'steam'], ['Rainy Window', '#2f3e57', '#a8c5e6', 'rain'],
  ['Paper Moon Radio', '#3b2a4a', '#f7c6d9', 'moon'], ['Slow Sunday', '#6b4a2b', '#ffe3a3', 'sun'],
  ['Moss Garden', '#203a2b', '#b8e09b', 'leaf'], ['Cassette Dreams', '#40243a', '#ff9fb2', 'tape'],
  ['Lantern Light', '#2b1d12', '#ffc96b', 'lantern'], ['Winter Radio', '#1f2a36', '#d8e6f2', 'wave'],
  ['Tea for Two Cats', '#4a2f22', '#f6cf9f', 'cat'], ['Northern Hum', '#14233a', '#7fe3c4', 'aurora']
];
function cover(title, bg, accent, motif) {
  const motifs = {
    moon: `<circle cx="210" cy="105" r="52" fill="${accent}"/><circle cx="233" cy="90" r="48" fill="${bg}"/>`,
    fire: `<path d="M130 230c-55-35-20-95 10-130 0 40 40 40 40 80 20-20 20-40 10-70 50 35 50 95 10 120z" fill="${accent}"/>`,
    steam: `<rect x="85" y="160" width="120" height="70" rx="10" fill="${accent}"/><path d="M120 145c-20-30 20-40 0-70M160 145c-20-30 20-40 0-70" stroke="${accent}" stroke-width="8" fill="none"/>`,
    rain: Array.from({ length: 16 }, (_, i) => `<rect x="${20 + i * 16}" y="${(i * 37) % 180 + 20}" width="4" height="34" fill="${accent}"/>`).join(''),
    sun: `<circle cx="150" cy="145" r="64" fill="${accent}"/>`,
    leaf: `<path d="M70 230C70 120 160 60 240 60c0 90-60 170-170 170z" fill="${accent}"/><path d="M80 220 220 80" stroke="${bg}" stroke-width="6"/>`,
    tape: `<rect x="50" y="90" width="200" height="120" rx="12" fill="${accent}"/><circle cx="110" cy="150" r="22" fill="${bg}"/><circle cx="190" cy="150" r="22" fill="${bg}"/>`,
    lantern: `<rect x="115" y="80" width="70" height="120" rx="30" fill="${accent}"/><rect x="140" y="50" width="20" height="30" fill="${accent}"/>`,
    wave: Array.from({ length: 5 }, (_, i) => `<path d="M30 ${90 + i * 30}q30-24 60 0t60 0 60 0 60 0" stroke="${accent}" stroke-width="6" fill="none"/>`).join(''),
    cat: `<path d="M90 230V140l30-50 20 40h20l20-40 30 50v90z" fill="${accent}"/><circle cx="130" cy="160" r="7" fill="${bg}"/><circle cx="170" cy="160" r="7" fill="${bg}"/>`,
    aurora: `<path d="M0 170C60 90 120 210 180 120S300 90 300 90v40c-60 0-80 80-140 80S40 160 0 210z" fill="${accent}"/>`
  };
  return 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${bg}"/>${motifs[motif]}<text x="18" y="282" font-family="Georgia,serif" font-size="21" fill="${accent}">${title.replace(/&/g, '&amp;')}</text></svg>`).toString('base64');
}
const albums = ALBUMS.map(([title, bg, accent, motif], i) => ({ id: `showcase-${i}`, type: 'album', title, artist: 'Cabin Records · 示意唱片', year: '2026', cover: cover(title, bg, accent, motif), source: 'manual', genre: 'Lo-fi', tracks: ['First Light', 'Warm Coffee', 'Window Seat', 'Slow Walk Home'], addedAt: new Date(Date.UTC(2026, 9, 9) - i * 86400000).toISOString(), externalIds: {} }));
let items = [], browser, server, page;
const shot = async (name, publicImage = false) => {
  await page.screenshot({ path: path.join(publicImage ? output : evidence, name + (publicImage ? '.jpg' : '.png')), animations: 'disabled', ...(publicImage ? { type: 'jpeg', quality: 88 } : {}) });
  report.screenshots.push({ name, publicImage, viewport: page.viewportSize() });
};
const fits = async (locator) => {
  const box = await locator.boundingBox(), viewport = page.viewportSize();
  assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, 'Control outside viewport');
};
try {
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} if (server.exitCode !== null || i === 99) throw new Error(log || 'Server timeout'); await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || chromium.executablePath(), headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'zh-CN', reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.albumDesktopAppearance = { client: true, reduceMotion: true };
    window.open = () => { throw new Error('Native actions are disabled in product screenshots'); };
    if (!localStorage.getItem('album-circle-focus-v1:local-owner')) localStorage.setItem('album-circle-focus-v1:local-owner', JSON.stringify({ version: 1, settings: { notify: false, chime: false, autoSound: false }, tasks: [], sessions: [], timer: { phase: 'idle', round: 0 }, rewards: { fish: 0, xp: 0 } }));
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { report.unexpectedRequests.push(url.origin); return route.abort(); }
    if (url.pathname === '/api/items') return route.fulfill({ json: { items } });
    if (url.pathname === '/desktop-music/config') return route.fulfill({ json: { qqLoggedIn: false, neteaseLoggedIn: false } });
    if (url.pathname === '/desktop-music/local/summary') return route.fulfill({ json: { folders: [], albumCount: 0, trackCount: 0 } });
    if (/^\/(api|desktop-music)\//.test(url.pathname)) { report.unexpectedRequests.push(url.pathname); return route.abort(); }
    return route.continue();
  });
  page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.goto(origin); await page.getByRole('button', { name: '先专注一会儿' }).waitFor(); await page.evaluate(() => document.fonts.ready);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 960, height: 600 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.locator('.room-now-playing').count(), 0); assert.equal(await page.locator('.room-shelf-navigation').count(), 0);
    for (const name of ['添加第一张专辑', '先专注一会儿']) await fits(page.getByRole('button', { name, exact: true }));
    await shot(`welcome-${viewport.width}x${viewport.height}`);
    await page.getByRole('button', { name: '先专注一会儿' }).click(); await page.getByRole('button', { name: '开始专注', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: '番茄钟' }).getAttribute('aria-selected'), 'true'); assert.equal(await page.locator('.focus-badge').getAttribute('aria-expanded'), 'true');
    await fits(page.getByRole('button', { name: '开始专注', exact: true })); await page.getByRole('button', { name: '收起专注工具' }).click();
    await page.getByRole('button', { name: '添加第一张专辑' }).click(); await page.getByRole('dialog', { name: '添加专辑' }).waitFor(); await page.keyboard.press('Escape');
    check(`welcome-two-paths-and-visible-controls-${viewport.width}x${viewport.height}`);
  }
  items = albums; await page.setViewportSize({ width: 1440, height: 900 }); await page.reload(); await page.locator('.room-record').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.pixel-artwork canvas.is-painted').length >= 12);
  await page.locator('.room-record').nth(5).dblclick(); await page.locator('.room-turntable[data-loaded-id="showcase-5"]').waitFor();
  await page.getByText('听歌前，先选择音源。', { exact: true }).waitFor(); await shot('cabin', true);
  assert.equal(await page.locator('.room-shelf-navigation').count(), 0); check('twelve-albums-no-redundant-paging-and-visual-audio-hint');
  await page.locator('.focus-badge').click(); await page.getByRole('button', { name: '开始专注', exact: true }).click(); await page.locator('.focus-badge.is-running').waitFor(); await page.locator('.room-cat-bubble', { hasText: '还剩 25 分钟' }).waitFor(); await shot('focus', true);
  await page.getByRole('button', { name: '暂停', exact: true }).click(); check('focus-start-and-pause-from-visible-tool'); await page.getByRole('button', { name: '收起专注工具' }).click();
  await page.getByRole('button', { name: '布置小屋', exact: true }).click();
  await page.locator('.scene-choice img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  for (const name of ['奶糖', '蛋挞', '棉花', '可可', '枫糖']) await fits(page.locator('.pet-choice strong', { hasText: name }));
  await fits(page.getByRole('button', { name: '回到小屋', exact: true })); check('five-scene-thumbnails-and-all-partner-names-visible');
  await shot('personalization', true); await page.getByRole('button', { name: '回到小屋' }).click();
  await page.locator('.room-cat').click(); await page.locator('.room-cat-bubble').waitFor(); check('partner-poke-shows-response');
  await page.keyboard.press('z'); assert(await page.evaluate(() => document.documentElement.classList.contains('room-zen'))); await shot('immersive'); await page.keyboard.press('Escape'); check('immersive-enter-and-exit');
  await page.setViewportSize({ width: 960, height: 600 }); await shot('cabin-960x600');
  const { ROOM_SCENES } = await import('../src/scene-catalog.mjs');
  for (const scene of ROOM_SCENES) {
    await page.getByRole('button', { name: '布置小屋', exact: true }).click(); await page.getByRole('button', { name: `选择场景 ${scene.label}`, exact: true }).click(); await page.getByRole('button', { name: '回到小屋' }).click(); await shot(`scene-${scene.id}-960x600`);
    for (const name of ['布置小屋', '音源设置', '添加专辑']) await fits(page.getByRole('button', { name, exact: true }));
  }
  check('all-five-scenes-compact-controls-fit');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.unexpectedRequests, []); report.passed = true;
} catch (e) { report.passed = false; report.error = e.stack; process.exitCode = 1; console.error(e); if (page) await shot('failure').catch(() => {}); }
finally { report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); server?.kill(); console.log('Report: ' + path.join(evidence, 'report.json')); }
