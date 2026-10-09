export function exactTrack(item, index, provider) {
  if (provider === 'local') {
    const detail = item?.trackDetails?.[index];
    return detail?.source === 'local' && /^[a-f\d]{16}$/.test(detail.providerId || '') ? { id: detail.providerId, provider: 'local', title: detail.title, artist: item.artist } : null;
  }
  if (provider !== 'qq') return null;
  const detail = item?.trackDetails?.[index], mid = detail?.providerId || (item?.type === 'song' ? item.externalIds?.qqSongMid : '');
  return /^[a-z\d]{14}$/i.test(mid || '') ? { id: mid, provider: 'qq', title: item.tracks?.[index] || item.title, artist: item.artist } : null;
}
// Metadata scans can take minutes on large folders; ordinary network calls
// retain a short timeout. Aborting a request does not cancel a native scan.
export const musicRequestTimeout = (path) => ['/local/rescan', '/local/remove-folder'].includes(path) ? 10 * 60 * 1000 : 20000;
export async function musicRequest(path, value, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, musicRequestTimeout(path));
  try {
    const response = await fetch('/desktop-music' + path, { signal: controller.signal, ...(value === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) });
    let result;
    try { result = await response.json(); } catch { throw new Error('音源服务未返回有效数据，请检查桌面客户端与连接。'); }
    if (!response.ok || result?.error) throw new Error(result?.error || '音源请求失败，请稍后重试。');
    if (!result || typeof result !== 'object') throw new Error('音源服务返回了无效数据。');
    return result;
  } catch (error) {
    if (timedOut) throw new Error('音源请求超时，请检查连接后重试。');
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

// Builds a collection item from a scanned local album. Track ids let the
// turntable play the exact files; the cover stays local unless replaced.
export function localAlbumItem(album) {
  return { type: 'album', title: album.title, artist: album.artist, year: album.year || '', cover: album.cover || '', label: '本地音乐', platforms: ['本地文件'], source: 'local-music',
    tracks: album.tracks.slice(0, 60).map((track) => track.title), externalIds: { localAlbum: album.id },
    trackDetails: album.tracks.slice(0, 60).map((track, index) => ({ title: track.title, trackNumber: index + 1, lengthMillis: (track.duration || 0) * 1000, source: 'local', providerId: track.id })) };
}
