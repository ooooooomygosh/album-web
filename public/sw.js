// Offline shell for the installable web app. Pages are network-first so new
// releases arrive immediately; hashed assets and room art are cache-first.
// API calls, desktop routes and cross-origin requests are never cached.
const CACHE = 'album-circle-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
const STATIC = /^\/(assets|fonts|room-scenes|icons)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/desktop-')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put('/', copy)); }
      return response;
    }).catch(() => caches.match('/')));
    return;
  }
  if (STATIC.test(url.pathname) || SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); }
      return response;
    })));
  }
});
