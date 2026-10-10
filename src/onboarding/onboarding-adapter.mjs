// Thin adapters between onboarding / settings hub and teammates' APIs.
//
// Player (PR #15, src/player/sources.mjs, docs/player.md 「音源接口」):
//   listSources({ mac? }) -> [{ id, label, kind, login, platform?, supported }]
//   connectSource(id) -> Promise<{ ok, cancelled, error }>   (resolves when login / folder pick ends)
//   getSourceStatus(id) -> Promise<{ id, supported, connected, detail, needsPermission?, app? }>
//   requestPermission('appleMusic') -> Promise<{ granted, needsPermission, available, error }>
//   testPlayback({ provider, seconds }) -> Promise<{ ok, provider, quality, title } | { ok:false, error }>
//   Audio quality: GET /desktop-music/config { quality, qualities }, POST /desktop-music/quality { quality }.
// The module is loaded lazily when it exists (main does not have it yet);
// otherwise the fallbacks below reuse existing desktop commands / endpoints
// and never pretend a login or permission succeeded.
// Desktop (PR #14, docs/desktop.md): window.cabinDesktop.{ enterDesktopMode(),
//   exitDesktopMode(), getDesktopModeStatus() -> { active, busy, supported, via, reason },
//   onDesktopModeChange(cb) } plus window event 'cabin:desktop-mode'.
import { sourceOptions } from './onboarding-model.mjs';

// Vite resolves this at build time; an empty map when sources.mjs is absent.
const SOURCE_MODULES = (() => { try { return import.meta.glob('../player/sources.mjs'); } catch { return {}; } })();
export async function loadPlayerSources(modules = SOURCE_MODULES) {
  const load = Object.values(modules || {})[0];
  if (!load) return null;
  try { return await load(); } catch { return null; }
}

const call = async (api, name, ...args) => {
  if (typeof api?.[name] !== 'function') return { missing: true };
  try { return { value: await api[name](...args) }; } catch (error) { return { error: error?.message || String(error) }; }
};

export function createPlayerAdapter({ api, env = {}, command = () => {}, request = async () => { throw new Error('offline'); }, win = globalThis, load = loadPlayerSources } = {}) {
  let pending;
  const player = async () => api !== undefined ? api : (win.cabinPlayer || (pending ??= load()));
  return {
    async listSources() {
      const local = sourceOptions(env);
      const result = await call(await player(), 'listSources', { mac: Boolean(env.mac) });
      if (!Array.isArray(result.value)) return local;
      const known = new Map(local.map((item) => [item.id, item]));
      return result.value.filter((item) => item && typeof item.id === 'string' && item.supported !== false && item.id !== 'ma').map((item) => {
        const base = known.get(item.id) || { id: item.id, hint: '', provider: item.id };
        const needsDesktop = base.desktopOnly ?? item.id !== 'local';
        return { ...base, label: item.label || base.label, kind: item.kind, login: Boolean(item.login), provider: item.id === 'appleMusic' ? 'appleMusic' : base.provider || item.id, available: !needsDesktop || Boolean(env.desktop), reason: needsDesktop && !env.desktop ? '需要心流小屋桌面版' : '' };
      });
    },
    async connectSource(id) {
      const p = await player();
      if (!env.desktop) {
        if (id === 'local') return { ok: false, fallback: 'add-album', error: '网页版请在「添加专辑 › 本地音乐」里直接选择音乐文件。' };
        return { ok: false, error: '需要在心流小屋桌面版中连接。' };
      }
      if ((id === 'system' || id === 'appleMusic') ) return { ok: true };
      const result = await call(p, 'connectSource', id);
      if (!result.missing) return result.error ? { ok: false, error: result.error } : { ok: Boolean(result.value?.ok), cancelled: Boolean(result.value?.cancelled), error: result.value?.cancelled && !result.value?.error ? '已取消。' : result.value?.error || '' };
      // Fallback (main): fire the command; the page event refreshes status.
      if (id === 'local') { command('local-music-folder'); return { ok: true, pending: 'album-local-music' }; }
      if (id === 'qq' || id === 'netease') { command('music-login', { provider: id }); return { ok: true, pending: 'album-music-account' }; }
      return { ok: false, error: '未知音源' };
    },
    async getSourceStatus(id) {
      const result = await call(await player(), 'getSourceStatus', id, { request });
      if (result.value) return { connected: Boolean(result.value.connected), detail: String(result.value.detail || ''), needsPermission: Boolean(result.value.needsPermission) };
      try {
        if (id === 'local') { const s = await request('/local/summary'); return { connected: (s.trackCount || 0) > 0, detail: s.trackCount ? `${s.albumCount} 张专辑 · ${s.trackCount} 首` : '还没有添加文件夹' }; }
        if (id === 'qq' || id === 'netease') { const c = await request('/config'); const ok = Boolean(c[`${id}LoggedIn`]); return { connected: ok, detail: ok ? '已保存登录信息' : '未登录' }; }
      } catch { return { connected: false, detail: env.desktop ? '暂时读不到状态' : '' }; }
      if (id === 'system' || id === 'appleMusic') return { connected: Boolean(env.desktop), detail: env.desktop ? '播放时自动读取' : '' };
      return { connected: false, detail: '' };
    },
    // Returns 'granted' | 'denied' | 'skipped' | 'unsupported'.
    async requestPermission(id) {
      if (id === 'notifications') {
        const N = win.Notification;
        if (!N) return 'unsupported';
        if (N.permission === 'granted' || N.permission === 'denied') return N.permission;
        try { const value = await N.requestPermission(); return value === 'default' ? 'skipped' : value; } catch { return 'denied'; }
      }
      if (id !== 'appleMusic') return 'unsupported'; // TODO(desktop): autostart API.
      const result = await call(await player(), 'requestPermission', id, { request });
      if (result.error) return 'denied';
      const value = result.value;
      if (!value) return 'unsupported';
      if (typeof value === 'string') return ['granted', 'denied', 'unsupported', 'skipped'].includes(value) ? value : 'denied';
      return value.granted ? 'granted' : value.available === false ? 'unsupported' : 'denied';
    },
    async testPlayback(provider = 'auto') {
      const result = await call(await player(), 'testPlayback', { provider, request });
      if (!result.missing) return result.error ? { ok: false, error: result.error } : { ok: Boolean(result.value?.ok), kind: 'track', ...(result.value || {}) };
      // Fallback (main): confirm the output device with a short chime.
      return playChime(win);
    },
    async qualities() {
      if (!env.desktop) return null;
      try {
        const c = await request('/config');
        if (!Array.isArray(c.qualities) || !c.qualities.length) return null;
        return { options: c.qualities.map((q) => typeof q === 'string' ? { id: q, label: q } : { id: q.id ?? q.value, label: q.label ?? q.id }), current: c.quality || '' };
      } catch { return null; }
    },
    async setQuality(id) { try { await request('/quality', { quality: id }); return true; } catch { return false; } }
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
