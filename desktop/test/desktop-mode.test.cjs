const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createDesktopMode } = require('../desktop-mode.cjs');

function fakeWindow() {
  const calls = [];
  let bounds = { x: 100, y: 80, width: 1200, height: 800 }, maximized = false, visible = true;
  const record = (name) => (...args) => { calls.push([name, ...args]); };
  return {
    calls,
    isDestroyed: () => false, isMaximized: () => maximized, isFullScreen: () => false, isSimpleFullScreen: () => false, isVisible: () => visible,
    getBounds: () => bounds, getNormalBounds: () => bounds,
    setBounds: (value) => { calls.push(['setBounds', value]); bounds = value; },
    unmaximize: () => { maximized = false; }, maximize: () => { calls.push(['maximize']); maximized = true; },
    setResizable: record('setResizable'), setMovable: record('setMovable'), setFullScreenable: record('setFullScreenable'),
    setAlwaysOnTop: record('setAlwaysOnTop'), setVisibleOnAllWorkspaces: record('setVisibleOnAllWorkspaces'), setHiddenInMissionControl: record('setHiddenInMissionControl'),
    showInactive: record('showInactive'), show: record('show'), focus: record('focus'), setFullScreen: record('setFullScreen'),
    getNativeWindowHandle: () => { const buffer = Buffer.alloc(8); buffer.writeBigUInt64LE(4242n); return buffer; }
  };
}
const screen = { getDisplayMatching: () => ({ workArea: { x: 0, y: 25, width: 1440, height: 875 } }) };

test('desktop mode on macOS: fills the work area at level −1 and restores the window', () => {
  const window = fakeWindow(), changes = [];
  const mode = createDesktopMode({ getWindow: () => window, screen, platform: 'darwin', onChange: (state) => changes.push(state.active) });
  mode.enter();
  assert.equal(mode.active, true);
  assert.deepEqual(window.calls.find(([name]) => name === 'setBounds')[1], { x: 0, y: 25, width: 1440, height: 875 });
  assert.deepEqual(window.calls.find(([name]) => name === 'setAlwaysOnTop').slice(1), [true, 'normal', -1]);
  assert(window.calls.some(([name, value]) => name === 'setResizable' && value === false));
  mode.enter(); // idempotent
  mode.exit();
  assert.equal(mode.active, false);
  assert.deepEqual(window.calls.filter(([name]) => name === 'setBounds').at(-1)[1], { x: 100, y: 80, width: 1200, height: 800 });
  assert.deepEqual(window.calls.filter(([name]) => name === 'setAlwaysOnTop').at(-1).slice(1), [false]);
  assert.deepEqual(changes, [true, false]);
});

test('desktop mode on Windows: a keep-bottom helper runs while active and is stopped on exit', () => {
  const window = fakeWindow(), spawned = [];
  const spawnProcess = (file, args) => { const child = new EventEmitter(); child.stdin = { end: () => { child.ended = true; } }; child.kill = () => { child.killed = true; }; spawned.push({ file, args, child }); return child; };
  const mode = createDesktopMode({ getWindow: () => window, screen, platform: 'win32', helperPath: 'C:/x/DesktopHost.exe', spawnProcess });
  assert.equal(mode.enter().kept, true);
  assert.deepEqual(spawned[0].args, ['keep-bottom', '4242', String(process.pid)]);
  assert(!window.calls.some(([name]) => name === 'setAlwaysOnTop'), 'no window level games on Windows');
  mode.exit();
  assert.equal(spawned[0].child.killed, true); assert.equal(spawned[0].child.ended, true);
  // A helper that exits on its own (e.g. missing) leaves desktop mode usable.
  mode.enter(); spawned[1].child.emit('exit', 1);
  assert.equal(mode.active, true); assert.equal(mode.state().kept, false);
  mode.stop(); assert.equal(mode.active, false);
});

test('desktop mode refits to the current work area after display changes', async () => {
  const window = fakeWindow(); let area = { x: 0, y: 0, width: 1920, height: 1040 };
  const mode = createDesktopMode({ getWindow: () => window, screen: { getDisplayMatching: () => ({ workArea: area }) }, platform: 'darwin' });
  mode.refit(); await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(window.calls.filter(([name]) => name === 'setBounds').length, 0, 'inactive: no refit');
  mode.enter(); area = { x: 0, y: 0, width: 2560, height: 1400 }; mode.refit(); await new Promise((resolve) => setTimeout(resolve, 150));
  assert.deepEqual(window.calls.filter(([name]) => name === 'setBounds').at(-1)[1], area);
  mode.stop();
});

test('desktop mode leaves fullscreen through the shell and fits after a native exit', () => {
  const window = fakeWindow(); let full = true, leaves = 0; const handlers = {};
  window.isFullScreen = () => full; window.once = (name, fn) => { handlers[name] = fn; };
  const mode = createDesktopMode({ getWindow: () => window, screen, platform: 'darwin', leaveFullscreen: () => { leaves++; } });
  mode.enter();
  assert.equal(leaves, 1);
  full = false; window.calls.length = 0; handlers['leave-full-screen']();
  assert.deepEqual(window.calls.find(([name]) => name === 'setBounds')[1], { x: 0, y: 25, width: 1440, height: 875 });
  mode.stop();
});
