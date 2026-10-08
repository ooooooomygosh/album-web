'use strict';
// The desktop pet: a small transparent, always-on-top window showing the room
// cat. It receives display-only companion state and can send a fixed set of
// commands back to the business page. It never holds credentials.
const { BrowserWindow, ipcMain, Menu, screen } = require('electron');
const fs = require('node:fs'), path = require('node:path');
const { cleanCompanion } = require('./wallpaper-model.cjs');
const { createCompanionPoller, sendCompanionCommand } = require('./companion-sync.cjs');
const URL = 'album-desktop://pet/pet.html';
const SIZES = { S: 128, M: 192, L: 256 };
const windowSize = (size) => ({ width: Math.max(240, Math.round(size * 1.5)), height: size + 64 });

function clampToWorkArea(bounds) {
  const area = screen.getDisplayMatching(bounds).workArea;
  return { ...bounds, x: Math.max(area.x - Math.round(bounds.width / 3), Math.min(area.x + area.width - Math.round(bounds.width * 2 / 3), bounds.x)), y: Math.max(area.y - 40, Math.min(area.y + area.height - bounds.height + 10, bounds.y)) };
}

function createPet({ directory, getSite, getFocus, status, registerProtocol, restoreMain, log = () => {} }) {
  const prefsPath = path.join(directory, 'pet.json');
  let window = null, prefs = { size: 'M' }, latest = null, saveTimer;
  try { prefs = { ...prefs, ...JSON.parse(fs.readFileSync(prefsPath, 'utf8')) }; } catch {}
  if (!SIZES[prefs.size]) prefs.size = 'M';
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(prefsPath, JSON.stringify(prefs)); } catch {} }, 300); };
  const payload = () => ({ companion: latest, size: SIZES[prefs.size] });
  const poller = createCompanionPoller({ getSite, clean: (value) => cleanCompanion(value?.companion), onValue: (value) => { latest = value; window?.webContents.send('pet:update', payload()); } });
  const announce = () => status({ active: Boolean(window), size: prefs.size });
  const validSender = (event) => window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === URL;

  function defaultBounds() {
    const { width, height } = windowSize(SIZES[prefs.size]), area = screen.getPrimaryDisplay().workArea;
    if (Number.isFinite(prefs.x) && Number.isFinite(prefs.y)) return clampToWorkArea({ x: prefs.x, y: prefs.y, width, height });
    return { x: area.x + area.width - width - 24, y: area.y + area.height - height, width, height };
  }
  async function start() {
    if (window) { window.showInactive(); return; }
    const created = new BrowserWindow({ ...defaultBounds(), title: 'Album Circle · 桌宠小猫', frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: true, show: false,
      webPreferences: { preload: path.join(__dirname, 'pet-preload.cjs'), partition: 'album-circle-pet', sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, backgroundThrottling: false, spellcheck: false } });
    window = created;
    created.setAlwaysOnTop(true, 'floating'); created.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    if (!(await created.webContents.session.protocol.isProtocolHandled('album-desktop'))) registerProtocol(created.webContents.session.protocol);
    created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    created.webContents.on('will-navigate', (event) => event.preventDefault());
    created.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    created.webContents.session.setPermissionCheckHandler(() => false);
    created.on('closed', () => { if (window === created) { window = null; poller.stop(); announce(); } });
    created.setIgnoreMouseEvents(true, { forward: true });
    try { await created.loadURL(URL); } catch (error) { log('pet-load-failed', error.message); }
    if (window !== created) return;
    created.showInactive(); poller.start(); announce(); log('pet-started');
  }
  function stop() { const old = window; window = null; poller.stop(); if (old && !old.isDestroyed()) old.destroy(); announce(); }
  function resize(size) {
    if (!SIZES[size]) return; prefs.size = size; save();
    if (window) { const bounds = window.getBounds(), next = windowSize(SIZES[size]); window.setBounds(clampToWorkArea({ x: bounds.x + Math.round((bounds.width - next.width) / 2), y: bounds.y + bounds.height - next.height, ...next })); window.webContents.send('pet:update', payload()); }
    announce();
  }
  function menu() {
    const focus = getFocus?.() || latest?.focus, running = focus && focus.phase !== 'idle' && !focus.paused;
    Menu.buildFromTemplate([
      { label: running ? '暂停专注' : focus?.phase && focus.phase !== 'idle' ? '继续专注' : '开始专注', click: () => sendCompanionCommand(getSite(), running ? 'focus-pause' : 'focus-start') },
      ...(focus && focus.phase !== 'idle' ? [{ label: focus.phase === 'focus' ? '提前结束本轮' : '跳过休息', click: () => sendCompanionCommand(getSite(), 'focus-skip') }] : []),
      { label: '开关小屋声音', click: () => sendCompanionCommand(getSite(), 'sound-toggle') },
      { type: 'separator' },
      { label: '大小', submenu: Object.keys(SIZES).map((key) => ({ label: { S: '小', M: '中', L: '大' }[key], type: 'radio', checked: prefs.size === key, click: () => resize(key) })) },
      { label: '打开小屋', click: restoreMain },
      { label: '让小猫回家', click: stop }
    ]).popup({ window });
  }
  ipcMain.handle('pet:snapshot', (event) => { if (!validSender(event)) throw new Error('Unknown pet sender'); return payload(); });
  ipcMain.on('pet:hit', (event, value) => { if (validSender(event)) window.setIgnoreMouseEvents(!value, { forward: true }); });
  ipcMain.on('pet:move', (event, dx, dy) => {
    if (!validSender(event) || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 2000 || Math.abs(dy) > 2000) return;
    const bounds = window.getBounds(); window.setBounds(clampToWorkArea({ ...bounds, x: bounds.x + dx, y: bounds.y + dy }));
  });
  ipcMain.on('pet:drag-end', (event) => { if (!validSender(event)) return; const { x, y } = window.getBounds(); prefs = { ...prefs, x, y }; save(); });
  ipcMain.on('pet:menu', (event) => { if (validSender(event)) menu(); });
  ipcMain.on('pet:open', (event) => { if (validSender(event)) restoreMain(); });
  ipcMain.on('pet:command', (event, command) => { if (validSender(event)) sendCompanionCommand(getSite(), command); });
  return { start, stop, resize, get active() { return Boolean(window); }, get window() { return window; }, get size() { return prefs.size; }, reposition() { if (window) window.setBounds(clampToWorkArea(window.getBounds())); } };
}
module.exports = { createPet, SIZES, windowSize, clampToWorkArea };
