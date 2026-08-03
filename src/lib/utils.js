import React from 'react';

export const avatarOptions = ['M', 'L', 'R', 'A', 'K', '🎧', '♪', '星'];

export const memberColors = ['#5cb7ff', '#ffb86b', '#8fe388', '#ff7da8', '#f3d74c'];

export const recommendations = [
  ['相邻情绪', '从当前条目的评论中寻找相似叙事、声线和场景。'],
  ['同专辑延展', '把歌曲放回所属专辑，继续听完整作品的上下文。'],
  ['朋友共振', '优先推荐房间成员共同提到的关键词。']
];


export const emptyProfile = {
  bio: '',
  location: '',
  favoriteGenres: [],
  favoriteArtists: [],
  favoriteBands: [],
  favoriteAlbums: [],
  favoriteSongs: [],
  gender: '',
  birthYear: '',
  mbti: '',
  major: '',
  links: []
};


export const statusLabels = {
  idle: '准备就绪',
  searching: '正在搜索',
  thinking: '正在生成',
  done: '已完成',
  cloud: '已同步',
  error: '需要重试'
};


export const defaultHeroConfig = {
  eyebrow: 'shared listening room',
  title: '',
  titleSuffix: '把朋友的推荐整理成展柜。',
  description: '把朋友的推荐、评论和 AI 导览收进同一个音乐展柜。',
  accentName: 'Listening Observatory',
  backgroundUrl: '',
  visualMode: 'observatory',
  motionLevel: 'ambient'
};


export const defaultUserSettings = {
  appearance: {
    glass: 62,
    reduceMotion: false,
    rainbowStatus: true,
    themeStrategy: 'cover',
    customTheme: '#7ed7c9'
  },
  showroom: {
    coverSize: 'comfortable',
    wallLayout: '4x3',
    hoverPreview: 'flip',
    title: '',
    description: '',
    showCaptions: false,
    defaultMode: 'cabinet',
    detailMode: 'dossier'
  },
  filters: {
    mineOnly: false
  },
  persona: {
    tone: 'warm',
    historyMode: 'mine'
  }
};


export const hoverPreviewLabels = {
  flip: '翻面资料',
  blur: '高斯简介',
  lift: '浮层简介'
};


export const wallLayoutPresets = {
  '2x2': { label: '2x2', cols: 2, rows: 2 },
  '3x3': { label: '3x3', cols: 3, rows: 3 },
  '4x3': { label: '4x3', cols: 4, rows: 3 },
  '5x4': { label: '5x4', cols: 5, rows: 4 },
  auto: { label: '自动', cols: 0, rows: 0 }
};


export function mergeUserSettings(settings = {}) {
  return {
    appearance: { ...defaultUserSettings.appearance, ...(settings.appearance || {}) },
    showroom: { ...defaultUserSettings.showroom, ...(settings.showroom || {}) },
    filters: { ...defaultUserSettings.filters, ...(settings.filters || {}) },
    persona: { ...defaultUserSettings.persona, ...(settings.persona || {}) }
  };
}


export function roomQueryUrl(roomId, params = {}) {
  const query = new URLSearchParams();
  if (roomId) query.set('room', roomId);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  return `${window.location.pathname}?${query.toString()}`;
}


export function parseRoomQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    roomId: params.get('room') || '',
    view: params.get('view') || '',
    itemId: params.get('item') || '',
    mineOnly: params.get('mine') === '1'
  };
}


export function wallLayoutStyle(layout) {
  const preset = wallLayoutPresets[layout] || wallLayoutPresets['4x3'];
  return {
    '--wall-cols': preset.cols || 'auto',
    '--wall-rows': preset.rows || 'auto'
  };
}


export function cabinetDisplayTitle(value, roomName = '') {
  const title = String(value || '').trim();
  const roomTitle = String(roomName || '').trim();
  if (!title) return '专辑陈列柜';
  if (roomTitle && title === `${roomTitle} 的专辑陈列柜`) return '专辑陈列柜';
  if (/^.+\s*的专辑陈列柜$/.test(title)) return '专辑陈列柜';
  return title;
}


export function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
  } catch {
    return fallback;
  }
}


export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


export function avatarFor(name) {
  const text = String(name || 'M').trim();
  return text ? text[0].toUpperCase() : 'M';
}


export function avatarSrc(user) {
  return user?.avatarUrl || user?.avatarDataUrl || '';
}


export function profileToDraft(user) {
  return {
    name: user?.name || '',
    avatar: user?.avatar || avatarFor(user?.name),
    avatarUrl: user?.avatarUrl || '',
    avatarDataUrl: user?.avatarDataUrl || '',
    profile: { ...emptyProfile, ...(user?.profile || {}) },
    publicTags: user?.publicTags || []
  };
}


export function publicMemberProfile(user = {}, id = '') {
  const profile = user.profile && typeof user.profile === 'object' ? user.profile : {};
  const name = user.name || 'Music friend';
  return {
    id: user.id || id,
    name,
    avatar: user.avatar || avatarFor(name),
    avatarUrl: user.avatarUrl || '',
    avatarDataUrl: user.avatarDataUrl || '',
    publicTags: Array.isArray(user.publicTags) ? user.publicTags : [],
    bio: user.bio || profile.bio || '',
    location: user.location || profile.location || '',
    profile: {
      bio: user.bio || profile.bio || '',
      location: user.location || profile.location || '',
      favoriteGenres: Array.isArray(profile.favoriteGenres) ? profile.favoriteGenres : [],
      favoriteArtists: Array.isArray(profile.favoriteArtists) ? profile.favoriteArtists : [],
      favoriteBands: Array.isArray(profile.favoriteBands) ? profile.favoriteBands : [],
      favoriteAlbums: Array.isArray(profile.favoriteAlbums) ? profile.favoriteAlbums : [],
      favoriteSongs: Array.isArray(profile.favoriteSongs) ? profile.favoriteSongs : []
    }
  };
}


export function listToText(value) {
  return Array.isArray(value) ? value.join('、') : String(value || '');
}


export function textToList(value) {
  return String(value || '').split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean);
}


export function clampText(value, max, fallback = '') {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, max);
}


export function cleanImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:') return '';
    const trustedHosts = [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'res.cloudinary.com',
      'images.unsplash.com',
      'is1-ssl.mzstatic.com',
      'is2-ssl.mzstatic.com',
      'is3-ssl.mzstatic.com',
      'is4-ssl.mzstatic.com',
      'is5-ssl.mzstatic.com',
      'coverartarchive.org'
    ];
    const imageLike = /\.(png|jpe?g|webp|avif)(\?.*)?$/i.test(url.pathname + url.search)
      || /(^|[?&])(format|fm|contentType)=([^&]*)(png|jpe?g|webp|avif|image%2F|image\/)/i.test(url.search)
      || trustedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    if (!imageLike) return '';
    return url.toString().slice(0, 520);
  } catch {
    return '';
  }
}


export function normalizeHeroConfig(config = {}, room = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const visualMode = ['observatory', 'vinyl', 'editorial'].includes(source.visualMode) ? source.visualMode : defaultHeroConfig.visualMode;
  const motionLevel = ['still', 'ambient', 'cinematic'].includes(source.motionLevel) ? source.motionLevel : defaultHeroConfig.motionLevel;
  return {
    eyebrow: clampText(source.eyebrow, 48, defaultHeroConfig.eyebrow),
    title: clampText(source.title, 80, ''),
    titleSuffix: clampText(source.titleSuffix, 80, defaultHeroConfig.titleSuffix),
    description: clampText(source.description || room.description, 280, defaultHeroConfig.description),
    accentName: clampText(source.accentName, 42, defaultHeroConfig.accentName),
    backgroundUrl: cleanImageUrl(source.backgroundUrl),
    visualMode,
    motionLevel
  };
}


export function editableHeroConfig(config = {}, room = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const normalized = normalizeHeroConfig(source, room);
  const owns = (key) => Object.prototype.hasOwnProperty.call(source, key);
  const raw = (key, max) => (owns(key) ? String(source[key] ?? '').slice(0, max) : normalized[key]);
  return {
    ...normalized,
    eyebrow: raw('eyebrow', 48),
    title: raw('title', 80),
    titleSuffix: raw('titleSuffix', 80),
    description: raw('description', 280),
    accentName: raw('accentName', 42),
    backgroundUrl: raw('backgroundUrl', 520)
  };
}


export function countAlbumTracks(item) {
  return item?.tracks?.length || (item?.type === 'song' ? 1 : 0);
}


export function heroBackgroundImage(heroConfig, activeItem) {
  return heroConfig.backgroundUrl || activeItem?.cover || '';
}


export async function imageFileToDataUrl(file) {
  if (!file) return '';
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error('请上传 PNG、JPEG 或 WebP 图片。');
  const bitmap = await createImageBitmap(file);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/webp', quality);
  while (dataUrl.length > 170000 && quality > 0.46) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/webp', quality);
  }
  if (dataUrl.length > 180000) throw new Error('头像压缩后仍然过大，请换一张更小的图片。');
  return dataUrl;
}


export function slugifyRoom(name) {
  const ascii = String(name || 'room')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${ascii || 'room'}-${Date.now().toString(36)}`;
}


export function normalizeMusicText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .trim();
}


export function trackTitle(track) {
  if (typeof track === 'string') return track;
  if (track && typeof track === 'object') return String(track.title || track.trackName || track.name || '').trim();
  return '';
}


export function trackArtist(track, fallback = '') {
  if (track && typeof track === 'object') return String(track.artist || track.artistName || '').trim() || fallback;
  return fallback;
}


export function albumKey(item) {
  if (!item) return '';
  if (item.collectionId) return `collection:${item.collectionId}`;
  if (item.albumId) return `album:${item.albumId}`;
  return `title:${normalizeMusicText(item.albumTitle || item.title)}:${normalizeMusicText(item.artist)}`;
}


export function sameAlbum(left, right) {
  const leftKey = albumKey(left);
  const rightKey = albumKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}


export function trackMatchesTitle(track, title) {
  const normalizedTrack = normalizeMusicText(trackTitle(track) || track);
  const normalizedTitle = normalizeMusicText(title);
  return Boolean(normalizedTrack && normalizedTitle && (normalizedTrack === normalizedTitle || normalizedTrack.includes(normalizedTitle) || normalizedTitle.includes(normalizedTrack)));
}


export function colorHash(seed, shift = 0) {
  const text = String(seed || 'album-circle');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index) + shift) % 360;
  return `hsl(${hash} 72% ${shift % 2 ? 58 : 46}%)`;
}


export function fallbackPalette(item) {
  if (item?.palette?.length >= 3) return item.palette;
  const seed = `${item?.title || ''}-${item?.artist || ''}-${item?.albumTitle || ''}`;
  return [colorHash(seed, 0), colorHash(seed, 97), colorHash(seed, 211)];
}


export function rgbToHslString(r, g, b, lightAdjust = 0) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case red:
        h = (green - blue) / delta + (green < blue ? 6 : 0);
        break;
      case green:
        h = (blue - red) / delta + 2;
        break;
      default:
        h = (red - green) / delta + 4;
    }
    h /= 6;
  }
  const lightness = Math.max(18, Math.min(82, Math.round(l * 100 + lightAdjust)));
  return `hsl(${Math.round(h * 360)} ${Math.max(28, Math.round(s * 100))}% ${lightness}%)`;
}


export function cssImageUrl(url) {
  return url ? `url("${String(url).replace(/["\\]/g, '\\$&')}")` : 'none';
}


export function stableIndex(seed, modulo) {
  const text = String(seed || 'album-circle');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 33 + text.charCodeAt(index)) % 9973;
  return hash % modulo;
}


export function providerLabel(provider) {
  const labels = {
    appleMusic: 'Apple / iTunes',
    youtubeMusic: 'YouTube Music',
    youtube: 'YouTube',
    qqMusic: 'QQ 音乐',
    netease: '网易云',
    songlink: 'Songlink'
  };
  return labels[provider] || provider;
}


export function listeningLinksFor(item) {
  const links = Array.isArray(item?.providerLinks) ? [...item.providerLinks] : [];
  if (item?.trackViewUrl && !links.some((link) => link.url === item.trackViewUrl)) links.unshift({ provider: 'appleMusic', url: item.trackViewUrl, confidence: 'exact', source: 'itunes' });
  if (item?.collectionViewUrl && !links.some((link) => link.url === item.collectionViewUrl)) links.unshift({ provider: 'appleMusic', url: item.collectionViewUrl, confidence: 'exact', source: 'itunes' });
  return links.filter((link) => link.url).slice(0, 8);
}


export function authHeaders(session) {
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}


export async function api(path, { session, ...options } = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...authHeaders(session),
    ...(options.headers || {})
  };
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    if (!text || !Object.keys(data).length) {
      throw new Error(response.status === 504 ? '服务器生成超时，本次没有写入展柜，请重试。' : `服务器返回异常：${response.status}`);
    }
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}


export async function apiWithTimeout(path, options = {}, timeoutMs = 22000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await api(path, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('AI 生成仍在进行中，请稍后重试；本次没有写入低质兜底内容。');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


export function recoTitle(item, kind) {
  if (typeof item === 'string') return item;
  if (!item) return '';
  if (kind === 'artist' || kind === 'band') return item.name || item.title || '';
  return [item.artist, item.title || item.name].filter(Boolean).join(' - ') || item.title || item.name || '';
}


export function recoReason(item) {
  if (!item || typeof item === 'string') return '';
  return item.reason || item.entry || '';
}


export function recoEntry(item) {
  if (!item || typeof item === 'string') return '';
  return item.entry && item.entry !== item.reason ? item.entry : '';
}

