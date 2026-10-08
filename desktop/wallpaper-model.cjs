'use strict';
const string = (value, max = 300) => typeof value === 'string' ? value.slice(0, max).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '') : '';
function safeCover(value) {
  try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password || url.port) return ''; return url.href.length <= 4000 ? url.href : ''; } catch { return ''; }
}
function item(value) {
  if (!value || typeof value !== 'object' || !string(value.id)) return null;
  return { id: string(value.id), title: string(value.title), artist: string(value.artist), type: value.type === 'song' ? 'song' : 'album', cover: safeCover(value.cover), tracks: Array.isArray(value.tracks) ? value.tracks.slice(0, 500).map((track) => string(typeof track === 'string' ? track : track?.title)).filter(Boolean) : [] };
}
const colour = (value, fallback) => /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
function cleanSnapshot(value) {
  if (!value || typeof value !== 'object' || !['warm', 'pixel'].includes(value.look)) return null;
  const record = item(value.record), style = value.recordStyle || {}, tracks = record?.tracks.length || 0;
  return { look: value.look, roomName: string(value.roomName, 120), startRow: Number.isSafeInteger(value.startRow) ? Math.max(0, Math.min(100000, value.startRow)) : 0,
    items: Array.isArray(value.items) ? value.items.slice(0, 12).map(item).filter(Boolean) : [], selectedId: string(value.selectedId), record,
    recordStyle: { base: colour(style.base, '#16191d'), opacity: Number.isFinite(style.opacity) ? Math.max(0, Math.min(100, style.opacity)) : 100, splatter: style.splatter === true, splashes: (Array.isArray(style.splashes) && style.splashes.length ? style.splashes : ['#dba746']).slice(0, 3).map((v) => colour(v, '#dba746')) },
    spinning: Boolean(record && value.spinning === true), trackIndex: Math.max(0, Math.min(tracks - 1, Number.isSafeInteger(value.trackIndex) ? value.trackIndex : 0)), reduceMotion: value.reduceMotion === true,
    statusText: string(value.statusText, 200), actualTrack: string(value.actualTrack), provider: ['qq', 'netease', 'ma'].includes(value.provider) ? value.provider : 'visual' };
}
module.exports = { cleanSnapshot };
