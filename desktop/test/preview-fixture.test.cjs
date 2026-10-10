'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../scripts/preview-fixture.js'), 'utf8');
function fixture() {
  const forwarded = [], alerts = [], banners = [], events = [];
  const window = { dispatchEvent: event => events.push({ type: event.type, detail: event.detail }), fetch: async (input) => { forwarded.push(String(input)); return new Response('asset'); } };
  const document = { readyState: 'complete', documentElement: { dataset: {} }, createElement: () => ({ style: {}, setAttribute() {} }), body: { appendChild: item => banners.push(item) } };
  const context = vm.createContext({ window, document, location: { origin: 'https://preview.test', href: 'https://preview.test/' }, URL, Response, Blob, Uint8Array, DataView, CustomEvent, setTimeout, clearTimeout, alert: message => alerts.push(message) });
  vm.runInContext(source, context);
  const request = (url, body, method) => window.fetch(url, body === undefined ? {} : { method: method || 'POST', body: JSON.stringify(body) });
  return { window, document, forwarded, alerts, banners, events, request };
}
test('preview has a permanent simulation notice and never forwards account or external requests', async () => {
  const f = fixture(); assert.equal(f.banners.length, 1); assert.match(f.banners[0].textContent, /交互验证预览，非真实账号播放/);
  for (const url of ['https://example.com/api', '/desktop-music/ma/players', '/desktop-music/resolve', '/api/unknown']) assert.equal((await f.request(url)).status, 403);
  assert.equal((await f.request('/desktop-music/config', { maURL: 'https://private.test' })).status, 403);
  f.window.open('album-desktop://action/music-login?provider=qq'); assert.equal(f.alerts.length, 1); assert.equal(f.forwarded.length, 0);
});
test('preview collection CRUD is isolated and resets for a fresh preview', async () => {
  const f = fixture(); const list = async () => (await (await f.request('/api/items')).json()).items;
  assert.equal((await list()).length, 18);
  const { item } = await (await f.request('/api/items', { title: 'Fixture', artist: 'QA', tracks: [] })).json();
  assert.equal((await list()).length, 19);
  const patched = await (await f.request('/api/items?id=' + item.id, { notes: 'local test' }, 'PATCH')).json(); assert.equal(patched.item.notes, 'local test');
  await f.request('/api/items?id=' + item.id, {}, 'DELETE'); assert.equal((await list()).length, 18);
  assert.equal((await (await fixture().request('/api/items')).json()).items.length, 18); assert.equal(f.forwarded.length, 0);
});
test('preview local audio is generated; platform playback fails closed', async () => {
  const f = fixture(); const audio = await (await f.request('/desktop-music/resolve', { provider: 'local', id: 'abcdef0123456789' })).json();
  assert.match(audio.audioPath, /^blob:/); const bytes = new Uint8Array(await (await fetch(audio.audioPath)).arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), 'RIFF'); assert(bytes.length > 500000); URL.revokeObjectURL(audio.audioPath);
  assert.equal((await f.request('/desktop-music/resolve', { provider: 'qq', id: 'test' })).status, 403);
  await f.request('/desktop-music/now-playing/control', { action: 'toggle' }); assert.equal((await (await f.request('/desktop-music/now-playing')).json()).playing, false); assert.equal(f.forwarded.length, 0);
});

test('preview wallpaper error, cancellation and retry are simulated events only', async () => {
  const f = fixture(), start = 'album-desktop://action/wallpaper-start', stop = 'album-desktop://action/wallpaper-stop';
  f.window.open(start); assert.equal(f.events.at(-1).detail.busy, true);
  await new Promise(resolve => setTimeout(resolve, 380)); assert.match(f.events.at(-1).detail.error, /模拟桌面背景启动失败/);
  f.window.open(start); f.window.open(stop); await new Promise(resolve => setTimeout(resolve, 380)); assert.equal(f.events.at(-1).detail.active, false);
  f.window.open(start); await new Promise(resolve => setTimeout(resolve, 380)); assert.equal(f.events.at(-1).detail.active, true);
  f.window.open(stop); assert.equal(f.events.at(-1).detail.active, false); assert.equal(f.forwarded.length, 0); assert.equal(f.alerts.length, 0);
});

test('preview 沉入桌面 commands mirror the wallpaper simulation and ignore tray-pet', async () => {
  const f = fixture();
  f.window.open('album-desktop://action/tray-pet?id=fox'); assert.equal(f.alerts.length, 0);
  f.window.open('album-desktop://action/desktop-sink-enter'); await new Promise(resolve => setTimeout(resolve, 380));
  f.window.open('album-desktop://action/desktop-sink-enter'); await new Promise(resolve => setTimeout(resolve, 380));
  const sink = f.events.filter(event => event.type === 'cabin:desktop-mode').at(-1);
  assert.equal(sink?.detail.active, true); assert.equal(sink.detail.via, 'wallpaper');
  f.window.open('album-desktop://action/desktop-sink-exit'); assert.equal(f.events.filter(event => event.type === 'cabin:desktop-mode').at(-1).detail.active, false);
});
