'use strict';
const path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
function createLocalAPI(directory) {
  fs.mkdirSync(directory, { recursive: true });
  process.env.ALBUM_CIRCLE_LOCAL_FIRESTORE = '1';
  process.env.ALBUM_CIRCLE_LOCAL_FIRESTORE_FILE = path.join(directory, 'collection.json');
  // The local runtime never reads cloud database credentials or invokes paid AI.
  for (const key of ['FIREBASE_SERVICE_ACCOUNT_JSON', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'DEEPSEEK_API_KEY', 'TAVILY_API_KEY', 'ADMIN_PASSWORD']) delete process.env[key];
  const tokenFile = path.join(directory, 'local-session.txt');
  let token;
  try { token = fs.readFileSync(tokenFile, 'utf8'); } catch {}
  if (!/^local-[a-f\d]{48}$/.test(token || '')) { token = 'local-' + crypto.randomBytes(24).toString('hex'); fs.writeFileSync(tokenFile, token, { mode: 0o600 }); }
  const runtime = require('./local-runtime.cjs');
  const ready = runtime.bootstrap(token);
  return {
    bootstrap: () => ready,
    async route(request) {
      await ready;
      const url = new URL(request.url), handler = runtime.handlers[url.pathname];
      if (!handler) return Response.json({ error: '本地模式不提供此功能，请切换云端账号。' }, { status: 404 });
      if (url.pathname === '/api/auth' && request.method === 'POST') {
        const action = (await request.clone().json().catch(() => ({}))).action;
        if (['signup', 'login'].includes(action)) return Response.json({ error: '本地模式无需登录，请在软件设置中切换云端账号。' }, { status: 400 });
      }
      const supplied = request.headers.get('authorization');
      if (!['/api/search', '/api/resolve-link'].includes(url.pathname) && supplied !== 'Bearer ' + token) return Response.json({ error: 'Invalid local session.' }, { status: 401 });
      const body = ['POST', 'PUT', 'PATCH'].includes(request.method) ? await request.json() : {};
      let status = 200, payload = '', headers = {};
      const res = { status(value) { status = value; return this; }, setHeader(key, value) { headers[key] = value; return this; }, end(value) { payload = value; } };
      await handler({ method: request.method, query: Object.fromEntries(url.searchParams), body, headers: Object.fromEntries(request.headers), url: url.pathname + url.search }, res);
      return new Response(payload, { status, headers });
    }
  };
}
module.exports = { createLocalAPI };
