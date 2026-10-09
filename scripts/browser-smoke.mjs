/** Offline renderer integration suite. Run: node scripts/browser-smoke.mjs
 * Requires root+desktop npm ci and Chromium (BROWSER_EXECUTABLE overrides path).
 * Native OS integration, real accounts, and live platform playback are NOT tested.
 * Fixtures never call external services or read a user's profile/collection.
 */
import assert from 'node:assert/strict';
import { verifyWelcome } from './welcome-checks.mjs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/package.json'));
const { chromium } = require('playwright');
const output = path.resolve(process.env.BROWSER_OUTPUT || path.join(root, 'desktop/test-results/browser'));
await fs.mkdir(output, { recursive: true });
const port = Number(process.env.BROWSER_PORT || 4179), origin = `http://127.0.0.1:${port}`;
const report = { startedAt: new Date().toISOString(), fixtureData: true, nativeIntegrationTested: false, realAccountsUsed: false, checks: [], screenshots: [], pageErrors: [], consoleErrors: [], failedRequests: [], unexpectedRequests: [], apiCalls: [], skipped: [] };
let browser, page, server;
const check = (name, details = {}) => { report.checks.push({ name, passed: true, ...details }); console.log('PASS ' + name); };
const cover = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#355d6a"/><circle cx="64" cy="64" r="38" fill="#df9b68"/><circle cx="64" cy="64" r="13" fill="#23323b"/></svg>')}`;
let items = Array.from({ length: 18 }, (_, i) => ({ id: `fixture-${i}`, type: 'album', title: i === 0 ? '晨光本地唱片' : `测试唱片 ${i + 1}`, artist: 'Fixture Artist', year: '2026', cover: i === 2 ? '' : cover, source: 'manual', tracks: ['晨光', '夜雨'], trackDetails: ['abcdef0123456789', 'fedcba9876543210'].map((id, index) => ({ title: index ? '夜雨' : '晨光', source: 'local', providerId: id })), addedAt: new Date(Date.UTC(2026, 9, 8) - i * 86400000).toISOString() }));
const wav = Buffer.alloc(44 + 22050 * 2 * 15); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(22050, 24); wav.writeUInt32LE(44100, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 0; i < (wav.length - 44) / 2; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / 22050) * 1200), 44 + i * 2);
let systemPlaying = true, localAlbumCalls = 0; const systemCommands = [];
const screenshot = async (name) => { await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' }); report.screenshots.push(name + '.png'); };
const closeDialog = () => page.keyboard.press('Escape');
try {
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = ''; server.stdout.on('data', b => serverLog += b); server.stderr.on('data', b => serverLog += b);
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} if (server.exitCode !== null) throw new Error(serverLog); if (i === 99) throw new Error('Vite startup timed out: ' + serverLog); await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (process.env.CI ? chromium.executablePath() : await fs.access('/usr/bin/chromium').then(() => true, () => false) ? '/usr/bin/chromium' : chromium.executablePath()), headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'zh-CN', reducedMotion: 'reduce' });
  await context.addInitScript(() => { window.__desktopCommands = []; window.__cabinPlayback = []; window.addEventListener('cabin:playback', e => window.__cabinPlayback.push({ ...e.detail, at: performance.now() })); window.open = url => { window.__desktopCommands.push(String(url)); return null; }; window.albumDesktopAppearance = { client: true, reduceMotion: true }; const init = () => { document.documentElement.dataset.desktopClient = 'true'; document.documentElement.dataset.desktopReduceMotion = 'true'; }; if (document.documentElement) init(); else new MutationObserver((_, o) => { if (document.documentElement) { init(); o.disconnect(); } }).observe(document, { childList: true }); });
  const routeHandler = async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { report.unexpectedRequests.push(request.url()); return route.abort('blockedbyclient'); }
    const p = url.pathname, body = request.postDataJSON?.() || {};
    const json = value => route.fulfill({ json: value });
    if (p.startsWith('/api/') || p.startsWith('/desktop-music/')) report.apiCalls.push({ method: request.method(), path: p, id: url.searchParams.get('id') });
    if (p === '/api/items/import') { let added = 0; for (const item of body.items || []) if (!items.some(i => i.id === item.id)) { items.push(item); added++; } return json({ added, total: items.length }); }
    if (p === '/api/items') {
      if (request.method() === 'GET') return json({ items });
      if (request.method() === 'POST') { const item = { ...body, id: `added-${items.length}`, addedAt: new Date().toISOString() }; items.unshift(item); return json({ item }); }
      const id = url.searchParams.get('id');
      if (request.method() === 'PATCH') { const item = items.find(i => i.id === id); if (!item) return route.fulfill({ status: 404, json: { error: 'Fixture album no longer exists' } }); Object.assign(item, body); return json({ item }); }
      if (request.method() === 'DELETE') { items = items.filter(i => i.id !== id); return json({ ok: true }); }
    }
    if (p === '/api/search') return json({ candidates: [{ ...items[0], id: 'search-result', title: '搜索找到的专辑' }] });
    if (p === '/desktop-music/config') return json({ qqLoggedIn: false, neteaseLoggedIn: false, maURL: '', playerId: '' });
    if (p === '/desktop-music/local/summary') return json({ folders: [{ name: 'Fixture Music', path: '/fixture/music' }], albumCount: 1, trackCount: 2 });
    if (p === '/desktop-music/local/albums') return json(localAlbumCalls++ % 2 ? { albums: [{ id: '0123456789abcdef', title: '残缺资料' }, null] } : {}); // malformed on purpose: {} then an album without tracks
    if (p === '/desktop-music/resolve') return json({ audioPath: '/desktop-music/local/audio/' + body.id, trial: false });
    if (p.startsWith('/desktop-music/local/audio/')) return route.fulfill({ contentType: 'audio/wav', body: wav, headers: { 'accept-ranges': 'bytes' } });
    if (p === '/desktop-music/search') return json({ candidates: [{ id: 'fixture-stream', title: '晨光', artist: 'Fixture Artist', provider: url.searchParams.get('provider'), album: 'Fixture' }] });
    if (p === '/desktop-music/now-playing') return json({ available: true, active: true, playing: systemPlaying, title: '系统测试歌曲', artist: 'Fixture Artist', album: '系统测试专辑', app: 'Spotify', position: 1, duration: 180 });
    if (p === '/desktop-music/now-playing/control') { systemCommands.push(body.action); if (body.action === 'toggle') systemPlaying = !systemPlaying; return json({ ok: true }); }
    if (p.startsWith('/api/') || p.startsWith('/desktop-music/')) { report.unexpectedRequests.push(p); return route.fulfill({ status: 500, json: { error: 'Unimplemented fixture ' + p } }); }
    return route.continue();
  };
  await context.route('**/*', routeHandler);
  const welcomeRoute = route => new URL(route.request().url()).pathname === '/api/items' ? route.fulfill({ json: { items: [] } }) : routeHandler(route);
  await verifyWelcome({ browser, origin, routeHandler: welcomeRoute, evidence: output, output, check });
  context.on('page', watched => { watched.on('pageerror', error => report.pageErrors.push(error.message)); watched.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); }); watched.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }); }); });
  page = await context.newPage(); page.setDefaultTimeout(12000); await page.clock.install({ time: new Date('2026-10-08T10:00:00Z') });
  /* context captures errors across the main, wallpaper and pet renderers. */
  await page.goto(origin); await page.locator('.room-record').first().waitFor(); check('renderer-mounts-with-offline-collection');
  for (const [width, height] of [[1440, 900], [960, 600]]) { await page.setViewportSize({ width, height }); await screenshot(`cabin-${width}x${height}`); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'page must not overflow horizontally'); check(`viewport-${width}x${height}`); }
  await page.setViewportSize({ width: 1440, height: 900 });
  const { ROOM_SCENES } = await import('../src/scene-catalog.mjs');
  const { PETS } = await import('../src/pet/pet-catalog.mjs');
  assert.equal(ROOM_SCENES.length, 5); assert.equal(PETS.length, 5);
  await page.getByRole('button', { name: '布置小屋', exact: true }).click();
  for (const scene of ROOM_SCENES) {
    await page.getByRole('button', { name: `选择场景 ${scene.label}`, exact: true }).click();
    assert.equal(await page.locator('.cabin-scene').getAttribute('data-room-look'), scene.id);
    assert.equal(await page.getByRole('button', { name: `选择场景 ${scene.label}`, exact: true }).getAttribute('aria-pressed'), 'true');
  }
  for (const pet of PETS) { await page.getByRole('button', { name: `选择桌宠 ${pet.name || pet.label}`, exact: true }).click(); assert.equal(await page.locator('.room-cat .pixel-cat').getAttribute('data-pet-id'), pet.id); }
  await screenshot('room-personalization');
  await page.setViewportSize({ width: 960, height: 600 }); await screenshot('room-personalization-960x600'); await page.getByRole('button', { name: '回到小屋', exact: true }).click();
  for (const scene of ROOM_SCENES) { await page.getByRole('button', { name: '布置小屋', exact: true }).click(); await page.getByRole('button', { name: `选择场景 ${scene.label}`, exact: true }).click(); await closeDialog(); await screenshot(`scene-${scene.id}-960x600`); }
  await page.reload(); await page.locator('.room-record').first().waitFor(); assert.equal(await page.locator('.cabin-scene').getAttribute('data-room-look'), ROOM_SCENES.at(-1).id); assert.equal(await page.locator('.room-cat .pixel-cat').getAttribute('data-pet-id'), PETS.at(-1).id); check('all-five-scenes-and-pets-select-and-persist');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '添加专辑', exact: true }).click(); await page.getByRole('tab', { name: '手动填写' }).click(); await page.getByLabel('专辑名', { exact: true }).fill('QA 新唱片'); await page.getByLabel('歌手', { exact: true }).fill('QA Artist'); await page.getByLabel('曲目', { exact: true }).fill('第一首\n第二首'); await page.getByRole('button', { name: '放上唱片架' }).click(); await page.getByText('《QA 新唱片》已放上唱片架。', { exact: true }).waitFor(); await closeDialog(); assert(items.some(i => i.title === 'QA 新唱片')); assert.match(items.find(i => i.title === 'QA 新唱片').cover, /^data:image\/png;base64,/, 'manual album without cover gets a pixel cover'); check('collection-create-manual');
  await page.locator('.room-record').first().click(); await page.getByRole('button', { name: '唱片卡片', exact: true }).click(); await page.getByLabel('我的笔记').fill('持久化测试笔记'); await page.getByLabel('我的笔记').blur(); await page.getByText('已保存在这台电脑', { exact: true }).waitFor(); assert(items.some(i => i.notes === '持久化测试笔记')); await page.getByRole('button', { name: '移除', exact: true }).click(); await page.getByRole('button', { name: '确认移除' }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert(!items.some(i => i.title === 'QA 新唱片')); check('collection-update-notes-and-delete');
  await page.getByRole('button', { name: '添加专辑', exact: true }).click(); await page.getByRole('searchbox').fill('测试'); await page.getByRole('button', { name: '搜索', exact: true }).click(); await page.locator('.add-results li').first().waitFor(); await screenshot('catalog-results'); await closeDialog(); check('catalog-search-fixture');
  await page.locator('.room-record').first().dblclick(); await page.getByLabel('唱机音源', { exact: true }).selectOption('local'); await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && !a.paused && a.currentTime > .2 && a.duration > 10; }); check('actual-generated-wav-decodes-and-plays'); await page.getByRole('button', { name: '下一首展示曲目' }).click(); await page.waitForFunction(() => document.querySelector('audio').src.endsWith('fedcba9876543210')); check('local-next-track-resolves-exact-id');
  // Player: cabin:playback signal (analyser energy), keyboard shortcuts, 待播 queue.
  await page.waitForFunction(() => window.__cabinPlayback?.some(d => d.playing && !d.estimated && d.energy > .02 && d.track?.index === 1));
  const signal = await page.evaluate(() => window.__cabinPlayback);
  assert(signal.some(d => d.reason === 'track' && d.track.index === 1)); assert(signal.every(d => d.energy >= 0 && d.energy <= 1 && typeof d.playing === 'boolean'));
  const ticks = signal.filter(d => d.reason === 'energy').map(d => d.at); if (ticks.length > 3) { const gaps = ticks.slice(1).map((t, i) => t - ticks[i]); assert(Math.min(...gaps) >= 50, 'energy ticks are throttled to ~15fps'); }
  check('cabin-playback-event-carries-real-analyser-energy');
  await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Space'); await page.waitForFunction(() => document.querySelector('audio').paused && window.__cabinPlayback.at(-1).playing === false);
  await page.keyboard.press('m'); assert.equal(await page.locator('audio').evaluate(a => a.muted), true); await page.keyboard.press('m'); assert.equal(await page.locator('audio').evaluate(a => a.muted), false);
  await page.keyboard.press('Space'); await page.waitForFunction(() => !document.querySelector('audio').paused);
  await page.keyboard.press('Shift+ArrowLeft'); await page.waitForFunction(() => document.querySelector('.turntable-track').textContent.startsWith('01'));
  check('keyboard-space-mute-and-previous');
  await page.locator('.room-record').nth(1).click(); await page.getByRole('button', { name: '加入待播' }).click(); await page.getByRole('button', { name: '已在待播' }).waitFor();
  await page.getByRole('button', { name: '待播唱片 1 张' }).click(); await page.locator('.player-queue li', { hasText: '测试唱片 2' }).waitFor(); await screenshot('player-queue'); await page.getByRole('button', { name: '待播唱片 1 张' }).click();
  check('queue-adds-selected-album');
  // Album import from picked files (session playback) + pixel covers.
  await page.getByRole('button', { name: '添加专辑', exact: true }).click(); await page.getByRole('tab', { name: '本地音乐' }).click();
  await page.getByRole('tab', { name: '手动填写' }).click(); await page.getByRole('tab', { name: '本地音乐' }).click(); // {} first, then a partial album
  await page.locator('.add-results[aria-label="本地专辑"] li', { hasText: '残缺资料' }).getByText('未知歌手 · 0 首').waitFor(); check('local-music-empty-or-partial-response-renders');
  await page.getByLabel('选择音乐文件', { exact: true }).setInputFiles([{ name: '01 - Fixture Band - 晨雾.wav', mimeType: 'audio/wav', buffer: wav }, { name: '02 - Fixture Band - 夜灯.wav', mimeType: 'audio/wav', buffer: wav }]);
  const fileAlbum = page.locator('.file-import .add-results li').first(); await fileAlbum.locator('img.add-cover').waitFor(); await fileAlbum.getByText('Fixture Band · 2 首').waitFor(); await screenshot('file-import');
  await fileAlbum.getByRole('button', { name: '放上唱片架' }).click(); await page.getByText('《未命名专辑》已放上唱片架。', { exact: true }).waitFor(); await closeDialog();
  const picked = items.find(i => i.externalIds?.fileAlbum); assert(picked, 'picked-file album saved'); assert.match(picked.cover, /^data:image\/png;base64,/); assert.deepEqual(picked.tracks, ['晨雾', '夜灯']); assert(picked.trackDetails[0].lengthMillis > 10000);
  await page.reload(); await page.locator('.room-record').first().waitFor();
  check('files-import-with-tags-from-names-durations-and-pixel-cover');
  // After a reload the object URLs are gone: the deck explains instead of failing silently.
  await page.locator('.room-record').first().dblclick(); await page.locator('.player-error', { hasText: '重新打开小屋后需要再选一次文件' }).waitFor(); check('session-files-explain-reload-honestly');
  await page.getByRole('button', { name: '添加专辑', exact: true }).click(); await page.getByRole('tab', { name: '本地音乐' }).click();
  await page.getByLabel('选择音乐文件', { exact: true }).setInputFiles([{ name: '01 - Fixture Band - 晨雾.wav', mimeType: 'audio/wav', buffer: wav }, { name: '02 - Fixture Band - 夜灯.wav', mimeType: 'audio/wav', buffer: wav }]);
  await page.getByRole('button', { name: '重新连上文件' }).click(); await page.locator('.add-notice').waitFor(); await closeDialog();
  await page.getByRole('button', { name: '重试' }).click(); await page.waitForFunction(() => { const a = document.querySelector('audio'); return a.src.startsWith('blob:') && !a.paused && a.currentTime > .2; });
  check('relinked-session-files-play-from-blob');
  await page.getByRole('button', { name: '选择 Fixture Artist 的 测试唱片 4', exact: true }).click(); await page.getByRole('button', { name: '唱片卡片', exact: true }).click(); await page.getByRole('button', { name: '像素封面' }).click();
  await page.getByRole('img', { name: /像素封面预览/ }).waitFor(); await page.getByText('已把原封面转成小屋配色的像素画。', { exact: true }).waitFor(); await screenshot('record-pixel-cover'); await page.getByRole('button', { name: '用这张' }).click(); await page.getByRole('button', { name: '恢复原封面' }).waitFor();
  const pixelled = items.find(i => i.originalCover); assert.match(pixelled.cover, /^data:image\/png;base64,/); assert.equal(pixelled.originalCover, cover);
  await page.getByRole('button', { name: '恢复原封面' }).click(); await page.getByText('已恢复原封面。', { exact: true }).waitFor(); assert.equal(pixelled.cover, cover); await closeDialog();
  check('record-card-pixel-cover-preview-apply-and-restore');
  items = items.filter(i => !i.externalIds?.fileAlbum); await page.reload(); await page.locator('.room-record').first().waitFor(); // later checks count the 18 fixture albums
  await page.getByLabel('唱机音源', { exact: true }).selectOption('system'); await page.locator('.turntable-track', { hasText: '系统测试歌曲' }).waitFor(); assert.equal(await page.locator('audio').getAttribute('src'), null); await page.getByRole('button', { name: '暂停系统播放器' }).click(); await page.getByRole('button', { name: '继续系统播放器' }).waitFor(); await page.getByRole('button', { name: '系统播放器下一首' }).click(); assert.deepEqual(systemCommands, ['toggle', 'next']); check('system-source-and-transport-mocked'); await page.getByLabel('唱机音源', { exact: true }).selectOption('visual');
  await page.getByRole('button', { name: '音源设置', exact: true }).click(); await page.locator('.music-local-status', { hasText: '1 张专辑 · 2 首歌曲' }).waitFor(); await screenshot('music-settings'); const sourceBefore = await page.getByLabel('唱机音源', { exact: true }).inputValue(); await page.locator('.music-account', { hasText: 'QQ 音乐' }).getByRole('button', { name: '在唱机上用' }).click(); await page.getByLabel('唱机正在使用 QQ 音乐').waitFor(); await closeDialog(); assert.equal(await page.getByLabel('唱机音源', { exact: true }).inputValue(), 'qq'); await page.getByLabel('唱机音源', { exact: true }).selectOption(sourceBefore); check('music-settings-offline-account-and-local-status'); check('music-settings-use-source-on-deck');
  await page.locator('.focus-badge').click(); await page.getByRole('tab', { name: '待办', exact: true }).click(); await page.getByLabel('新的待办').fill('浏览器测试待办'); await page.getByRole('button', { name: '添加待办' }).click(); await page.getByRole('checkbox', { name: '完成：浏览器测试待办' }).check(); assert.equal(await page.locator('.focus-task-list li.is-done').count(), 1); check('focus-tasks-create-and-complete');
  await page.getByRole('tab', { name: '随手记', exact: true }).click(); await page.getByLabel('随手记内容').fill('QA 随手记备份内容'); check('quick-notes-save-local-text');
  await page.getByRole('tab', { name: '番茄钟' }).click(); await page.getByRole('button', { name: '计时设置' }).click(); await page.getByLabel('专注（分）').fill('2'); await page.getByLabel('专注（分）').blur(); await page.getByRole('button', { name: '开始专注' }).click(); await page.clock.fastForward(121000); await page.locator('.focus-phase', { hasText: '短休息' }).waitFor(); await page.getByRole('tab', { name: '统计' }).click(); assert.match(await page.locator('.focus-stat-tiles').innerText(), /2 分钟/); await screenshot('focus-statistics'); check('focus-timer-completes-and-records-session'); await page.locator('.focus-dock-close').click();
  await page.getByRole('button', { name: '收藏与备份', exact: true }).click(); const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '导出备份', exact: true }).click(); const download = await downloadPromise; await download.saveAs(path.join(output, 'fixture-backup.json')); const backup = JSON.parse(await fs.readFile(path.join(output, 'fixture-backup.json'))); assert.equal(backup.kind, 'FlowCabinBackup'); assert.equal(backup.items.length, 18); assert.equal(backup.focus.tasks.length, 1); assert.equal(backup.focus.notes, 'QA 随手记备份内容'); check('backup-exports-collection-and-focus');
  await page.getByLabel('导入备份文件').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') }); await page.getByText('文件内容无法读取。', { exact: true }).waitFor(); check('backup-rejects-malformed-input');
  const imported = { kind: 'FlowCabinBackup', items: [{ ...items[0], id: 'backup-imported', title: '备份导入唱片' }] };
  await page.getByLabel('导入备份文件').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) }); await page.getByText('导入完成：新增 1 张唱片，唱片架现在共有 19 张。', { exact: true }).waitFor(); assert(items.some(i => i.id === 'backup-imported')); check('backup-import-merges-new-album'); await closeDialog();
  await page.getByRole('button', { name: '专辑墙', exact: true }).click(); await page.locator('.wall-library-album').first().click(); await page.waitForFunction(() => { const c = document.querySelector('.wall-canvas-wrap canvas'); return c?.width > 300 && !document.querySelector('.wall-preview-bar').textContent.includes('正在更新'); }); await screenshot('album-wall');
  const pngPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下载 PNG', exact: true }).click(); const png = await pngPromise; await png.saveAs(path.join(output, 'fixture-album-wall.png')); const pngBytes = await fs.readFile(path.join(output, 'fixture-album-wall.png')); assert.equal(pngBytes.subarray(1, 4).toString(), 'PNG'); assert(pngBytes.length > 1000); check('album-wall-paints-and-downloads-real-png'); await closeDialog();
  await page.keyboard.press('z'); assert(await page.evaluate(() => document.documentElement.classList.contains('room-zen'))); await screenshot('zen-mode'); await page.keyboard.press('Escape'); check('zen-mode-keyboard');
  const companion = await page.evaluate(() => window.albumCompanionSnapshot());
  assert.equal(companion.petId, PETS.at(-1).id); assert(companion.room.items.length > 0); check('companion-snapshot-carries-selected-pet-and-room');
  await context.addInitScript(({ companion }) => {
    window.__nativeFixtureCalls = [];
    window.albumWallpaper = { getSnapshot: async () => ({ ...companion.room, focus: companion.focus }), onSnapshot: fn => { window.__pushWallpaper = fn; return () => {}; } };
    window.albumPet = { getSnapshot: async () => ({ companion, size: 192 }), onSnapshot: fn => { window.__pushPet = fn; return () => {}; }, setHit: v => window.__nativeFixtureCalls.push(['hit', v]), moveBy: (x, y) => window.__nativeFixtureCalls.push(['move', x, y]), dragEnd: () => {}, menu: () => {}, open: () => window.__nativeFixtureCalls.push(['open']) };
  }, { companion });
  const mainPage = page;
  page = await context.newPage(); await page.goto(origin + '/wallpaper.html'); await page.locator('.wallpaper-room').waitFor();
  for (const scene of ROOM_SCENES) {
    await page.evaluate(({ room, look }) => window.__pushWallpaper({ ...room, look }), { room: companion.room, look: scene.id });
    await page.locator(`.cabin-scene[data-room-look="${scene.id}"]`).waitFor(); assert.equal(await page.locator('.room-record').count(), companion.room.items.length); await screenshot(`wallpaper-${scene.id}`);
  }
  check('wallpaper-renderer-all-scenes-mocked-snapshot'); await page.close();
  page = await context.newPage(); await page.setViewportSize({ width: 420, height: 420 }); await page.goto(origin + '/pet.html'); await page.locator('.pet-cat .pixel-cat').waitFor();
  for (const pet of PETS) {
    await page.evaluate(({ companion, petId }) => window.__pushPet({ companion: { ...companion, petId }, size: 192 }), { companion, petId: pet.id });
    await page.locator(`.pet-cat .pixel-cat[data-pet-id="${pet.id}"]`).waitFor(); await screenshot(`desktop-pet-${pet.id}`);
  }
  await page.locator('.pet-cat').press('Enter'); await page.locator('.pet-bubble').waitFor(); check('pet-renderer-all-species-and-keyboard-poke-mocked-bridge'); await page.close(); page = mainPage;
  report.limitations = ['Browser fixtures test renderer behavior, not native Electron IPC or OS integrations.', 'WAV decoding/playback progress is real, but physical speaker output and streaming providers are not tested.', 'Screenshots are review artifacts; no approved pixel baseline has been established.', 'macOS/Windows installers, wallpaper attachment, media permissions, and pet window click-through require native acceptance tests.'];
  for (const [index, call] of report.apiCalls.entries()) if (call.method === 'DELETE' && call.path === '/api/items') assert(!report.apiCalls.slice(index + 1).some(later => later.method === 'PATCH' && later.path === call.path && later.id === call.id), 'Deleted album received a late notes autosave');
  check('deleted-albums-do-not-receive-late-autosaves');
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.unexpectedRequests, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.failedRequests, []);
  report.passed = true;
} catch (error) { report.passed = false; report.error = error.stack || String(error); console.error(report.error); process.exitCode = 1; if (page && !page.isClosed()) { await screenshot('failure').catch(() => {}); await fs.writeFile(path.join(output, 'failure.html'), await page.content()).catch(() => {}); } }
finally { report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); server?.kill(); console.log('Report: ' + path.join(output, 'report.json')); }
