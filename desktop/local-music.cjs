'use strict';
// Local music folders: scans tags with music-metadata, groups tracks into
// albums and keeps an index of file paths. Audio is streamed in place and
// never copied. Only files present in the index can be served.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const AUDIO = { '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav' };
const LIMITS = { depth: 8, files: 5000, folders: 8 };
const hash = (value) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
const text = (value, max = 200) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max) : '';
const ID = /^[a-f\d]{16}$/;

function walk(root, limits = LIMITS) {
  const files = [];
  const visit = (directory, depth) => {
    if (depth > limits.depth || files.length >= limits.files) return;
    let entries; try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
    for (const entry of entries) {
      if (files.length >= limits.files) return;
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full, depth + 1);
      else if (entry.isFile() && AUDIO[path.extname(entry.name).toLowerCase()]) files.push(full);
    }
  };
  visit(root, 0);
  return files;
}

// Groups parsed tracks into albums. Pure, so it is unit-tested directly.
function groupAlbums(tracks) {
  const albums = new Map();
  for (const track of tracks) {
    const folder = path.basename(path.dirname(track.file));
    const artist = track.albumArtist || track.artist || '未知艺人', title = track.album || folder || '未命名专辑';
    const key = artist.toLowerCase() + '\u0001' + title.toLowerCase();
    if (!albums.has(key)) albums.set(key, { id: hash('album:' + key), title, artist, year: track.year || '', picture: null, tracks: [] });
    const album = albums.get(key);
    if (!album.year && track.year) album.year = track.year;
    if (!album.picture && track.picture) album.picture = track.picture;
    album.tracks.push(track);
  }
  return [...albums.values()].map((album) => {
    album.tracks.sort((a, b) => (a.disc || 1) - (b.disc || 1) || (a.no || 999) - (b.no || 999) || a.file.localeCompare(b.file, 'zh-CN', { numeric: true }));
    return album;
  }).sort((a, b) => a.artist.localeCompare(b.artist, 'zh-CN') || a.title.localeCompare(b.title, 'zh-CN'));
}

function createLocalMusic({ directory, loadParser = () => import('music-metadata').then((module) => module.parseFile), resizeCover = null }) {
  const indexPath = path.join(directory, 'local-music.json'), coverDir = path.join(directory, 'local-music', 'covers');
  let index = { folders: [], albums: [], scannedAt: 0 }, scanning = null;
  try { const saved = JSON.parse(fs.readFileSync(indexPath, 'utf8')); if (Array.isArray(saved.albums) && Array.isArray(saved.folders)) index = saved; } catch {}
  let tracksById = new Map();
  const rebuild = () => { tracksById = new Map(index.albums.flatMap((album) => album.tracks.map((track) => [track.id, track]))); };
  rebuild();
  function save() { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(indexPath + '.tmp', JSON.stringify(index)); fs.renameSync(indexPath + '.tmp', indexPath); }

  async function scan() {
    const parse = await loadParser(), parsed = [];
    for (const folder of index.folders) {
      for (const file of walk(folder)) {
        try {
          const { common, format } = await parse(file, { duration: false, skipPostHeaders: true });
          const picture = common.picture?.find((item) => /^image\/(jpe?g|png)$/i.test(item.format) && item.data?.length <= 8 * 1024 * 1024) || null;
          parsed.push({ file, title: text(common.title) || path.basename(file, path.extname(file)), artist: text(common.artist) || text(common.albumartist), albumArtist: text(common.albumartist), album: text(common.album), year: common.year ? String(common.year).slice(0, 4) : '', no: common.track?.no || 0, disc: common.disk?.no || 1, duration: Number.isFinite(format?.duration) ? Math.round(format.duration) : 0, picture });
        } catch { /* Unreadable tags: skip this file. */ }
      }
    }
    fs.mkdirSync(coverDir, { recursive: true });
    const albums = groupAlbums(parsed).map((album) => {
      let cover = '';
      if (album.picture) {
        try {
          const data = resizeCover ? resizeCover(Buffer.from(album.picture.data)) : Buffer.from(album.picture.data);
          if (data?.length) { fs.writeFileSync(path.join(coverDir, album.id + '.jpg'), data); cover = album.id + '.jpg'; }
        } catch {}
      }
      return { id: album.id, title: album.title, artist: album.artist, year: album.year, cover, tracks: album.tracks.map((track) => ({ id: hash('track:' + track.file), title: track.title, artist: track.artist || album.artist, duration: track.duration, file: track.file, type: AUDIO[path.extname(track.file).toLowerCase()] })) };
    });
    index = { folders: index.folders, albums, scannedAt: Date.now() }; rebuild(); save();
    return summary();
  }
  function summary() {
    return { folders: index.folders.map((folder) => ({ name: path.basename(folder) || folder, path: folder })), scannedAt: index.scannedAt, albumCount: index.albums.length, trackCount: tracksById.size, scanning: Boolean(scanning) };
  }
  // Public album list: titles and ids only, never file system paths.
  function albums() {
    return index.albums.map((album) => ({ id: album.id, title: album.title, artist: album.artist, year: album.year, cover: album.cover ? `/desktop-music/local/cover/${album.id}` : '', tracks: album.tracks.map((track) => ({ id: track.id, title: track.title, artist: track.artist, duration: track.duration })) }));
  }
  return {
    summary, albums,
    async addFolder(folder) {
      const resolved = path.resolve(String(folder || ''));
      let directory = false; try { directory = fs.statSync(resolved).isDirectory(); } catch {}
      if (!directory) throw new Error('无法读取这个文件夹，请确认它仍然存在。');
      if (!index.folders.includes(resolved)) { if (index.folders.length >= LIMITS.folders) throw new Error(`最多添加 ${LIMITS.folders} 个音乐文件夹。`); index.folders = [...index.folders, resolved]; }
      return this.rescan();
    },
    removeFolder(folderPath) { index.folders = index.folders.filter((folder) => folder !== folderPath); return this.rescan(); },
    rescan() { if (!scanning) scanning = scan().finally(() => { scanning = null; }); return scanning; },
    track(id) { if (!ID.test(id || '')) return null; const track = tracksById.get(id); return track && fs.existsSync(track.file) ? track : null; },
    coverPath(id) { if (!ID.test(id || '')) return null; const album = index.albums.find((item) => item.id === id); return album?.cover ? path.join(coverDir, album.cover) : null; },
    search(query) {
      const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8); if (!words.length) return [];
      const results = [];
      for (const album of index.albums) for (const track of album.tracks) {
        const haystack = `${track.title} ${track.artist} ${album.title} ${album.artist}`.toLowerCase();
        if (words.every((word) => haystack.includes(word))) results.push({ id: track.id, title: track.title, artist: track.artist, albumName: album.title });
        if (results.length >= 8) return results;
      }
      return results;
    }
  };
}
module.exports = { createLocalMusic, groupAlbums, walk, AUDIO };
