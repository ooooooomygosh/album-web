// Thin adapters between onboarding / settings hub and teammates' APIs.
//
// Player contract (docs/player.md, owned by the player teammate; see
// docs/onboarding.md §API 契约): window.cabinPlayer exposes
//   listSources() -> [{ id, label, available, reason? }]
//   connectSource(id) -> { ok, pending?, error? }
//   getSourceStatus(id) -> { connected, detail? }
//   requestPermission('appleMusic') -> 'granted' | 'denied' | 'unsupported'
//   testPlayback() -> { ok, error? }
//   (optional) listAudioQualities(), getAudioQuality(), setAudioQuality(id)
// Desktop contract (docs/desktop.md, art teammate): window.cabinDesktop exposes
//   enterDesktopMode(), exitDesktopMode(), getDesktopModeStatus() -> { active, busy, supported, via, reason },
//   onDesktopModeChange(cb) -> unsubscribe; otherwise the page listens for window event 'cabin:desktop-mode' on change.
// Every method is optional: until it ships, the fallbacks below reuse the
// existing desktop commands and local HTTP endpoints, and never pretend a
// login or permission succeeded.
import { sourceOptions } from './onboarding-model.mjs';

const call = async (api, name, ...args) => {
  if (typeof api?.[name] !== 'function') return { missing: true };
  try { return { value: await api[name](...args) }; } catch (error) { return { error: error?.message || String(error) }; }
};

export function createPlayerAdapter({ api, env = {}, command = () => {}, request = async () => { throw new Error('offline'); }, win = globalThis } = {}) {
  const player = () => api ?? win.cabinPlayer;
  return {
    // Teammate list wins; unknown ids keep our local label and hints.
    async listSources() {
      const local = sourceOptions(env);
      const result = await call(player(), 'listSources');
      if (!Array.isArray(result.value)) return local;
      const known = new Map(local.map((item) => [item.id, item]));
      return result.value.filter((item) => item && typeof item.id === 'string').map((item) => ({ ...(known.get(item.id) || { id: item.id, label: item.label || item.id, hint: '', provider: item.id }), ...item, available: item.available !== false }));
    },
    async connectSource(id) {
      const result = await call(player(), 'connectSource', id);
      if (!result.missing) return result.error ? { ok: false, error: result.error } : { ok: true, ...(result.value || {}) };
      // TODO(player): replace with connectSource(id) once docs/player.md is final.
      if (id === 'local') {
        if (!env.desktop) return { ok: false, fallback: 'add-album', error: '网页版请在「添加专辑 › 本地音乐」里直接选择音乐文件。' };
        command('local-music-folder'); return { ok: true, pending: 'album-local-music' };
      }
      if (id === 'qq' || id === 'netease') {
        if (!env.desktop) return { ok: false, error: '平台登录需要在心流小屋桌面版中进行。' };
        command('music-login', { provider: id }); return { ok: true, pending: 'album-music-account' };
      }
      if (id === 'system' || id === 'appleMusic') return env.desktop ? { ok: true } : { ok: false, error: '需要心流小屋桌面版读取系统播放器。' };
      return { ok: false, error: '未知音源' };
    },
    async getSourceStatus(id) {
      const result = await call(player(), 'getSourceStatus', id);
      if (result.value) return { connected: Boolean(result.value.connected), detail: String(result.value.detail || '') };
      // TODO(player): fallback reads the desktop music service directly.
      try {
        if (id === 'local') { const s = await request('/local/summary'); return { connected: (s.trackCount || 0) > 0, detail: s.trackCount ? `${s.albumCount} 张专辑 · ${s.trackCount} 首` : '还没有添加文件夹' }; }
        if (id === 'qq' || id === 'netease') { const c = await request('/config'); const ok = Boolean(c[`${id}LoggedIn`]); return { connected: ok, detail: ok ? '已保存登录信息' : '未登录' }; }
      } catch { return { connected: false, detail: env.desktop ? '暂时读不到状态' : '' }; }
      if (id === 'system' || id === 'appleMusic') return { connected: Boolean(env.desktop), detail: env.desktop ? '播放时自动读取' : '' };
      return { connected: false, detail: '' };
    },
    async requestPermission(id) {
      if (id === 'notifications') {
        const N = win.Notification;
        if (!N) return 'unsupported';
        if (N.permission === 'granted' || N.permission === 'denied') return N.permission;
        try { const value = await N.requestPermission(); return value === 'default' ? 'skipped' : value; } catch { return 'denied'; }
      }
      const result = await call(player(), 'requestPermission', id);
      if (typeof result.value === 'string') return ['granted', 'denied', 'unsupported', 'skipped'].includes(result.value) ? result.value : 'denied';
      if (result.error) return 'denied';
      // TODO(player): requestPermission('appleMusic'); TODO(desktop): 'autostart'.
      return 'unsupported';
    },
    async testPlayback() {
      const result = await call(player(), 'testPlayback');
      if (!result.missing) return result.error ? { ok: false, error: result.error } : { ok: result.value?.ok !== false, kind: 'track', ...(result.value || {}) };
      // TODO(player): testPlayback() should play a real track from the chosen
      // source. Until then confirm the output device with a short chime.
      return playChime(win);
    },
    async qualities() {
      const p = player();
      if (typeof p?.listAudioQualities !== 'function') return null;
      try { return { options: await p.listAudioQualities(), current: await p.getAudioQuality?.() }; } catch { return null; }
    },
    async setQuality(id) { const result = await call(player(), 'setAudioQuality', id); return !result.missing && !result.error; }
  };
}

export function playChime(win = globalThis) {
  const Context = win.AudioContext || win.webkitAudioContext;
  if (!Context) return Promise.resolve({ ok: false, error: '这个环境不能播放测试音。' });
  try {
    const ctx = new Context(), start = ctx.currentTime + 0.02;
    [523.25, 659.25, 783.99].forEach((freq, index) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), at = start + index * 0.18;
      osc.type = 'square'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      osc.connect(gain).connect(ctx.destination); osc.start(at); osc.stop(at + 0.18);
    });
    setTimeout(() => ctx.close?.().catch?.(() => {}), 900);
    return Promise.resolve({ ok: true, kind: 'chime' });
  } catch (error) { return Promise.resolve({ ok: false, error: error?.message || '无法播放测试音' }); }
}

export const DESKTOP_MODE_EVENT = 'cabin:desktop-mode';
// 沉入桌面 (merged desktop mode + live wallpaper). `fallback` is the page's
// current toggle so the hub still works before feat/desktop-merge lands.
export function createDesktopAdapter({ api, env = {}, fallback = {}, win = globalThis } = {}) {
  const desk = () => api ?? win.cabinDesktop;
  return {
    async status() {
      const result = await call(desk(), 'getDesktopModeStatus');
      if (result.value) return { active: Boolean(result.value.active), busy: Boolean(result.value.busy), supported: result.value.supported !== false, via: String(result.value.via || ''), reason: String(result.value.reason || '') };
      // TODO(desktop): getDesktopModeStatus() from feat/desktop-merge.
      return { active: Boolean(fallback.active), supported: true, reason: env.desktop ? '' : '网页版只铺满窗口；桌面版会沉到所有窗口下面。' };
    },
    async enter() { const r = await call(desk(), 'enterDesktopMode'); if (r.missing) fallback.enter?.(); return !r.error; },
    async exit() { const r = await call(desk(), 'exitDesktopMode'); if (r.missing) fallback.exit?.(); return !r.error; },
    subscribe(listener) {
      const d = desk();
      if (typeof d?.onDesktopModeChange === 'function') { const off = d.onDesktopModeChange((detail) => listener(detail || {})); return typeof off === 'function' ? off : () => {}; }
      const receive = (event) => listener(event.detail || {}); win.addEventListener?.(DESKTOP_MODE_EVENT, receive); return () => win.removeEventListener?.(DESKTOP_MODE_EVENT, receive); }
  };
}
