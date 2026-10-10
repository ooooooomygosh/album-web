'use strict';
// 系统 Apple Music (macOS only): finds library songs and controls Music.app
// (playlist import from Music.app already lives in playlists.cjs, 'apple-local')
// through JavaScript for Automation. Audio plays in Music.app itself (Apple
// does not allow streaming its catalogue into another app), so the deck shows
// it as a remote player — like Music Assistant — and never claims local audio.
const { execFile } = require('node:child_process');
const PERMISSION_HINT = '请在“系统设置 › 隐私与安全性 › 自动化”中允许心流小屋控制“音乐”。';
const text = (value, max = 300) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max) : '';
const PERSISTENT_ID = /^[A-F0-9]{16}$/i;

// Every script receives JSON in argv[1] and prints JSON. `probe` is the
// harmless permission check: it only asks Music.app for its version.
const SCRIPT = `function run(argv) {
  const action = argv[0], input = JSON.parse(argv[1] || '{}');
  const Music = Application('Music');
  const launch = ['probe', 'play', 'search'].includes(action);
  if (!launch && !Music.running()) return JSON.stringify({ running: false });
  const trackInfo = (t) => ({ id: t.persistentID(), title: t.name(), artist: t.artist(), album: t.album(), duration: Math.round((Number(t.duration()) || 0) * 1000) });
  if (action === 'probe') return JSON.stringify({ ok: true, version: String(Music.version()) });
  if (action === 'search') { const lib = Music.libraryPlaylists[0]; const found = lib.search({ for: String(input.query || ''), only: 'songs' }) || []; return JSON.stringify({ tracks: found.slice(0, 12).map(trackInfo) }); }
  if (action === 'play') { const found = Music.libraryPlaylists[0].tracks.whose({ persistentID: input.id }); if (!found.length) throw new Error('track-missing'); found[0].play(); return JSON.stringify({ ok: true }); }
  if (action === 'control') { const a = input.action; if (a === 'toggle') Music.playpause(); else if (a === 'play') Music.play(); else if (a === 'pause') Music.pause(); else if (a === 'next') Music.nextTrack(); else if (a === 'previous') Music.previousTrack(); else if (a === 'stop') Music.stop(); return JSON.stringify({ ok: true }); }
  if (action === 'state') { const s = String(Music.playerState()); if (s === 'stopped') return JSON.stringify({ running: true, state: 'stopped' }); const t = Music.currentTrack(); return JSON.stringify({ running: true, state: s, title: t.name(), artist: t.artist(), album: t.album(), id: t.persistentID(), position: Number(Music.playerPosition()) || 0, duration: Number(t.duration()) || 0 }); }
  throw new Error('unknown-action');
}`;
const ACTIONS = new Set(['play', 'pause', 'toggle', 'next', 'previous', 'stop']);

function createAppleMusic({ platform = process.platform, execFileProcess = execFile } = {}) {
  const available = platform === 'darwin';
  const run = (action, input = {}, timeout = 15000) => new Promise((resolve, reject) => {
    if (!available) { reject(new Error('系统 Apple Music 仅支持 macOS。')); return; }
    execFileProcess('/usr/bin/osascript', ['-l', 'JavaScript', '-e', SCRIPT, action, JSON.stringify(input)], { timeout, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        const message = String(error.message || '');
        if (/not authori[sz]ed|-1743/i.test(message)) reject(Object.assign(new Error(PERMISSION_HINT), { code: 'permission' }));
        else if (/track-missing/.test(message)) reject(new Error('Apple Music 资料库里找不到这首歌。'));
        else reject(new Error('“音乐”App 未响应，请确认它可以正常打开。'));
        return;
      }
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('“音乐”App 返回了无效响应。')); }
    });
  });
  const track = (t) => ({ id: PERSISTENT_ID.test(t?.id || '') ? t.id : '', provider: 'appleMusic', title: text(t?.title), artist: text(t?.artist), album: text(t?.album), duration: Math.max(0, Number(t?.duration) || 0) });
  return {
    available,
    // Never throws: onboarding uses this to decide what to show.
    async permission() {
      if (!available) return { available: false, granted: false, error: '系统 Apple Music 仅支持 macOS。' };
      try { const result = await run('probe', {}, 60000); return { available: true, granted: result.ok === true, version: text(result.version, 40) }; }
      catch (error) { return { available: true, granted: false, error: error.message, needsPermission: error.code === 'permission' }; }
    },
    async search(query) { const result = await run('search', { query: text(query, 200) }); return (result.tracks || []).map(track).filter((t) => t.id && t.title); },
    async play(id) { if (!PERSISTENT_ID.test(String(id || ''))) throw new Error('Apple Music 曲目 ID 无效。'); await run('play', { id }); return { remote: true, provider: 'appleMusic', player: 'Apple Music' }; },
    async control(action) { if (!ACTIONS.has(action)) throw new Error('不支持此播放操作。'); const result = await run('control', { action }, 5000); if (result.running === false) throw new Error('“音乐”App 没有在运行。'); return { ok: true }; },
    async state() {
      const raw = await run('state', {}, 5000);
      if (raw.running === false || raw.state === 'stopped') return { state: raw.running === false ? 'stopped' : 'stopped', title: '', artist: '', elapsed: 0, duration: 0 };
      return { state: raw.state === 'playing' ? 'playing' : raw.state === 'paused' ? 'paused' : 'waiting', id: text(raw.id, 16), title: text(raw.title), artist: text(raw.artist), album: text(raw.album), elapsed: Math.max(0, Number(raw.position) || 0), duration: Math.max(0, Number(raw.duration) || 0) };
    }
  };
}
module.exports = { createAppleMusic, SCRIPT, PERMISSION_HINT };
