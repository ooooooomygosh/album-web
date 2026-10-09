export function exactTrack(item, index, provider) {
  if (provider === 'local') {
    const detail = item?.trackDetails?.[index];
    return detail?.source === 'local' && /^[a-f\d]{16}$/.test(detail.providerId || '') ? { id: detail.providerId, provider: 'local', title: detail.title, artist: item.artist } : null;
  }
  if (provider !== 'qq') return null;
  const detail = item?.trackDetails?.[index], mid = detail?.providerId || (item?.type === 'song' ? item.externalIds?.qqSongMid : '');
  return /^[a-z\d]{14}$/i.test(mid || '') ? { id: mid, provider: 'qq', title: item.tracks?.[index] || item.title, artist: item.artist, mediaMid: /^[a-z\d]{14}$/i.test(detail?.mediaMid || '') ? detail.mediaMid : '' } : null;
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

const normalized = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const versions = (value) => (String(value || '').toLowerCase().match(/live|remix|acoustic|instrumental|karaoke|现场|伴奏|翻唱|混音|重混|不插电|纯音乐/g) || []).sort().join('|');
export function rankCandidates(candidates, record, index) {
  const raw = record?.tracks?.[index], title = typeof raw === 'string' ? raw : raw?.title || raw?.name || record?.title;
  const target = normalized(title), artist = normalized(record?.artist);
  return candidates.map((candidate) => {
    // A live performance or cover is not silently substituted for a studio recording.
    const correctVersion = versions(candidate.title) === versions(title);
    const sameTitle = normalized(candidate.title) === target;
    const candidateArtist = normalized(candidate.artist);
    const artistParts = String(candidate.artist || '').split(/[,，、/&;；]|\s+(?:feat\.?|ft\.?|with)\s+/i).map(normalized);
    const sameArtist = artist && candidateArtist && (candidateArtist === artist || artistParts.includes(artist));
    const sameAlbum = normalized(candidate.album) && normalized(candidate.album) === normalized(record?.title);
    return { candidate, score: correctVersion && sameTitle && (sameArtist || (candidate.provider === 'local' && !candidateArtist && sameAlbum)) ? 100 + (sameAlbum ? 20 : 0) : 0 };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).map(({ candidate }) => candidate);
}

export async function findPlayableSource({ record, index, provider, request, play, isCurrent = () => true }) {
  const tried = new Set(), candidates = [];
  let lastError = '', hadMatches = false;
  const attempt = async (candidate) => {
    const key = `${candidate.provider}:${candidate.id}`;
    if (!isCurrent() || tried.has(key)) return false;
    tried.add(key); hadMatches = true;
    try {
      const result = await request('/resolve', candidate);
      if (!isCurrent()) return false;
      await play(candidate, result);
      return isCurrent();
    } catch (error) {
      if (!isCurrent() || error.name === 'AbortError') return false;
      lastError = error.name === 'NotAllowedError' ? '请点击播放按钮开始播放。' : error.message;
      // Browser gesture restrictions are not a reason to try unrelated recordings.
      if (error.name === 'NotAllowedError') throw error;
      return false;
    }
  };
  const providers = provider === 'auto' || provider === 'qq' ? ['qq', 'netease'] : provider === 'netease' ? ['netease', 'qq'] : [provider];
  const raw = record?.tracks?.[index], name = typeof raw === 'string' ? raw : raw?.title || raw?.name;
  if (!name) return { candidates: [], error: '原始资料没有曲目，无法定位音频。' };
  for (const source of providers) {
    if (!isCurrent()) return null;
    const exact = exactTrack(record, index, source);
    if (exact && await attempt(exact)) return { candidate: exact, candidates: [] };
    if (!isCurrent()) return null;
    try {
      const result = await request(`/search?provider=${source}&query=${encodeURIComponent(`${record.artist} ${name}`)}`);
      if (!isCurrent()) return null;
      const found = Array.isArray(result.candidates) ? result.candidates : [];
      candidates.push(...found);
      for (const candidate of rankCandidates(found, record, index)) {
        if (await attempt(candidate)) return { candidate, candidates: [] };
        if (!isCurrent()) return null;
      }
    } catch (error) {
      if (!isCurrent() || error.name === 'AbortError') return null;
      if (error.name === 'NotAllowedError') throw error;
      lastError = error.message;
    }
  }
  return { candidates, error: hadMatches ? `匹配的音源暂时不可播放。${lastError}` : lastError || (provider === 'local' ? '本地音乐里没有找到这首歌，请先在音源设置中添加文件夹。' : '未找到可播放的同版本音源，可切换音源或手动选择。') };
}

// Builds a collection item from a scanned local album. Track ids let the
// turntable play the exact files; the cover stays local unless replaced.
export function localAlbumItem(album) {
  return { type: 'album', title: album.title, artist: album.artist, year: album.year || '', cover: album.cover || '', label: '本地音乐', platforms: ['本地文件'], source: 'local-music',
    tracks: album.tracks.slice(0, 60).map((track) => track.title), externalIds: { localAlbum: album.id },
    trackDetails: album.tracks.slice(0, 60).map((track, index) => ({ title: track.title, trackNumber: index + 1, lengthMillis: (track.duration || 0) * 1000, source: 'local', providerId: track.id })) };
}
