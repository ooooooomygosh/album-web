// Minimal, dependency-free tag reader for files picked in the browser:
// ID3v2.2/2.3/2.4 (MP3) and FLAC Vorbis comments + embedded pictures.
// Anything else (or a damaged tag) falls back to folder / file names.
export const AUDIO_EXTENSIONS = /\.(mp3|flac|m4a|aac|ogg|oga|opus|wav|webm)$/i;
export const TAG_READ_BYTES = 4 * 1024 * 1024;

const latin1 = (bytes) => { let out = ''; for (const b of bytes) out += String.fromCharCode(b); return out; };
function decodeText(bytes, encoding) {
  const trim = (s) => s.replace(/\u0000+$/g, '').split('\u0000')[0].trim();
  try {
    if (encoding === 1 || encoding === 2) {
      let view = bytes, label = encoding === 2 ? 'utf-16be' : 'utf-16le';
      if (view[0] === 0xff && view[1] === 0xfe) { label = 'utf-16le'; view = view.subarray(2); } else if (view[0] === 0xfe && view[1] === 0xff) { label = 'utf-16be'; view = view.subarray(2); }
      return trim(new TextDecoder(label).decode(view));
    }
    if (encoding === 3) return trim(new TextDecoder('utf-8').decode(bytes));
    // Many Chinese MP3s claim Latin-1 but carry GBK; prefer GBK when it decodes cleanly.
    if (bytes.some((b) => b >= 0x80)) { try { return trim(new TextDecoder('gbk', { fatal: true }).decode(bytes)); } catch {} }
    return trim(latin1(bytes));
  } catch { return ''; }
}
const synchsafe = (b, i) => (b[i] & 0x7f) << 21 | (b[i + 1] & 0x7f) << 14 | (b[i + 2] & 0x7f) << 7 | (b[i + 3] & 0x7f);
const uint32 = (b, i) => (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0;
const ID3_FIELDS = { TIT2: 'title', TT2: 'title', TPE1: 'artist', TP1: 'artist', TPE2: 'albumArtist', TP2: 'albumArtist', TALB: 'album', TAL: 'album', TRCK: 'track', TRK: 'track', TPOS: 'disc', TPA: 'disc', TYER: 'year', TYE: 'year', TDRC: 'year', TCON: 'genre', TCO: 'genre' };
function unsynchronise(bytes) { const out = []; for (let i = 0; i < bytes.length; i++) { out.push(bytes[i]); if (bytes[i] === 0xff && bytes[i + 1] === 0) i++; } return Uint8Array.from(out); }

export function readId3(bytes) {
  if (bytes.length < 10 || latin1(bytes.subarray(0, 3)) !== 'ID3') return null;
  const version = bytes[3], flags = bytes[5], size = synchsafe(bytes, 6), tags = {};
  let body = bytes.subarray(10, Math.min(bytes.length, 10 + size));
  if (flags & 0x80 && version < 4) body = unsynchronise(body);
  let offset = 0;
  if (flags & 0x40 && version >= 3) offset = version === 4 ? synchsafe(body, 0) : uint32(body, 0) + 4;
  const idLength = version === 2 ? 3 : 4, headerLength = version === 2 ? 6 : 10;
  while (offset + headerLength <= body.length) {
    const id = latin1(body.subarray(offset, offset + idLength));
    if (!/^[A-Z0-9]+$/.test(id)) break;
    const frameSize = version === 2 ? (body[offset + 3] << 16 | body[offset + 4] << 8 | body[offset + 5]) : version === 4 ? synchsafe(body, offset + 4) : uint32(body, offset + 4);
    const start = offset + headerLength, end = start + frameSize;
    if (frameSize <= 0 || end > body.length) break;
    const frame = body.subarray(start, end);
    if (ID3_FIELDS[id] && !tags[ID3_FIELDS[id]]) tags[ID3_FIELDS[id]] = decodeText(frame.subarray(1), frame[0]);
    else if ((id === 'APIC' || id === 'PIC') && !tags.picture) tags.picture = readApic(frame, version);
    offset = end;
  }
  return tags;
}
function readApic(frame, version) {
  const encoding = frame[0]; let i = 1, mime;
  if (version === 2) { const format = latin1(frame.subarray(1, 4)).toLowerCase(); mime = format === 'png' ? 'image/png' : 'image/jpeg'; i = 4; }
  else { const zero = frame.indexOf(0, 1); mime = latin1(frame.subarray(1, zero)) || 'image/jpeg'; i = zero + 1; }
  i++; // picture type
  if (encoding === 1 || encoding === 2) { while (i + 1 < frame.length && !(frame[i] === 0 && frame[i + 1] === 0)) i += 2; i += 2; }
  else { while (i < frame.length && frame[i] !== 0) i++; i++; }
  if (!/^image\//.test(mime)) mime = mime.includes('png') ? 'image/png' : 'image/jpeg';
  return i < frame.length ? { mime, data: frame.slice(i) } : null;
}

export function readFlac(bytes) {
  if (bytes.length < 8 || latin1(bytes.subarray(0, 4)) !== 'fLaC') return null;
  const tags = {}; let offset = 4, last = false;
  while (!last && offset + 4 <= bytes.length) {
    const header = bytes[offset]; last = Boolean(header & 0x80);
    const type = header & 0x7f, length = bytes[offset + 1] << 16 | bytes[offset + 2] << 8 | bytes[offset + 3], start = offset + 4;
    if (start + length > bytes.length) break;
    const block = bytes.subarray(start, start + length), view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    if (type === 0 && length >= 18) { const rate = (block[10] << 12 | block[11] << 4 | block[12] >> 4); const samples = (block[13] & 0x0f) * 2 ** 32 + view.getUint32(14); if (rate) tags.duration = samples / rate; }
    if (type === 4) {
      const utf8 = new TextDecoder('utf-8'); let i = 4 + view.getUint32(0, true); const count = view.getUint32(i, true); i += 4;
      for (let c = 0; c < count && i + 4 <= block.length; c++) {
        const size = view.getUint32(i, true); i += 4; const entry = utf8.decode(block.subarray(i, i + size)); i += size;
        const eq = entry.indexOf('='); if (eq < 1) continue;
        const key = entry.slice(0, eq).toUpperCase(), value = entry.slice(eq + 1).trim();
        const field = { TITLE: 'title', ARTIST: 'artist', ALBUMARTIST: 'albumArtist', 'ALBUM ARTIST': 'albumArtist', ALBUM: 'album', TRACKNUMBER: 'track', DISCNUMBER: 'disc', DATE: 'year', YEAR: 'year', GENRE: 'genre' }[key];
        if (field && value && !tags[field]) tags[field] = value;
      }
    }
    if (type === 6 && !tags.picture) {
      let i = 4; const mimeLength = view.getUint32(i); i += 4; const mime = latin1(block.subarray(i, i + mimeLength)); i += mimeLength;
      const descLength = view.getUint32(i); i += 4 + descLength + 16; const dataLength = view.getUint32(i); i += 4;
      if (i + dataLength <= block.length) tags.picture = { mime: /^image\//.test(mime) ? mime : 'image/jpeg', data: block.slice(i, i + dataLength) };
    }
    offset = start + length;
  }
  return tags;
}
export function readTags(bytes) { try { return readId3(bytes) || readFlac(bytes) || {}; } catch { return {}; } }

const cleanName = (name) => String(name || '').replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
// "03 - Artist - Title" / "03. Title" → { track: 3, title }
export function parseFileName(name) {
  const base = cleanName(name), match = base.match(/^(\d{1,3})\s*[-._)\s]\s*(.+)$/);
  const rest = match ? match[2] : base, parts = rest.split(/\s+-\s+/);
  return { track: match ? Number(match[1]) : 0, title: (parts.length > 1 ? parts.slice(1).join(' - ') : rest).trim() || base, artist: parts.length > 1 ? parts[0].trim() : '' };
}
const number = (value) => { const n = parseInt(String(value || '').split('/')[0], 10); return Number.isFinite(n) && n > 0 ? n : 0; };

// [{ path, name, tags }] → albums, grouped by album + album artist (or folder).
export function groupAlbums(files) {
  const albums = new Map();
  for (const file of files) {
    const tags = file.tags || {}, guess = parseFileName(file.name), folder = String(file.path || '').split('/').slice(-2, -1)[0] || '';
    const artist = (tags.albumArtist || tags.artist || guess.artist || '').trim(), title = (tags.album || folder || '未命名专辑').trim();
    const key = `${title.toLowerCase()}\u0000${(tags.albumArtist || (tags.album ? '' : folder) || '').toLowerCase()}`;
    if (!albums.has(key)) albums.set(key, { key, title, artist: '', year: '', genre: '', picture: null, tracks: [] });
    const album = albums.get(key);
    if (!album.artist && artist) album.artist = artist;
    if (!album.year && /\d{4}/.test(tags.year || '')) album.year = tags.year.match(/\d{4}/)[0];
    if (!album.genre && tags.genre) album.genre = String(tags.genre).replace(/^\(\d+\)/, '').slice(0, 60);
    if (!album.picture && tags.picture) album.picture = tags.picture;
    album.tracks.push({ file: file.file, path: file.path, title: tags.title || guess.title, artist: tags.artist || artist, track: number(tags.track) || guess.track, disc: number(tags.disc) || 1, duration: Number(tags.duration) || 0 });
  }
  return [...albums.values()].map((album) => ({ ...album, artist: album.artist || '未知歌手', tracks: album.tracks.sort((a, b) => a.disc - b.disc || (a.track || 999) - (b.track || 999) || a.path.localeCompare(b.path, 'zh')) }));
}
