/* QA PREVIEW ONLY. Inject before the production module into a disposable preview.
 * Do not include this file in a released build. No real accounts or user files.
 * All collection/music APIs below are in-memory fixtures. Native actions are mocked.
 */
(() => {
  'use strict';
  const realFetch = window.fetch.bind(window), origin = location.origin;
  const art = (color, title) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${color}"/><circle cx="200" cy="170" r="105" fill="#e4b178"/><circle cx="200" cy="170" r="32" fill="#303638"/><text x="200" y="335" text-anchor="middle" font-size="30" fill="#faf0db">${title}</text></svg>`)}`;
  const titles = ['午后慢慢听', '森林来信', '海边的风', '夜空日记', '留白', '雨落窗边', '小小冒险', '明天见', '暖灯下', '旧日时光', '月光散步', '安静一刻', '早晨的咖啡', '旅途中', '在家就好', '冬日书信', '沿途风景', '好好休息'];
  const colors = ['#355e60', '#567450', '#789eab', '#4d526f', '#b39b7c', '#69798b'];
  let items = titles.map((title, i) => ({ id: `preview-${i}`, type: 'album', title, artist: '预览演示音乐人', year: String(2026 - i % 8), cover: art(colors[i % colors.length], title), source: 'manual', tracks: ['晨光', '夜雨'], trackDetails: ['abcdef0123456789', 'fedcba9876543210'].map((id, n) => ({ title: n ? '夜雨' : '晨光', source: 'local', providerId: id, lengthMillis: 15000 })), addedAt: new Date(Date.UTC(2026, 9, 8) - i * 86400000).toISOString() }));
  let nextId = 100, systemPlaying = true;
  const wav = new Uint8Array(44 + 22050 * 2 * 15), view = new DataView(wav.buffer);
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) wav[offset + i] = value.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 22050, true); view.setUint32(28, 44100, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, wav.length - 44, true);
  for (let i = 0; i < 22050 * 15; i++) view.setInt16(44 + i * 2, Math.round(Math.sin(i * 2 * Math.PI * 220 / 22050) * 900), true);
  const audioURL = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  const json = (value, status = 200) => Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }));
  const unavailable = () => json({ error: '交互验证预览：此操作需要正式桌面客户端，预览不会连接真实账号。' }, 403);
  window.fetch = async (input, options = {}) => {
    const req = typeof input === 'string' || input instanceof URL ? null : input;
    const url = new URL(req?.url || input, location.href), method = options.method || req?.method || 'GET';
    if (url.protocol === 'data:' || url.protocol === 'blob:') return realFetch(input, options);
    if (url.origin !== origin) return unavailable();
    let body = {};
    try { body = JSON.parse(options.body || (req && method !== 'GET' ? await req.clone().text() : '{}')); } catch { return json({ error: '预览请求格式错误' }, 400); }
    const p = url.pathname;
    if (p === '/api/items/import') { let added = 0; for (const item of body.items || []) if (!items.some(i => i.id === item.id)) { items.push(item); added++; } return json({ added, total: items.length }); }
    if (p === '/api/items') {
      if (method === 'GET') return json({ items });
      if (method === 'POST') { const item = { ...body, id: `preview-added-${nextId++}`, addedAt: new Date().toISOString() }; items.unshift(item); return json({ item }); }
      const id = url.searchParams.get('id'), item = items.find(i => i.id === id);
      if (!item) return json({ error: '唱片不存在' }, 404);
      if (method === 'PATCH') { Object.assign(item, body); return json({ item }); }
      if (method === 'DELETE') { items = items.filter(i => i.id !== id); return json({ ok: true }); }
    }
    if (p === '/api/search') return json({ candidates: [{ ...items[0], id: 'preview-search-result', title: '预览搜索结果 · 午后唱片', cover: art('#657663', '午后唱片') }] });
    if (p === '/desktop-music/config') return method === 'GET' ? json({ qqLoggedIn: false, neteaseLoggedIn: false, maURL: '', playerId: '' }) : unavailable();
    if (p === '/desktop-music/local/summary') return json({ folders: [{ name: '预览音乐文件夹（模拟）', path: '/preview/music' }], albumCount: 1, trackCount: 2 });
    if (p === '/desktop-music/local/albums') return json({ albums: [{ id: 'preview-local', title: '预览本地专辑', artist: '预览演示音乐人', cover: art('#6d7565', '本地专辑'), tracks: [{ id: 'abcdef0123456789', title: '晨光', duration: 15 }, { id: 'fedcba9876543210', title: '夜雨', duration: 15 }] }], albumCount: 1, trackCount: 2 });
    if (p === '/desktop-music/resolve') return body.provider === 'local' ? json({ audioPath: audioURL, trial: true, quality: '生成的测试音，不是平台歌曲' }) : unavailable();
    if (p === '/desktop-music/search') return url.searchParams.get('provider') === 'local' ? json({ candidates: [{ id: 'abcdef0123456789', provider: 'local', title: '生成的测试音', artist: '预览', album: '模拟本地播放' }] }) : unavailable();
    if (p === '/desktop-music/now-playing') return json({ available: true, active: true, playing: systemPlaying, title: '模拟系统歌曲 · 不实际发声', artist: '预览', album: '模拟媒体会话', app: '预览播放器', position: 1, duration: 180 });
    if (p === '/desktop-music/now-playing/control') { if (body.action === 'toggle') systemPlaying = !systemPlaying; return json({ ok: true }); }
    if (p.startsWith('/api/') || p.startsWith('/desktop-music/') || p === '/desktop-image') return unavailable();
    return realFetch(input, options);
  };
  let wallpaperAttempt = 0, wallpaperTimer;
  const wallpaperState = state => { window.albumRoomWallpaperState = state; window.dispatchEvent(new CustomEvent('album-room-wallpaper', { detail: state })); };
  window.open = value => {
    const command = String(value || '');
    if (command.startsWith('album-desktop://action/wallpaper-stop')) { clearTimeout(wallpaperTimer); wallpaperState({ active: false, busy: false, error: '' }); return null; }
    if (command.startsWith('album-desktop://action/wallpaper-start')) {
      clearTimeout(wallpaperTimer); const attempt = ++wallpaperAttempt; wallpaperState({ active: false, busy: true, error: '' });
      wallpaperTimer = setTimeout(() => wallpaperState(attempt === 1 ? { active: false, busy: false, error: '模拟桌面背景启动失败：仅用于错误提示验证' } : { active: true, busy: false, error: '' }), 350); return null;
    }
    alert('交互验证预览：账号登录、桌宠窗口与系统桌面操作，请在正式桌面客户端中使用。此预览未执行原生操作。'); return null;
  };
  window.albumDesktopAppearance = { client: true, reduceMotion: true };
  const start = () => {
    document.documentElement.dataset.desktopClient = 'true'; document.documentElement.dataset.desktopReduceMotion = 'true';
    const banner = document.createElement('div'); banner.id = 'qa-preview-banner'; banner.setAttribute('role', 'note');
    banner.textContent = '交互验证预览，非真实账号播放 · 数据为演示，刷新重置唱片';
    Object.assign(banner.style, { position: 'fixed', bottom: '5px', right: '8px', zIndex: '2147483647', padding: '6px 10px', borderRadius: '7px', border: '1px solid #e6c58a', color: '#fff4d6', background: '#302c25ee', font: '11px/1.4 sans-serif', pointerEvents: 'none', maxWidth: '90vw' }); document.body.appendChild(banner);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
