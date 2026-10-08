import { albumKey, normalizeLibrary } from '../src/record-library.mjs';
const text = (value, max = 160) => String(value || '').slice(0, max);
const image = (value) => /^https:\/\/[^\s]+$/.test(value || '') || /^\/(?!\/)[\w/.-]+$/.test(value || '') ? text(value, 700) : '';
export function cleanSharedRoom(value = {}) {
  const items = (Array.isArray(value.items) ? value.items : []).slice(0, 80).map((item, index) => ({
    id: text(item.id || 'album-' + index, 80), type: item.type === 'song' ? 'song' : 'album', title: text(item.title), artist: text(item.artist), cover: image(item.cover), year: text(item.year, 16), tracks: (Array.isArray(item.tracks) ? item.tracks : []).slice(0, 80).map((track) => text(track)),
    tags: (Array.isArray(item.tags) ? item.tags : []).slice(0, 12).map((tag) => text(tag, 80)), background: text(item.background, 1200), collectionId: text(item.collectionId, 120),
    externalIds: Object.fromEntries(['qqAlbumMid', 'qqAlbumId', 'qqSongMid', 'itunesCollectionId', 'musicBrainzReleaseGroupId'].filter((key) => item.externalIds?.[key]).map((key) => [key, text(item.externalIds[key], 120)])),
    aiProfile: Object.fromEntries(['overview', 'albumContext', 'creativeBackground', 'melodyMotif', 'lyricPerspective', 'arrangement', 'releaseState'].filter((key) => item.aiProfile?.[key]).map((key) => [key, text(item.aiProfile[key], 1600)]))
  })).filter((item) => item.title && item.artist);
  const settings = value.appearance || {};
  const library = normalizeLibrary(value.library || {});
  // Share only the selected room's visual data; never other rooms or account metadata.
  library.rooms = library.rooms[value.roomId] ? { shared: library.rooms[value.roomId] } : {};
  const keys = new Set(items.map(albumKey));
  library.styles = Object.fromEntries(Object.entries(library.styles).filter(([key]) => keys.has(key)));
  library.genres = Object.fromEntries(Object.entries(library.genres).filter(([key]) => keys.has(key)));
  for (const room of Object.values(library.rooms)) room.boxes = room.boxes.map((box) => ({ ...box, keys: box.keys.filter((key) => keys.has(key)) }));
  return { version: 1, name: text(value.name || '音乐展柜', 80), roomId: 'shared', items, library, appearance: { showroom: ['room', 'coverflow'].includes(settings.showroom) ? settings.showroom : 'original', theme: settings.theme === 'simple' ? 'simple' : 'cover', reduceMotion: settings.reduceMotion === true }, createdAt: Date.now() };
}
