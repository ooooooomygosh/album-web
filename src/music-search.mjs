export function buildSearchInput({ query = '', artistQuery = '', link = '', provider = 'qq', type = 'all' } = {}) {
  const title = String(query).trim();
  const artist = String(artistQuery).trim();
  const explicit = String(link).trim();
  const possibleLink = (explicit || title).match(/https?:\/\/[^\s<>"'，。；！？）】]+/i)?.[0] || '';
  if (possibleLink) {
    const url = new URL(possibleLink);
    if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname === 'y.qq.com' || url.hostname.endsWith('.y.qq.com') || url.hostname === 'qqmusic.qq.com')) {
      throw new Error('目前支持 QQ 音乐专辑分享链接；其他平台请用名称搜索。');
    }
    return { term: possibleLink, title: '', artist: '', link: possibleLink, provider: 'qq', type };
  }
  const term = explicit || [artist, title].filter(Boolean).join(' ');
  if (!term) throw new Error('请输入歌手、专辑或歌曲名称。');
  return { term, title: explicit || title, artist, link: '', provider, type };
}
