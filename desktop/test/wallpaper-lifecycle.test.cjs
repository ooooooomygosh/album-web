'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(setImmediate);
function fixture(platform = 'darwin') {
  const windows = [], statuses = [], timers = new Map(), logs = []; let next = 0, handled = false, registrations = 0;
  const options = { read: async () => ({ room: { look: 'pixel', items: [] } }), load: async () => {}, appearance: async () => {}, fetch: async () => new Response('<html/>'), native: (_file, _args, _options, callback) => callback(null, JSON.stringify({ behindIcons: true, visible: true })) };
  const partition = { protocol: { isProtocolHandled: () => handled }, fetch: (...args) => options.fetch(...args), setPermissionRequestHandler() {}, setPermissionCheckHandler() {} };
  class BrowserWindow extends EventEmitter {
    constructor() { super(); this.destroyed = false; this.webContents = new EventEmitter(); Object.assign(this.webContents, { session: partition, setFrameRate() {}, setWindowOpenHandler() {}, executeJavaScript: () => options.appearance(), send() {} }); windows.push(this); }
    getNativeWindowHandle() { return Buffer.alloc(8); }
    loadURL() { return options.load(); }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; this.emit('closed'); }
    setIgnoreMouseEvents() {} setVisibleOnAllWorkspaces() {} showInactive() {} isVisible() { return true; }
  }
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../wallpaper.cjs'), 'utf8'), {
    module, exports: module.exports, AbortController, __dirname: path.join(__dirname, '..'), process: { platform, pid: 1 },
    require: (name) => name === 'electron' ? { BrowserWindow, ipcMain: { handle() {} }, screen: { getDisplayMatching: () => ({ bounds: { x: 0, y: 0, width: 100, height: 100 } }) }, session: { fromPartition: () => partition } } : name === 'node:child_process' ? { execFile: (...args) => options.native(...args) } : require(name.startsWith('./') ? path.join(__dirname, '..', name) : name),
    setTimeout: (fn) => { timers.set(++next, fn); return next; }, clearTimeout: (id) => timers.delete(id), setInterval: (fn) => { timers.set(++next, fn); return next; }, clearInterval: (id) => timers.delete(id)
  });
  const manager = module.exports.createWallpaper({ app: { isPackaged: false }, getMain: () => ({ getBounds: () => ({}), getNativeWindowHandle: () => Buffer.alloc(8) }), getSite: () => ({ isDestroyed: () => false, executeJavaScript: () => options.read() }), status: (state) => statuses.push({ ...state }), appearanceScript: () => '', getAppearance: () => ({}), log: (...args) => logs.push(args), registerProtocol: () => { registrations++; handled = true; } });
  return { manager, options, windows, statuses, timers, logs, get registrations() { return registrations; } };
}
test('wallpaper starts once, uses its own session, and stops without a residual window/timer', async () => {
  const f = fixture(), loading = deferred(); f.options.load = () => loading.promise;
  const pending = f.manager.start(); await flush(); await f.manager.start();
  assert.equal(f.windows.length, 1); assert.equal(f.registrations, 1); assert.equal(f.manager.busy, true);
  loading.resolve(); await pending; assert.equal(f.manager.active, true); assert.equal(f.manager.busy, false);
  f.manager.stop(); assert.equal(f.windows[0].destroyed, true); assert.equal(f.manager.window, null); assert.equal(f.timers.size, 0);
  await f.manager.start(); assert.equal(f.windows.length, 2); assert.equal(f.registrations, 1); f.manager.stop();
});
test('failed load gives a concise error, cleans up, and allows retry', async () => {
  const f = fixture(); f.options.load = async () => { throw new Error("ERR_FAILED (-2) loading 'album-desktop://wallpaper/wallpaper.html'"); };
  await f.manager.start(); assert.equal(f.manager.active, false); assert.equal(f.manager.busy, false); assert.equal(f.windows[0].destroyed, true); assert.equal(f.timers.size, 0);
  assert.match(f.statuses.at(-1).error, /加载失败/); assert.ok(!f.statuses.at(-1).error.includes('ERR_FAILED')); assert.match(f.logs.find(([event]) => event === 'wallpaper-start-failed')[1], /ERR_FAILED/);
  f.options.load = async () => {}; await f.manager.start(); assert.equal(f.manager.active, true); assert.equal(f.statuses.at(-1).error, ''); f.manager.stop();
});
test('missing resource and session fetch failure do not leave a window or busy state', async () => {
  for (const fetch of [async () => new Response('', { status: 404 }), async () => { throw new Error('fetch failed'); }]) {
    const f = fixture(); f.options.fetch = fetch; await f.manager.start();
    assert.equal(f.windows.length, 0); assert.equal(f.manager.busy, false); assert.equal(f.timers.size, 0); assert.ok(f.statuses.at(-1).error);
  }
});
test('cancelling room read or preflight cannot create a late wallpaper', async () => {
  for (const stage of ['read', 'fetch']) {
    const f = fixture(), pending = deferred(); f.options[stage] = () => pending.promise;
    const start = f.manager.start(); await flush(); f.manager.stop();
    pending.resolve(stage === 'read' ? { room: { look: 'pixel' } } : new Response('<html/>')); await start;
    assert.equal(f.windows.length, 0); assert.equal(f.manager.busy, false); assert.equal(f.timers.size, 0);
  }
});
test('a cancelled old load cannot stop or activate a newer attempt', async () => {
  const f = fixture(), old = deferred(); f.options.load = () => old.promise;
  const pending = f.manager.start(); await flush(); f.manager.stop();
  f.options.load = async () => {}; await f.manager.start(); old.reject(new Error('old cancelled load')); await pending;
  assert.equal(f.windows[0].destroyed, true); assert.equal(f.windows[1].destroyed, false); assert.equal(f.manager.active, true); assert.equal(f.statuses.at(-1).error, ''); f.manager.stop();
});
test('cancellation during appearance never attaches; closed/crashed windows clear state', async () => {
  const f = fixture(), appearance = deferred(); f.options.appearance = () => appearance.promise;
  const pending = f.manager.start(); await flush(); f.manager.stop(); appearance.resolve(); await pending;
  assert.equal(f.manager.active, false); assert.equal(f.timers.size, 0);
  f.options.appearance = async () => {}; await f.manager.start(); f.manager.window.webContents.emit('render-process-gone');
  assert.equal(f.manager.active, false); assert.equal(f.manager.window, null); assert.equal(f.timers.size, 0);
  await f.manager.start(); f.manager.window.destroy(); assert.equal(f.manager.window, null); assert.equal(f.timers.size, 0);
});
test('startup deadline releases a stuck read and permits retry', async () => {
  const f = fixture(), pending = deferred(); f.options.read = () => pending.promise;
  const start = f.manager.start(); f.timers.values().next().value();
  assert.equal(f.manager.busy, false); assert.match(f.statuses.at(-1).error, /超时/); assert.equal(f.timers.size, 0);
  pending.resolve({ room: { look: 'pixel' } }); await start; assert.equal(f.windows.length, 0);
  f.options.read = async () => ({ room: { look: 'pixel' } }); await f.manager.start(); assert.equal(f.manager.active, true); f.manager.stop();
});

test('stop aborts an in-flight session request before retry', async () => {
  const f = fixture(), pending = deferred(); let signal;
  f.options.fetch = (_url, options) => { signal = options.signal; return pending.promise; };
  const start = f.manager.start(); await flush(); assert.equal(signal.aborted, false); f.manager.stop(); assert.equal(signal.aborted, true);
  pending.reject(new Error('aborted')); await start; assert.equal(f.statuses.at(-1).error, ''); assert.equal(f.windows.length, 0);
});

test('cancelling Windows attach aborts the helper; a later attempt can succeed (mock native)', async () => {
  const f = fixture('win32'); let signal;
  f.options.native = (_file, _args, options, callback) => { signal = options.signal; signal.addEventListener('abort', () => callback(new Error('abort')), { once: true }); };
  const pending = f.manager.start(); await flush(); assert.equal(signal.aborted, false); f.manager.stop(); await pending;
  assert.equal(signal.aborted, true); assert.equal(f.windows[0].destroyed, true); assert.equal(f.timers.size, 0);
  f.options.native = (_file, _args, _options, callback) => callback(null, JSON.stringify({ behindIcons: true, visible: true }));
  await f.manager.start(); assert.equal(f.manager.active, true); f.manager.stop();
});
test('stale reposition failure does not stop a replacement wallpaper (mock native)', async () => {
  const f = fixture('win32'); await f.manager.start(); let complete;
  f.options.native = (_file, _args, _options, callback) => { complete = callback; };
  const moving = f.manager.reposition(); f.manager.stop();
  f.options.native = (_file, _args, _options, callback) => callback(null, JSON.stringify({ behindIcons: true, visible: true }));
  await f.manager.start(); complete(new Error('old failure')); await moving;
  assert.equal(f.manager.active, true); assert.equal(f.windows[1].destroyed, false); f.manager.stop();
});
test('an old pending poll cannot block synchronization after a restart', async () => {
  const f = fixture(); await f.manager.start(); const pending = deferred(); f.options.read = () => pending.promise;
  const oldPoll = f.timers.values().next().value(); f.manager.stop();
  let reads = 0; f.options.read = async () => { reads++; return { room: { look: 'pixel' } }; };
  await f.manager.start(); await f.timers.values().next().value(); assert.equal(reads, 2);
  pending.resolve({ room: { look: 'warm' } }); await oldPoll; assert.equal(f.manager.active, true); f.manager.stop();
});
