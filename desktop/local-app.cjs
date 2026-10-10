'use strict';
// "在本机 App 中打开": a clearly labelled hand-off when in-app streaming fails.
// Only documented / observed entry points are used, and whether the app is
// installed is checked with the OS protocol registry — we never report that a
// song is playing in the cabin when it is only opened elsewhere.
//   网易云音乐 desktop registers `orpheus://`; `orpheus://song/<id>` opens the song.
//   QQ 音乐 desktop registers `qqmusic://`, but its song-link format is not
//   documented, so for QQ we open the official song page (y.qq.com), which
//   offers "在客户端打开" when the app is installed.
const APPS = {
  netease: { name: '网易云音乐', scheme: 'orpheus', link: (c) => /^\d{1,20}$/.test(c.id || '') ? `orpheus://song/${c.id}` : '', web: (c) => /^\d{1,20}$/.test(c.id || '') ? `https://music.163.com/#/song?id=${c.id}` : `https://music.163.com/#/search/m/?s=${encodeURIComponent(c.query || '')}` },
  qq: { name: 'QQ 音乐', scheme: 'qqmusic', link: () => '', web: (c) => /^[a-z\d]{14}$/i.test(c.id || '') ? `https://y.qq.com/n/ryqq/songDetail/${c.id}` : `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(c.query || '')}` }
};
function createLocalApps({ openExternal, appForProtocol = () => '' }) {
  const installed = (provider) => { try { return Boolean(appForProtocol(`${APPS[provider].scheme}://`)); } catch { return false; } };
  return {
    status() { return Object.fromEntries(Object.entries(APPS).map(([id, app]) => [id, { name: app.name, installed: installed(id) }])); },
    async open(value = {}) {
      const app = APPS[value.provider]; if (!app) throw new Error('不支持此平台。');
      const candidate = { id: String(value.id || '').slice(0, 64), query: String(value.query || '').slice(0, 200) };
      const hasApp = installed(value.provider), deep = hasApp ? app.link(candidate) : '';
      const target = deep || app.web(candidate);
      await openExternal(target);
      // `opened` is "the OS accepted the link", not "music is playing".
      return { opened: true, app: app.name, via: deep ? 'app' : 'web', installed: hasApp, url: target, playingInCabin: false };
    }
  };
}
module.exports = { createLocalApps, APPS };
