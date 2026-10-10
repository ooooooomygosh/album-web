export { handleQQSearch, handleQQSongUrl, getQQLoginInfo, parseCookieString, qqCookieUin, qqCookieMusicKey } from './vendor/simple-music/server/lib/qq-client';
export { handleSearch, handleSongUrl, normalizeLoginInfo, call, audioProxyHeadersFor } from './vendor/simple-music/server/lib/netease-client';

// Flow Cabin adapter: stored cookies are not proof of an authenticated account.
import { call as ncmCall, normalizeLoginInfo as normalizeNcmLogin, asObj } from './vendor/simple-music/server/lib/netease-client';
export async function getNeteaseLoginInfo(cookie: string) {
  if (!cookie) return { loggedIn: false };
  for (const endpoint of ['login_status', 'user_account']) {
    try {
      const response = await ncmCall(endpoint, { cookie, timestamp: Date.now() });
      const body = asObj(response.body), data = asObj(body.data || body);
      if (response.status >= 400 || (data.code != null && Number(data.code) !== 200) || (body.code != null && Number(body.code) !== 200)) continue;
      const info = normalizeNcmLogin(data.profile || body.profile, data.account || body.account, data);
      if (info.loggedIn) return info;
    } catch { /* No entitlement is inferred from an unavailable status endpoint. */ }
  }
  return { loggedIn: false };
}

// ---------- Flow Cabin: "my playlists" for the playlist library ----------
// QQ already has user / playlist handlers in Simple Music; NetEase needs a thin
// adapter over NeteaseCloudMusicApi's user_playlist / playlist_detail /
// playlist_track_all. Everything is mapped to the same plain shape.
export { handleQQUserPlaylists, handleQQPlaylistTracks } from './vendor/simple-music/server/lib/qq-client';
import { mapSongRecord, isNeteaseSongAvailable, asArr, asStr, asNum } from './vendor/simple-music/server/lib/netease-client';

const NCM_PLAYLIST_LIMIT = 1000, NCM_PAGE = 500;
const ok = (response: { status: number, body: Record<string, unknown> }) => response.status < 400 && (response.body?.code == null || Number(response.body.code) === 200);
const httpsCover = (value: unknown) => asStr(value).replace(/^http:\/\//, 'https://');

export async function neteaseUserPlaylists(cookie: string) {
  const info = await getNeteaseLoginInfo(cookie) as { loggedIn?: boolean, userId?: unknown, nickname?: unknown };
  const uid = asStr(info.userId);
  if (!info.loggedIn || !uid) return { loggedIn: false, provider: 'netease', playlists: [] };
  const playlists: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 600; offset += 100) {
    const response = await ncmCall('user_playlist', { uid, limit: 100, offset, cookie, timestamp: Date.now() });
    if (!ok(response)) throw new Error('网易云歌单读取失败，请重新登录后再试。');
    const page = asArr(response.body.playlist);
    for (const raw of page) {
      const pl = asObj(raw), creator = asObj(pl.creator);
      playlists.push({ provider: 'netease', id: asStr(pl.id), name: asStr(pl.name), cover: httpsCover(pl.coverImgUrl), trackCount: asNum(pl.trackCount), creator: asStr(creator.nickname),
        kind: Number(pl.specialType) === 5 ? 'liked' : pl.subscribed || asStr(creator.userId) !== uid ? 'collect' : 'created' });
    }
    if (!response.body.more || page.length < 100) break;
  }
  return { loggedIn: true, provider: 'netease', user: asStr(info.nickname), playlists: playlists.filter((pl) => pl.id && pl.name) };
}

export async function neteasePlaylistTracks(cookie: string, id: string) {
  if (!/^\d{1,20}$/.test(id)) throw new Error('网易云歌单 ID 无效。');
  const detail = await ncmCall('playlist_detail', { id, s: 0, cookie, timestamp: Date.now() });
  if (!ok(detail)) throw new Error(Number(detail.body?.code) === 404 ? '找不到这个网易云歌单，可能已删除或设为私密。' : '网易云歌单读取失败，请稍后再试。');
  const pl = asObj(detail.body.playlist), creator = asObj(pl.creator);
  const total = Math.min(NCM_PLAYLIST_LIMIT, asNum(pl.trackCount) || asArr(pl.trackIds).length);
  const tracks: Record<string, unknown>[] = [];
  for (let offset = 0; offset < total; offset += NCM_PAGE) {
    const response = await ncmCall('playlist_track_all', { id, limit: NCM_PAGE, offset, cookie, timestamp: Date.now() });
    if (!ok(response)) break;
    const privileges = new Map(asArr(response.body.privileges).map((p) => [asStr(asObj(p).id), asObj(p)]));
    const songs = asArr(response.body.songs);
    for (const raw of songs) {
      const song = asObj(raw), mapped = mapSongRecord(song), privilege = privileges.get(asStr(song.id));
      tracks.push({ id: asStr(mapped.id), name: asStr(mapped.name), artist: mapped.artist, album: mapped.album, cover: httpsCover(mapped.cover), duration: mapped.duration, fee: mapped.fee,
        playable: isNeteaseSongAvailable({ ...song, privilege }) });
    }
    if (songs.length < NCM_PAGE) break;
  }
  return { provider: 'netease', playlist: { provider: 'netease', id, name: asStr(pl.name), cover: httpsCover(pl.coverImgUrl), trackCount: asNum(pl.trackCount) || tracks.length, creator: asStr(creator.nickname), description: asStr(pl.description).slice(0, 600) }, tracks };
}
