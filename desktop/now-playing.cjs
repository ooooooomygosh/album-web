'use strict';
// System "now playing": Windows reads the media session through NowPlaying.exe
// (SMTC); macOS asks Music.app and Spotify through JavaScript for Automation.
// The helper only runs while the turntable uses this source.
const { spawn, execFile } = require('node:child_process');
const readline = require('node:readline');
const ACTIONS = new Set(['play', 'pause', 'toggle', 'next', 'previous']);
const IDLE_STOP_MS = 30000;
const text = (value, max = 300) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max) : '';
const seconds = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(86400, Number(value))) : 0;
function artwork(value) {
  if (typeof value !== 'string' || !value) return '';
  if (/^data:image\/(png|jpeg);base64,[a-z\d+/=]+$/i.test(value) && value.length <= 280000) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 2000 ? url.href : ''; } catch { return ''; }
}
// Windows reports an AppUserModelID; show a friendly player name.
function appName(id) {
  const value = text(id, 200), lower = value.toLowerCase();
  const known = [['spotify', 'Spotify'], ['cloudmusic', '网易云音乐'], ['qqmusic', 'QQ 音乐'], ['music.ui', 'Apple Music'], ['applemusic', 'Apple Music'], ['zunemusic', '媒体播放器'], ['chrome', 'Chrome'], ['msedge', 'Edge'], ['firefox', 'Firefox'], ['foobar', 'foobar2000']];
  return known.find(([key]) => lower.includes(key))?.[1] || value.replace(/\.exe$/i, '').split(/[\\!/]/).pop() || '系统播放器';
}
function normalizeState(value) {
  if (!value || typeof value !== 'object') return { available: false, active: false };
  if (value.available === false) return { available: false, active: false };
  if (!value.active || !text(value.title)) return { available: true, active: false };
  return { available: true, active: true, app: appName(value.app), title: text(value.title), artist: text(value.artist), album: text(value.album), albumArtist: text(value.albumArtist), playing: value.playing === true, position: seconds(value.position), duration: seconds(value.duration), artwork: artwork(value.artwork) };
}
function parseHelperLine(line) { try { return normalizeState(JSON.parse(line)); } catch { return null; } }

// JXA reads or controls whichever of Spotify and Music.app is active. It never
// launches a player: `running()` is checked first.
const MAC_SCRIPT = `function run(argv) {
  const action = argv[0] || 'read';
  let best = null, permissionError = null;
  for (const name of ['Spotify', 'Music']) {
    try {
      const app = Application(name); if (!app.running()) continue;
      const state = String(app.playerState()); if (state === 'stopped') continue;
      const track = app.currentTrack(), playing = state === 'playing';
      const item = { app, name, playing, title: track.name(), artist: track.artist(), album: track.album(), position: Number(app.playerPosition()) || 0, duration: name === 'Spotify' ? track.duration() / 1000 : track.duration(), artwork: name === 'Spotify' ? track.artworkUrl() : '' };
      if (!best || (playing && !best.playing)) best = item;
    } catch (error) { if (error.errorNumber === -1743 || /not authori[sz]ed|-1743/i.test(String(error.message))) permissionError = error; }
  }
  if (!best && permissionError) throw permissionError;
  if (action !== 'read') {
    if (!best) return JSON.stringify({ ok: false });
    const app = best.app;
    if (action === 'toggle') app.playpause(); else if (action === 'play') app.play(); else if (action === 'pause') app.pause(); else if (action === 'next') app.nextTrack(); else if (action === 'previous') app.previousTrack();
    return JSON.stringify({ ok: true });
  }
  if (!best) return JSON.stringify({ available: true, active: false });
  return JSON.stringify({ available: true, active: true, app: best.name === 'Music' ? 'Apple Music' : 'Spotify', title: best.title, artist: best.artist, album: best.album, playing: best.playing, position: best.position, duration: best.duration, artwork: best.artwork });
}`;

function createNowPlaying({ platform = process.platform, helperPath, spawnProcess = spawn, execFileProcess = execFile, now = Date.now, idleStopMs = IDLE_STOP_MS } = {}) {
  let child = null, failed = false, state = { available: platform === 'win32' || platform === 'darwin', active: false }, lastRequest = 0, idleTimer = null, macCache = null, macPending = null, generation = 0;
  const unsupported = { available: false, active: false, error: '系统正在播放仅支持 Windows 与 macOS。' };
  function stop() { generation++; macCache = null; state = { available: platform === 'win32' || platform === 'darwin', active: false }; clearInterval(idleTimer); idleTimer = null; if (child) { try { child.stdin.end(); child.kill(); } catch {} child = null; } }
  function watchIdle() {
    if (idleTimer) return;
    idleTimer = setInterval(() => { if (now() - lastRequest > idleStopMs) stop(); }, Math.min(5000, idleStopMs));
    idleTimer.unref?.();
  }
  function startWindows() {
    if (child || failed) return; // A missing helper is not retried on every poll.
    try { child = spawnProcess(helperPath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] }); }
    catch { failed = true; state = { available: false, active: false, error: '系统媒体组件不可用。' }; return; }
    const current = child;
    current.on('error', () => { if (child === current) { child = null; failed = true; state = { available: false, active: false, error: '系统媒体组件不可用。' }; } });
    current.on('exit', (code) => { if (child === current) { child = null; failed = Boolean(code); state = { available: !failed, active: false, ...(failed ? { error: '系统媒体组件已停止，请重新打开应用。' } : {}) }; } });
    current.stdin.on?.('error', () => { if (child === current) { stop(); failed = true; state = { available: false, active: false, error: '系统媒体组件不可用。' }; } });
    readline.createInterface({ input: current.stdout }).on('line', (line) => { const next = parseHelperLine(line); if (child === current && next) state = next; });
  }
  function runMac(action) {
    return new Promise((resolve) => execFileProcess('/usr/bin/osascript', ['-l', 'JavaScript', '-e', MAC_SCRIPT, action], { timeout: 5000, maxBuffer: 256 * 1024, encoding: 'utf8' }, (error, stdout) => {
      if (error) resolve({ available: true, active: false, error: /not authori[sz]ed|-1743/i.test(String(error.message)) ? '请在“系统设置 › 隐私与安全性 › 自动化”中允许心流小屋控制音乐播放器。' : '系统音乐播放器未响应，请稍后重试。' });
      else { try { resolve(JSON.parse(stdout)); } catch { resolve({ available: true, active: false, error: '系统音乐播放器返回了无效响应。' }); } }
    }));
  }
  return {
    async get() {
      lastRequest = now();
      if (platform === 'win32') { startWindows(); watchIdle(); return state; }
      if (platform === 'darwin') {
        if (macCache && now() - macCache.time < 1500) return macCache.value;
        if (macPending) return macPending;
        const current = generation;
        macPending = (async () => {
          const raw = await runMac('read'), value = raw.error ? { available: true, active: false, error: raw.error } : normalizeState(raw);
          if (current === generation) macCache = { time: now(), value };
          return value;
        })().finally(() => { macPending = null; });
        return macPending;
      }
      return unsupported;
    },
    async control(action) {
      if (!ACTIONS.has(action)) throw new Error('不支持此播放操作。');
      lastRequest = now();
      if (platform === 'win32') { startWindows(); watchIdle(); if (!child) throw new Error('系统媒体组件不可用。'); child.stdin.write(action + '\n'); return { ok: true }; }
      if (platform === 'darwin') { generation++; macCache = null; const result = await runMac(action); if (result.error) throw new Error(result.error); return { ok: result.ok === true }; }
      throw new Error(unsupported.error);
    },
    stop,
    get running() { return Boolean(child); }
  };
}
module.exports = { createNowPlaying, normalizeState, parseHelperLine, appName, MAC_SCRIPT, ACTIONS };
