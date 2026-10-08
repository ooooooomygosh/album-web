'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { SITE_ORIGIN } = require('./policy.cjs');
const { extractLink, isQQUrl } = require('./qq-music.cjs');
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; media-src 'self' https: blob:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'";
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain' };

function createSiteRouter({ webRoot, forward, qq, music, localAPI, getAppearance }) {
  const files = new Map();
  function list(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const relative = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) list(path.join(directory, entry.name), relative);
      else files.set(relative, path.join(directory, entry.name));
    }
  }
  list(webRoot);
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  return async function route(request) {
    const url = new URL(request.url);
    if (url.origin !== SITE_ORIGIN) return forward(request);
    if (url.pathname.startsWith('/desktop-cloud/api/') && localAPI) {
      const pathname = url.pathname.slice('/desktop-cloud'.length);
      if (!['/api/rooms', '/api/items', '/api/auth'].includes(pathname) || !['GET', 'POST', 'DELETE'].includes(request.method)) return json({ error: 'Unsupported cloud operation.' }, 400);
      return forward(new Request(SITE_ORIGIN + pathname + url.search, { method: request.method, headers: request.headers, signal: request.signal, ...(['POST'].includes(request.method) ? { body: await request.arrayBuffer() } : {}) }));
    }
    if (request.method === 'GET' && url.pathname === '/desktop-bootstrap.js' && localAPI) {
      const settings = getAppearance(), session = await localAPI.bootstrap();
      const bootstrap = `(() => { const settings = ${JSON.stringify(settings)}; window.albumDesktopAppearance = settings; document.documentElement.dataset.desktopClient = 'true'; document.documentElement.dataset.desktopShowroom = settings.showroom; document.documentElement.dataset.desktopPurchases = String(settings.showPurchases); document.documentElement.dataset.desktopReduceMotion = String(settings.reduceMotion); let current; try { current = JSON.parse(localStorage.getItem('album-circle-session') || 'null'); } catch {}; if (settings.connectionMode === 'local') { if (current?.token && !current.token.startsWith('local-')) localStorage.setItem('album-circle-cloud-session-v1', JSON.stringify(current)); localStorage.setItem('album-circle-session', JSON.stringify(${JSON.stringify(session)})); const url = new URL(location.href); if (!url.searchParams.has('room')) { url.searchParams.set('room','local-room'); history.replaceState(null,'',url); } } else if (current?.token?.startsWith('local-')) { const cloud = localStorage.getItem('album-circle-cloud-session-v1'); if (cloud) localStorage.setItem('album-circle-session', cloud); else localStorage.removeItem('album-circle-session'); } })();`;
      return new Response(bootstrap, { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' } });
    }
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/shared' && localAPI && getAppearance().connectionMode === 'local') {
      if (!['/api/search', '/api/resolve-link'].includes(url.pathname)) { try { return await localAPI.route(request); } catch { return Response.json({ error: '本地请求失败，请检查输入后重试。' }, { status: 400 }); } }
      if (url.pathname === '/api/search' && url.searchParams.get('provider') !== 'qq' && !isQQUrl(url.searchParams.get('link'))) return localAPI.route(request);
    }
    if (url.pathname.startsWith('/desktop-music/')) return music ? music(request, url.pathname.slice('/desktop-music'.length) + url.search) : Response.json({ error: '音源服务暂不可用。' }, { status: 503 });
    if (request.method === 'GET' && url.pathname === '/desktop-image') {
      let image;
      try { image = new URL(url.searchParams.get('url')); } catch { return new Response('Invalid cover', { status: 400 }); }
      const trusted = ['y.gtimg.cn', 'coverartarchive.org', 'archive.org', 'firebasestorage.googleapis.com', 'storage.googleapis.com', 'res.cloudinary.com', 'images.unsplash.com'];
      const allowed = trusted.some((host) => image.hostname === host || image.hostname.endsWith(`.${host}`)) || /^is[1-5]-ssl\.mzstatic\.com$/.test(image.hostname);
      if (!allowed || image.protocol !== 'https:' || image.username || image.password || image.port) return new Response('Unsupported cover host', { status: 400 });
      try {
        const response = await forward(new Request(image.href, { credentials: 'omit', signal: AbortSignal.timeout(18000) }));
        const type = response.headers.get('content-type')?.split(';')[0];
        if (!response.ok || !/^image\/(png|jpeg|webp|gif|avif)$/.test(type || '')) return new Response('Cover unavailable', { status: 502 });
        const reader = response.body.getReader(), chunks = []; let bytes = 0;
        while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 8 * 1024 * 1024) { await reader.cancel(); return new Response('Cover too large', { status: 413 }); } chunks.push(value); }
        return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
      } catch { return new Response('Cover unavailable', { status: 502 }); }
    }
    if (request.method === 'GET' && url.pathname === '/api/search') {
      const link = url.searchParams.get('link') || extractLink(url.searchParams.get('term'));
      if (url.searchParams.get('provider') === 'qq' || isQQUrl(link)) {
        try { return json(await qq.search(url.searchParams)); }
        catch (error) { return json({ error: error.name === 'TimeoutError' ? 'QQ 音乐响应超时，请稍后重试。' : error.message }, 502); }
      }
      if (link) return json({ error: '目前支持 QQ 专辑链接精确识别；其他平台请用名称搜索。' }, 400);
    }
    if (request.method === 'GET' && url.pathname === '/api/resolve-link' && isQQUrl(extractLink(url.searchParams.get('input')))) {
      try {
        const identity = await qq.resolveLink(url.searchParams.get('input'));
        return json({ provider: 'qq-music', type: 'album', id: identity.mid || identity.id, confidence: 1, query: '', evidence: 'QQ 专辑链接直接定位。' });
      } catch (error) { return json({ error: error.message }, 400); }
    }
    if (url.pathname.startsWith('/api/')) return forward(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    const file = files.get(url.pathname === '/' ? '/index.html' : url.pathname);
    if (!file) return new Response('Not found', { status: 404 });
    let content = request.method === 'HEAD' ? null : fs.readFileSync(file);
    if (localAPI && file.endsWith('index.html') && content) content = Buffer.from(content.toString().replace('</head>', '<script src="/desktop-bootstrap.js"></script></head>'));
    return new Response(content, {
      headers: { 'Content-Type': `${mimeTypes[path.extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' }
    });
  };
}

module.exports = { createSiteRouter, CSP };
