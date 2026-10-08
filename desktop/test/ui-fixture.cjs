'use strict';
const fs = require('node:fs');
const path = require('node:path');
const albums = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/motion-albums.json')));
async function mountFixture(application, site, options = {}) {
  const user = { id: 'desktop-qa-only', name: '本机界面测试', avatar: '♪', settings: {} };
  const room = { id: 'desktop-qa-room', name: '界面验证房间', ownerId: user.id, members: { [user.id]: true }, memberProfiles: { [user.id]: user } };
  const items = options.items || albums;
  await application.evaluate(({ app, webContents, safeStorage, net }, { user, room, items, gateAI, slowCover, music }) => {
    const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.cjs');
    const path = require('node:path');
    const { createSiteRouter } = require(path.join(app.getAppPath(), 'site-router.cjs'));
    const session = webContents.getAllWebContents().find((c) => c.getURL().startsWith('https://album-circle.vercel.app')).session;
    let musicService;
    if (music) {
      const { createMusicService } = require(path.join(app.getAppPath(), 'music-service.cjs'));
      const wav = Buffer.alloc(44 + 44100 * 2 * 20); wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
      globalThis.__qaMusicResolves = []; globalThis.__qaMusicSearches = 0; globalThis.__qaMACommands = [];
      const fake = { handleQQSearch: async () => [], handleSearch: async () => { globalThis.__qaMusicSearches++; return [{ id: '12345', name: items[0].tracks[0], artist: items[0].artist, album: { name: items[0].title } }, { id: '67890', name: items[0].tracks[0] + '（现场版）', artist: items[0].artist, album: { name: '现场演出' } }]; }, handleQQSongUrl: async (_cookie, id) => { globalThis.__qaMusicResolves.push(id); if (id === items[0].trackDetails[2].providerId) return { playable: false, message: '本机测试：此曲需要平台会员权限。' }; return { playable: true, url: 'https://ws.stream.qqmusic.qq.com/qa.wav' }; }, normalizeLoginInfo: () => ({}), handleSongUrl: async (id) => { globalThis.__qaMusicResolves.push(id); return { playable: true, url: 'https://m7.music.126.net/qa.wav', trial: false }; }, audioProxyHeadersFor: (_url, range) => ({ Range: range }) };
      let maState = 'idle';
      musicService = createMusicService({ directory: app.getPath('userData'), safeStorage, login: async () => ({ ok: false }), logout: async () => {}, upstream: fake, fetch: async (_url, options) => {
        if (_url === 'http://127.0.0.1:8095/api') {
          if (options.headers.Authorization !== 'Bearer QA_MA_TOKEN') return Response.json({}, { status: 401 });
          const command = JSON.parse(options.body); globalThis.__qaMACommands.push(command);
          if (command.command === 'players/all') return Response.json([{ player_id: 'qa-speaker', display_name: '测试音箱', available: true }]);
          if (command.command === 'music/search') return Response.json({ tracks: [{ item_id: 'ma-track-1', uri: 'library://track/ma-track-1', name: items[0].tracks[0], artists: [{ name: items[0].artist }], album: { name: items[0].title } }] });
          if (command.command === 'player_queues/play_media' || command.command === 'players/cmd/play') maState = 'playing';
          if (command.command === 'players/cmd/pause') maState = 'paused'; if (command.command === 'players/cmd/stop') maState = 'idle';
          if (command.command === 'players/get') return Response.json({ playback_state: maState, corrected_elapsed_time: 3, current_media: { title: items[0].tracks[0], artist: items[0].artist, duration: 20 } });
          return Response.json(null);
        }
        const from = /^bytes=(\d+)-/.exec(options.headers.Range || ''), start = from ? Number(from[1]) : 0;
        return new Response(wav.subarray(start), { status: start ? 206 : 200, headers: { 'content-type': 'audio/wav', 'content-length': String(wav.length - start), 'accept-ranges': 'bytes', ...(start ? { 'content-range': `bytes ${start}-${wav.length - 1}/${wav.length}` } : {}) } });
      } });
      app.once('before-quit', () => musicService.stop());
    }
    const router = createSiteRouter({ webRoot: path.join(app.getAppPath(), 'web'), qq: { search: async () => ({ candidates: [items[0]] }) }, forward: (request) => session.fetch(request, { bypassCustomProtocolHandlers: true }), ...(musicService ? { music: (request, pathname) => musicService.proxy(request, pathname, (url, options) => net.fetch(url, options)) } : {}) });
    globalThis.__qaBlockedWrites = 0; globalThis.__qaMockAI = 0;
    const aiWait = new Promise((resolve) => { globalThis.__qaReleaseAI = resolve; });
    const imageWait = new Promise((resolve) => { globalThis.__qaReleaseImage = resolve; });
    session.protocol.unhandle('https');
    session.protocol.handle('https', async (request) => {
      const url = new URL(request.url);
      if (url.searchParams.has('qa-broken-cover')) return new Response('', { status: 404 });
      if (slowCover && url.searchParams.has('qa-slow-cover')) await imageWait;
      if (url.origin === 'https://album-circle.vercel.app' && url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/ai/background' && gateAI) { globalThis.__qaMockAI++; await aiWait; return Response.json({ error: '本机动效测试：不调用付费 AI。' }, { status: 503 }); }
        if (request.method !== 'GET') { globalThis.__qaBlockedWrites++; return Response.json({ error: 'Test disallows writes' }, { status: 405 }); }
        if (url.pathname === '/api/search') return Response.json({ candidates: [items[0]] });
        return Response.json(url.pathname === '/api/auth' ? { user } : { room, rooms: [room], items, comments: [], ratings: [] });
      }
      return router(request);
    });
  }, { user, room, items, gateAI: options.gateAI === true, slowCover: options.slowCover === true, music: options.music === true });
  await site.evaluate(({ user, room }) => { localStorage.setItem('album-circle-session', JSON.stringify({ token: 'desktop-qa-invalid-token', user })); history.replaceState(null, '', '/?room=' + room.id); }, { user, room });
  await site.reload(); await site.getByRole('searchbox', { name: '快速搜索专辑或歌曲' }).waitFor({ state: 'visible' });
  return { user, room, items };
}
module.exports = { mountFixture, albums };
