export function exactTrack(item, index, provider) {
  if (provider !== 'qq') return null;
  const detail = item?.trackDetails?.[index], mid = detail?.providerId || (item?.type === 'song' ? item.externalIds?.qqSongMid : '');
  return /^[a-z\d]{14}$/i.test(mid || '') ? { id: mid, provider: 'qq', title: item.tracks?.[index] || item.title, artist: item.artist } : null;
}
export async function musicRequest(path, value, signal) {
  const response = await fetch('/desktop-music' + path, { signal, ...(value === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) });
  const result = await response.json(); if (!response.ok || result.error) throw new Error(result.error || '音源请求失败，请稍后重试。'); return result;
}
