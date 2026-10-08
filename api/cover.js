import { json } from './_firebase.js';

const hosts = ['y.gtimg.cn', 'coverartarchive.org', 'archive.org', 'firebasestorage.googleapis.com', 'storage.googleapis.com', 'res.cloudinary.com', 'images.unsplash.com'];
export function allowedCover(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && (hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) || /^is[1-5]-ssl\.mzstatic\.com$/.test(url.hostname));
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  let target = req.query.url;
  if (!allowedCover(target)) return json(res, 400, { error: 'Unsupported cover host.' });
  const signal = AbortSignal.timeout(18000);
  try {
    for (let redirects = 0; redirects <= 4; redirects++) {
      const response = await fetch(target, { redirect: 'manual', signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) break;
        target = new URL(location, target).href;
        if (!allowedCover(target)) return json(res, 400, { error: 'Unsupported cover redirect.' });
        continue;
      }
      const type = response.headers.get('content-type')?.split(';')[0];
      if (!response.ok || !/^image\/(png|jpeg|webp|gif|avif)$/.test(type || '') || !response.body) {
        await response.body?.cancel();
        break;
      }
      const reader = response.body.getReader(), chunks = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8 * 1024 * 1024) {
          await reader.cancel();
          return json(res, 413, { error: 'Cover too large.' });
        }
        chunks.push(value);
      }
      res.status(200).setHeader('Content-Type', type).setHeader('Cache-Control', 'private, max-age=86400').setHeader('X-Content-Type-Options', 'nosniff');
      return res.end(Buffer.concat(chunks));
    }
  } catch { /* Return a stable error so the wall can render its fallback. */ }
  return json(res, 502, { error: 'Cover unavailable.' });
}
