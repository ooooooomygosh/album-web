import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Only this development script downloads cover art. Nothing is bundled into
// the app or inserted in a user's collection. Cached originals stay ignored.
export async function showcaseAlbums() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { albums } = JSON.parse(await fs.readFile(path.join(root, 'scripts/showcase-albums.json'), 'utf8'));
  const cache = path.join(root, 'desktop/test-results/showcase-covers');
  await fs.mkdir(cache, { recursive: true });
  const result = [];
  for (const [index, album] of albums.entries()) {
    const filename = path.join(cache, `${album.collectionId}.jpg`);
    let bytes = await fs.readFile(filename).catch(() => null);
    if (!bytes) {
      const url = new URL(album.artworkURL);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.mzstatic.com')) throw new Error('Unexpected artwork host');
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Artwork unavailable: ${album.title}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 5 * 1024 * 1024) throw new Error('Artwork exceeds 5 MiB');
    }
    if (createHash('sha256').update(bytes).digest('hex') !== album.artworkSHA256) throw new Error(`Artwork changed; review its source before updating: ${album.title}`);
    await fs.writeFile(filename, bytes);
    result.push({ id: `showcase-${index}`, type: 'album', title: album.title, artist: album.artist, year: album.year, genre: album.genre, tracks: album.tracks, cover: `data:image/jpeg;base64,${bytes.toString('base64')}`, source: 'itunes', collectionId: album.collectionId, externalIds: {}, addedAt: new Date(Date.UTC(2026, 9, 9) - index * 86400000).toISOString() });
  }
  return result;
}
