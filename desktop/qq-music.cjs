'use strict';

const QQ_API = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const SEARCH_MODULE = 'music.search.SearchCgiService';
const validMid = (value) => /^[A-Za-z0-9]{1,32}$/.test(String(value || ''));

function extractLink(input) {
  return String(input || '').match(/https?:\/\/[^\s<>"'，。；！？）】]+/i)?.[0] || '';
}

function isQQUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && !url.username && !url.password
      && (url.hostname === 'y.qq.com' || url.hostname.endsWith('.y.qq.com') || url.hostname === 'qqmusic.qq.com');
  } catch { return false; }
}

function albumIdentity(input) {
  if (!isQQUrl(input)) return null;
  const url = new URL(input);
  const mid = url.pathname.match(/\/albumDetail\/([A-Za-z0-9]+)/i)?.[1]
    || url.pathname.match(/\/album\/([A-Za-z0-9]+)(?:\.html)?/i)?.[1]
    || url.searchParams.get('albummid') || url.searchParams.get('albumMid');
  const id = url.searchParams.get('albumid') || url.searchParams.get('albumId')
    || ((url.searchParams.get('type') === 'album' || /album/i.test(url.pathname)) ? url.searchParams.get('id') : null);
  if (mid && validMid(mid)) return { mid, id: '' };
  if (id && /^\d{1,12}$/.test(id)) return { mid: '', id };
  if (id && validMid(id)) return { mid: id, id: '' };
  return null;
}

function coverFor(mid, pmid = '') {
  if (!validMid(mid)) return '';
  const imageId = /^[A-Za-z0-9_]{1,48}$/.test(pmid) ? pmid : mid;
  return `https://y.gtimg.cn/music/photo_new/T002R800x800M000${imageId}.jpg`;
}

function songCandidate(row) {
  const song = row.songInfo || row;
  if (!validMid(song.mid) || !(song.title || song.name)) return null;
  const url = `https://y.qq.com/n/ryqq/songDetail/${song.mid}`;
  const album = song.album || {};
  const title = song.title || song.name;
  return {
    id: `qq-song-${song.mid}`, type: 'song', title,
    artist: (song.singer || []).map((singer) => singer.name).filter(Boolean).join(' / '),
    albumTitle: album.title || album.name || '', year: String(song.time_public || album.time_public || '').slice(0, 4),
    source: 'QQ 音乐', confidenceLabel: 'QQ 曲库关键词候选',
    cover: coverFor(album.mid, album.pmid), coverSource: 'QQ 音乐',
    externalId: song.mid, externalIds: { qqSongMid: song.mid, qqAlbumMid: album.mid || '' },
    tracks: [title], trackDetails: [{ title, discNumber: Number(song.index_cd || 0) + 1, trackNumber: Number(song.index_album || 1), lengthMillis: Number(song.interval || 0) * 1000, source: 'QQ 音乐', providerId: song.mid, mediaMid: validMid(song.file?.media_mid) ? song.file.media_mid : '' }],
    trackViewUrl: url, collectionViewUrl: validMid(album.mid) ? `https://y.qq.com/n/ryqq/albumDetail/${album.mid}` : '',
    providerLinks: [
      { provider: 'qqMusic', type: 'track', url, providerId: song.mid, confidence: 'exact', source: 'qq' },
      ...(validMid(album.mid) ? [{ provider: 'qqMusic', type: 'album', url: `https://y.qq.com/n/ryqq/albumDetail/${album.mid}`, providerId: album.mid, confidence: 'exact', source: 'qq' }] : [])
    ],
    metadataCompleteness: { hasTracks: true, hasCover: Boolean(album.mid), trackCountMatches: true, sourcesUsed: ['QQ 音乐'] },
    platforms: ['QQ 音乐'], palette: ['#387c76', '#74c2b4', '#dce5c7'], tags: ['song', 'qq'],
    context: '来自 QQ 音乐曲库的歌曲，请核对歌手和专辑版本。'
  };
}

function createQQMusic(fetcher) {
  const cache = new Map();
  async function cached(key, work) {
    const entry = cache.get(key);
    if (entry && entry.until > Date.now()) return entry.value;
    const value = await work();
    if (cache.size >= 128) cache.delete(cache.keys().next().value);
    cache.set(key, { value, until: Date.now() + 5 * 60 * 1000 });
    return value;
  }

  async function rpc(module, method, param) {
    return cached(JSON.stringify([module, method, param]), async () => {
      const payload = { [module]: { module, method, param } };
      const isSearch = module === SEARCH_MODULE;
      const body = JSON.stringify(payload);
      const url = isSearch ? QQ_API : `${QQ_API}?data=${encodeURIComponent(body)}`;
      const maxAttempts = isSearch ? 5 : 2;
      // One overall deadline bounds retries as well as the network request.
      const signal = AbortSignal.timeout(isSearch ? 15000 : 12000);
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        signal.throwIfAborted();
        const response = await fetcher(url, {
          ...(isSearch ? { method: 'POST', body } : {}),
          headers: { Referer: 'https://y.qq.com/', ...(isSearch ? { 'Content-Type': 'application/json' } : {}) },
          credentials: 'omit', signal
        });
        if (!response.ok) throw new Error(`QQ 音乐暂时无法访问（HTTP ${response.status}），请稍后重试。`);
        const result = await response.json();
        const part = result[module];
        const emptySuccess = result.code === 0 && part?.code === 0 && !part.data;
        // Search intermittently returns 2001; retry only this known transient
        // reply, or one empty success. Never retry authorization or HTTP errors.
        const transientSearch = isSearch && result.code === 0 && part?.code === 2001;
        if ((transientSearch || (emptySuccess && attempt === 0)) && attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }
        if (result.code !== 0 || !part || part.code !== 0 || !part.data || (typeof part.data.code === 'number' && part.data.code !== 0)) {
          const code = Number(result.code) || Number(part?.code) || Number(part?.data?.code) || '';
          throw new Error(`QQ 音乐没有返回可用数据${code ? `（业务码 ${code}）` : ''}，请稍后重试。`);
        }
        return part.data;
      }
    });
  }

  async function resolveLink(input) {
    const original = extractLink(input);
    if (!isQQUrl(original)) throw new Error('请提供 QQ 音乐专辑分享链接，或改用歌手和专辑名称搜索。');
    return cached(`link:${original}`, async () => {
      let url = original;
      for (let hop = 0; hop < 6; hop++) {
        const identity = albumIdentity(url);
        if (identity) return { ...identity, url };
        const response = await fetcher(url, { redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(12000) });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) break;
          const next = new URL(location, url);
          if (next.protocol === 'http:') next.protocol = 'https:';
          if (!isQQUrl(next.href)) throw new Error('QQ 分享链接跳转到了非 QQ 音乐地址，已停止解析。');
          url = next.href;
          continue;
        }
        if (!response.ok) throw new Error(`QQ 分享链接暂时无法打开（HTTP ${response.status}）。`);
        const html = await response.text();
        const canonical = html.match(/https:\/\/y\.qq\.com\/n\/ryqq\/albumDetail\/[A-Za-z0-9]+/)?.[0];
        if (canonical && albumIdentity(canonical)) return { ...albumIdentity(canonical), url: canonical };
        break;
      }
      throw new Error('该 QQ 链接未包含可确认的专辑编号。请复制专辑页面的分享链接，或用专辑名称搜索；不会改用 iTunes 猜测。');
    });
  }

  async function album(identity, exact = false) {
    const detail = await rpc('music.musichallAlbum.AlbumInfoServer', 'GetAlbumDetail', identity.mid ? { albumMId: identity.mid } : { albumId: Number(identity.id) });
    const info = detail.basicInfo || {};
    const mid = info.albumMid;
    if (!validMid(mid) || !info.albumName) throw new Error('QQ 音乐未返回这张专辑的有效信息。');
    if (identity.mid && mid !== identity.mid) throw new Error('QQ 返回的专辑编号与分享链接不一致，已停止匹配。');
    if (identity.id && Number(info.albumID) !== Number(identity.id)) throw new Error('QQ 返回的专辑编号与分享链接不一致，已停止匹配。');
    const tracks = [];
    let total = 0;
    for (let begin = 0; begin < 2000; begin += 100) {
      const page = await rpc('music.musichallAlbum.AlbumSongList', 'GetAlbumSongList', { albumMid: mid, albumID: 0, begin, num: 100, order: 2 });
      if (page.albumMid && page.albumMid !== mid) throw new Error('QQ 曲目列表与当前专辑不一致。');
      total = Number(page.totalNum || 0);
      const rows = page.songList || [];
      if (!rows.length) break;
      for (const row of rows) {
        const song = row.songInfo || row;
        if (song.album?.mid && song.album.mid !== mid) throw new Error('QQ 返回了其他专辑的曲目，已停止匹配。');
        tracks.push({ title: song.title || song.name || '', position: String(tracks.length + 1), discNumber: Number(song.index_cd || 0) + 1, trackNumber: Number(song.index_album || tracks.length + 1), lengthMillis: Number(song.interval || 0) * 1000, source: 'QQ 音乐', providerId: song.mid || '', mediaMid: validMid(song.file?.media_mid) ? song.file.media_mid : '' });
      }
      if (tracks.length >= total || rows.length < 100) break;
    }
    if (!tracks.length || (total && tracks.length !== total) || tracks.some((track) => !track.title)) throw new Error('QQ 专辑曲目没有读取完整，请重新搜索。');
    const url = `https://y.qq.com/n/ryqq/albumDetail/${mid}`;
    const cover = coverFor(mid, info.pmid);
    return {
      id: `qq-album-${mid}`, type: 'album', title: info.albumName,
      artist: (detail.singer?.singerList || []).map((singer) => singer.name).filter(Boolean).join(' / '),
      albumTitle: info.albumName, year: String(info.publishDate || '').slice(0, 4), releaseDate: info.publishDate || '', label: detail.company?.name || '',
      cover, coverSource: 'QQ 音乐', source: 'QQ 音乐', confidenceLabel: exact ? '链接精确定位' : 'QQ 曲库关键词候选',
      externalId: mid, externalIds: { qqAlbumMid: mid, qqAlbumId: String(info.albumID || '') },
      tracks: tracks.map((track) => track.title), trackDetails: tracks, expectedTrackCount: total || tracks.length,
      match: exact ? 100 : 0, confidence: exact ? 100 : 0,
      platforms: ['QQ 音乐'], palette: ['#387c76', '#74c2b4', '#dce5c7'], tags: ['album', 'qq', info.genreNew || 'music'],
      collectionViewUrl: url, providerLinks: [{ provider: 'qqMusic', type: 'album', url, providerId: mid, confidence: 'exact', source: 'qq' }],
      sources: [{ provider: 'QQ 音乐', id: mid, url }],
      metadataCompleteness: { hasTracks: true, hasCover: Boolean(cover), trackCountMatches: true, sourcesUsed: ['QQ 音乐'] },
      context: `来自 QQ 音乐的《${info.albumName}》，含 ${tracks.length} 首曲目。请核对歌手与发行版本。`
    };
  }

  async function search(params) {
    const term = String(params.get('term') || '').trim().slice(0, 160);
    const link = params.get('link') || extractLink(term);
    if (link) return { provider: 'QQ 音乐', candidates: [await album(await resolveLink(link), true)] };
    if (!term) throw new Error('请输入歌手、专辑或歌曲名称。');
    const type = params.get('type') || 'all';
    const kinds = type === 'album' ? [2] : type === 'song' ? [0] : [2, 0];
    const batches = await Promise.allSettled(kinds.map((search_type) => rpc(SEARCH_MODULE, 'DoSearchForQQMusicDesktop', { query: term, search_type, page_num: 1, num_per_page: 6 })));
    if (batches.every((batch) => batch.status === 'rejected')) throw batches[0].reason;
    const candidates = [], warnings = [];
    for (let index = 0; index < kinds.length; index++) {
      if (batches[index].status === 'rejected') { warnings.push(`${kinds[index] === 0 ? '单曲' : '专辑'}查询暂时不可用，已显示可读取的 QQ 结果，请稍后重试。`); continue; }
      const batch = batches[index].value;
      if (kinds[index] === 0) candidates.push(...(batch.body?.song?.list || []).map(songCandidate).filter(Boolean));
      else {
        const rows = (batch.body?.album?.list || []).filter((row) => validMid(row.albumMID));
        for (let offset = 0; offset < rows.length; offset += 2) {
          const details = await Promise.allSettled(rows.slice(offset, offset + 2).map((row) => album({ mid: row.albumMID })));
          for (const detail of details) {
            if (detail.status === 'fulfilled') candidates.push(detail.value);
            else warnings.push('部分 QQ 专辑详情暂时无法读取，请重试或粘贴对应专辑链接。');
          }
        }
        if (rows.length && !candidates.length && kinds.length === 1) throw new Error('QQ 搜索返回了专辑，但未能读取完整详情，请重试。');
      }
    }
    return { provider: 'QQ 音乐', candidates, warnings: [...new Set(warnings)] };
  }

  return { search, resolveLink };
}

module.exports = { createQQMusic, extractLink, isQQUrl, albumIdentity, songCandidate, coverFor };
