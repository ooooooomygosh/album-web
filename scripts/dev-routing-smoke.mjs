const baseUrl = process.env.APP_URL || 'http://localhost:5173';

async function assertText(path, pattern, label) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  if (!pattern.test(response.headers.get('content-type') || '')) {
    throw new Error(`${label} returned wrong content-type: ${response.headers.get('content-type')}`);
  }
  if (/<!doctype html>|<html/i.test(text) && path !== '/room/deep-link-check') {
    throw new Error(`${label} was rewritten to HTML.`);
  }
  return { status: response.status, contentType: response.headers.get('content-type') || '', sample: text.slice(0, 80) };
}

const main = await assertText('/src/main.jsx', /javascript|ecmascript/i, 'Vite source module');
const client = await assertText('/@vite/client', /javascript|ecmascript/i, 'Vite client module');
const reactRefresh = await assertText('/@react-refresh', /javascript|ecmascript/i, 'React refresh runtime');

const route = await fetch(`${baseUrl}/room/deep-link-check`);
const routeText = await route.text();
if (!route.ok || !/text\/html/i.test(route.headers.get('content-type') || '') || !/<div id="root"><\/div>/.test(routeText)) {
  throw new Error(`SPA fallback failed: ${route.status} ${route.headers.get('content-type')}`);
}

console.log(JSON.stringify({
  baseUrl,
  viteSource: main,
  viteClient: client,
  reactRefresh,
  spaFallback: { status: route.status, contentType: route.headers.get('content-type') || '' }
}, null, 2));
