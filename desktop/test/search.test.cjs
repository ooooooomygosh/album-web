'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createQQMusic, albumIdentity, isQQUrl, extractLink, songCandidate } = require('../qq-music.cjs');
const { createSiteRouter } = require('../site-router.cjs');
const mid = '000MkMni19ClKG';
const albumUrl = `https://y.qq.com/n/ryqq/albumDetail/${mid}`;

test('artist and album names require no link, and QQ links override catalog selection', async () => {
  const { buildSearchInput } = await import(pathToFileURL(path.resolve(__dirname, '../../src/music-search.mjs')));
  assert.deepEqual(buildSearchInput({ query: '叶惠美', artistQuery: '周杰伦' }), { term: '周杰伦 叶惠美', title: '叶惠美', artist: '周杰伦', link: '', provider: 'qq', type: 'all' });
  assert.equal(buildSearchInput({ link: '周杰伦' }).term, '周杰伦');
  assert.equal(buildSearchInput({ query: `分享专辑 ${albumUrl}`, provider: 'itunes' }).provider, 'qq');
  assert.throws(() => buildSearchInput({ query: 'https://evil.test/album' }), /QQ/);
});

test('QQ identity recognizes modern, legacy and numeric links and rejects lookalikes', () => {
  assert.deepEqual(albumIdentity(albumUrl), { mid, id: '' });
  assert.deepEqual(albumIdentity(`https://y.qq.com/n/yqq/album/${mid}.html`), { mid, id: '' });
  assert.deepEqual(albumIdentity('https://i.y.qq.com/n2/m/share/details/album.html?albumid=8220'), { mid: '', id: '8220' });
  assert.deepEqual(albumIdentity(`https://y.qq.com/n2/m/share/details/album.html?albummid=${mid}`), { mid, id: '' });
  for (const url of ['https://y.qq.com.evil.test', 'https://user:password@y.qq.com/', 'https://evil.test/?qq=y.qq.com', 'http://y.qq.com/']) assert.equal(isQQUrl(url), false);
  assert.equal(extractLink(`我分享了专辑 ${albumUrl}。`), albumUrl);
});

function mockQQ({ wrongIdentity = false, incompleteTracks = false, failSongSearch = false } = {}) {
  return createQQMusic(async (url, options) => {
    const payload = JSON.parse(options.body || new URL(url).searchParams.get('data'));
    const module = Object.keys(payload)[0];
    const method = payload[module].method;
    if (method === 'DoSearchForQQMusicDesktop') {
      if (failSongSearch && payload[module].param.search_type === 0) return Response.json({ code: 0, [module]: { code: 500, data: null } });
      return Response.json({ code: 0, [module]: { code: 0, data: { body: { album: { list: [{ albumMID: mid }] }, song: { list: [] } } } } });
    }
    let data;
    if (method === 'GetAlbumDetail') data = { basicInfo: { albumMid: wrongIdentity ? 'anotherMid' : mid, albumID: 8220, albumName: '叶惠美', publishDate: '2003-07-31', pmid: `${mid}_5` }, singer: { singerList: [{ name: '周杰伦' }] }, company: { name: '杰威尔音乐有限公司' } };
    else if (method === 'GetAlbumSongList') data = { albumMid: mid, totalNum: incompleteTracks ? 11 : 2, songList: ['以父之名', '懦夫'].map((title, index) => ({ songInfo: { title, album: { mid }, mid: `song${index}`, index_album: index + 1 } })) };
    else throw new Error('Unexpected QQ request');
    return Response.json({ code: 0, [module]: { code: 0, data } });
  });
}

test('QQ album link returns only its exact provider identity, cover and ordered tracks', async () => {
  const result = await mockQQ().search(new URLSearchParams({ term: albumUrl, type: 'album' }));
  assert.equal(result.candidates.length, 1);
  const album = result.candidates[0];
  assert.equal(album.externalIds.qqAlbumMid, mid);
  assert.equal(album.source, 'QQ 音乐');
  assert.ok(album.cover.includes(`${mid}_5`));
  assert.deepEqual(album.tracks, ['以父之名', '懦夫']);
  assert.equal(album.confidenceLabel, '链接精确定位');
  const song = songCandidate({ mid: 'testSongMid', title: '晴天', singer: [{ name: '周杰伦' }], album: { mid, title: '叶惠美' } });
  assert.ok(song.providerLinks.some((link) => link.type === 'album' && link.url === albumUrl && link.provider === 'qqMusic'));
  assert.ok(song.providerLinks.every((link) => link.provider === 'qqMusic'));
  await assert.rejects(mockQQ({ wrongIdentity: true }).search(new URLSearchParams({ term: albumUrl })), /编号.*不一致/);
  await assert.rejects(mockQQ({ incompleteTracks: true }).search(new URLSearchParams({ term: albumUrl })), /读取完整/);
});

test('short share links follow QQ redirects only', async () => {
  const short = 'https://c6.y.qq.com/base/fcgi-bin/u?__=test';
  const qq = createQQMusic(async () => new Response(null, { status: 302, headers: { Location: albumUrl } }));
  assert.equal((await qq.resolveLink(short)).mid, mid);
  const blocked = createQQMusic(async () => new Response(null, { status: 302, headers: { Location: 'https://evil.test/' } }));
  await assert.rejects(blocked.resolveLink(short), /非 QQ/);
});

test('all-type QQ search retains complete albums when the song service fails', async () => {
  const result = await mockQQ({ failSongSearch: true }).search(new URLSearchParams({ term: '叶惠美', type: 'all' }));
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].source, 'QQ 音乐');
  assert.deepEqual(result.candidates[0].tracks, ['以父之名', '懦夫']);
  assert.ok(result.warnings[0].includes('单曲查询暂时不可用'));
});

test('transient QQ search 2001 retries and caches only the recovered success', async () => {
  const module = 'music.search.SearchCgiService';
  let requests = 0;
  const qq = createQQMusic(async (url, options) => {
    assert.equal(url, 'https://u.y.qq.com/cgi-bin/musicu.fcg');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    assert.equal(JSON.parse(options.body)[module].param.query, '恢复测试');
    requests += 1;
    return Response.json({ code: 0, [module]: requests === 1 ? { code: 2001, data: { body: {} } } : { code: 0, data: { code: 0, body: { song: { list: [] } } } } });
  });
  const params = new URLSearchParams({ term: '恢复测试', type: 'song' });
  assert.deepEqual((await qq.search(params)).candidates, []);
  await qq.search(params);
  assert.equal(requests, 2);
});

test('QQ retries stop at the limit and never retry HTTP or other business errors', async () => {
  const module = 'music.search.SearchCgiService';
  const params = new URLSearchParams({ term: '失败测试', type: 'song' });
  for (const [response, expectedCalls, expectedError] of [
    [{ code: 0, [module]: { code: 2001, data: {} } }, 5, /2001/],
    [{ code: 0, [module]: { code: 1000, data: {} } }, 1, /1000/],
    [{ code: 0, [module]: { code: 0, data: { code: 42, body: {} } } }, 1, /42/],
    [null, 1, /HTTP 429/]
  ]) {
    let requests = 0;
    const qq = createQQMusic(async () => { requests += 1; return response ? Response.json(response) : new Response(null, { status: 429 }); });
    await assert.rejects(qq.search(params), expectedError);
    assert.equal(requests, expectedCalls);
  }
});

test('QQ failure never falls through to iTunes; original auth request remains unchanged', async () => {
  const forwarded = [];
  const router = createSiteRouter({ webRoot: path.join(__dirname, 'fixtures/web'), qq: { search: async () => { throw new Error('QQ unavailable'); } }, forward: async (request) => { forwarded.push(request); return Response.json({ forwarded: true }); } });
  const failed = await router(new Request(`https://album-circle.vercel.app/api/search?provider=qq&term=${encodeURIComponent(albumUrl)}`));
  assert.equal(failed.status, 502); assert.equal(forwarded.length, 0);
  const original = new Request('https://album-circle.vercel.app/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Token': 'test-only' }, body: JSON.stringify({ action: 'login' }) });
  await router(original);
  assert.equal(forwarded[0], original);
  assert.equal(forwarded[0].headers.get('X-Session-Token'), 'test-only');
  assert.equal((await router(new Request('https://album-circle.vercel.app/%2e%2e/main.cjs'))).status, 404);
  assert.equal((await router(new Request('https://album-circle.vercel.app/'))).status, 200);
});
