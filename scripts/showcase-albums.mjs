import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Real catalog albums for screenshots and the README cover strip. Covers are
// reviewed 300×300 copies committed under docs/assets/covers, so screenshots are
// reproducible offline (the artwork CDN re-encodes originals over time).
// Nothing here is bundled into the app or inserted in a user's collection.
export async function showcaseAlbums() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { albums } = JSON.parse(await fs.readFile(path.join(root, 'scripts/showcase-albums.json'), 'utf8'));
  const result = [];
  for (const [index, album] of albums.entries()) {
    const file = path.resolve(root, album.localArtwork || '');
    if (!file.startsWith(path.join(root, 'docs/assets/covers') + path.sep)) throw new Error(`Unexpected artwork path: ${album.title}`);
    const bytes = await fs.readFile(file);
    if (createHash('sha256').update(bytes).digest('hex') !== album.localSHA256) throw new Error(`Artwork changed; review its source before updating: ${album.title}`);
    result.push({ id: `showcase-${index}`, type: 'album', title: album.title, artist: album.artist, year: album.year, genre: album.genre, tracks: album.tracks, cover: `data:image/jpeg;base64,${bytes.toString('base64')}`, source: 'itunes', collectionId: album.collectionId, externalIds: {}, addedAt: new Date(Date.UTC(2026, 9, 9) - index * 86400000).toISOString() });
  }
  return result;
}
