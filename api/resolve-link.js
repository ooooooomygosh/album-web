import { json } from './_firebase.js';

function resolveInput(raw) {
  const input = String(raw || '').trim();
  if (!input) throw new Error('Missing input');

  let url;
  try {
    url = new URL(input);
  } catch {
    return {
      provider: 'manual',
      type: 'search',
      id: null,
      query: input,
      confidence: 0.55,
      evidence: 'Plain text input; use title and artist search.'
    };
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host.includes('open.spotify.com')) {
    const [, type, id] = path.match(/^\/(track|album|artist|playlist)\/([^/?#]+)/) || [];
    return {
      provider: 'spotify',
      type: type || 'unknown',
      id: id || null,
      query: id || input,
      confidence: id ? 0.95 : 0.5,
      evidence: 'Matched open.spotify.com URL path.'
    };
  }

  if (host.includes('music.apple.com') || host.includes('itunes.apple.com')) {
    const songId = url.searchParams.get('i');
    const albumId = path.match(/\/album\/[^/]+\/(\d+)/)?.[1];
    return {
      provider: 'apple-music',
      type: songId ? 'track' : 'album',
      id: songId || albumId || null,
      query: songId || albumId || input,
      confidence: songId || albumId ? 0.9 : 0.5,
      evidence: 'Matched Apple Music album path and optional ?i= song id.'
    };
  }

  if (host.includes('music.163.com') || host.includes('y.music.163.com')) {
    const hashPath = decodeURIComponent(url.hash || '');
    const id =
      url.searchParams.get('id') ||
      hashPath.match(/[?&]id=(\d+)/)?.[1] ||
      path.match(/\/(?:song|album|playlist)\/(\d+)/)?.[1];
    const type = hashPath.includes('/album') || path.includes('/album') ? 'album' : hashPath.includes('/playlist') || path.includes('/playlist') ? 'playlist' : 'track';
    return {
      provider: 'netease',
      type,
      id: id || null,
      query: id || input,
      confidence: id ? 0.82 : 0.45,
      evidence: 'Matched Netease Cloud Music URL and extracted public id when present.'
    };
  }

  if (host.includes('y.qq.com') || host.includes('qq.com')) {
    const songmid = path.match(/songDetail\/([^/?#]+)/)?.[1];
    const albummid = path.match(/albumDetail\/([^/?#]+)/)?.[1];
    return {
      provider: 'qq-music',
      type: albummid ? 'album' : 'track',
      id: songmid || albummid || url.searchParams.get('songmid') || url.searchParams.get('albummid'),
      query: songmid || albummid || input,
      confidence: songmid || albummid ? 0.82 : 0.45,
      evidence: 'Matched QQ Music URL path or query parameters.'
    };
  }

  return {
    provider: 'unknown-url',
    type: 'url',
    id: null,
    query: input,
    confidence: 0.3,
    evidence: 'URL host is not a supported music provider yet.'
  };
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    return json(res, 200, resolveInput(req.query.input));
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
}
