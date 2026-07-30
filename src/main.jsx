import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import {
  Album,
  BookOpen,
  Bot,
  ChevronRight,
  CirclePlus,
  Disc3,
  DoorOpen,
  Grid3X3,
  Library,
  LockKeyhole,
  MessageCircle,
  Music2,
  Radio,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Users,
  Wand2
} from 'lucide-react';
import { initAnalytics } from './firebaseClient';
import ExperimentalCorridorCarousel from './ExperimentalCorridorCarousel';
import ImmersiveDetail from './ImmersiveDetail';
import './styles.css';
import './final-overrides.css';
import './corridor-carousel.css';
import './motion-polish.css';
import './toast-theme.css';
import './immersive-detail.css';
import { Toaster, toast } from 'sonner';

const avatarOptions = ['M', 'L', 'R', 'A', 'K', '🎧', '♪', '星'];
const memberColors = ['#5cb7ff', '#ffb86b', '#8fe388', '#ff7da8', '#f3d74c'];
const recommendations = [
  ['相邻情绪', '从当前条目的评论中寻找相似叙事、声线和场景。'],
  ['同专辑延展', '把歌曲放回所属专辑，继续听完整作品的上下文。'],
  ['朋友共振', '优先推荐房间成员共同提到的关键词。']
];

const emptyProfile = {
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

const statusLabels = {
  idle: '准备就绪',
  searching: '正在搜索',
  thinking: '正在生成',
  done: '已完成',
  cloud: '已同步',
  error: '需要重试'
};

const defaultHeroConfig = {
  eyebrow: 'shared listening room',
  title: '',
  titleSuffix: '把朋友的推荐整理成展柜。',
  description: '把朋友的推荐、评论和 AI 导览收进同一个音乐展柜。',
  accentName: 'Listening Observatory',
  backgroundUrl: '',
  visualMode: 'observatory',
  motionLevel: 'ambient'
};

const defaultUserSettings = {
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

const hoverPreviewLabels = {
  flip: '翻面资料',
  blur: '高斯简介',
  lift: '浮层简介'
};

const wallLayoutPresets = {
  '2x2': { label: '2x2', cols: 2, rows: 2 },
  '3x3': { label: '3x3', cols: 3, rows: 3 },
  '4x3': { label: '4x3', cols: 4, rows: 3 },
  '5x4': { label: '5x4', cols: 5, rows: 4 },
  auto: { label: '自动', cols: 0, rows: 0 }
};

function mergeUserSettings(settings = {}) {
  return {
    appearance: { ...defaultUserSettings.appearance, ...(settings.appearance || {}) },
    showroom: { ...defaultUserSettings.showroom, ...(settings.showroom || {}) },
    filters: { ...defaultUserSettings.filters, ...(settings.filters || {}) },
    persona: { ...defaultUserSettings.persona, ...(settings.persona || {}) }
  };
}

function roomQueryUrl(roomId, params = {}) {
  const query = new URLSearchParams();
  if (roomId) query.set('room', roomId);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  return `${window.location.pathname}?${query.toString()}`;
}

function parseRoomQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    roomId: params.get('room') || '',
    view: params.get('view') || '',
    itemId: params.get('item') || '',
    mineOnly: params.get('mine') === '1'
  };
}

function wallLayoutStyle(layout) {
  const preset = wallLayoutPresets[layout] || wallLayoutPresets['4x3'];
  return {
    '--wall-cols': preset.cols || 'auto',
    '--wall-rows': preset.rows || 'auto'
  };
}

function cabinetDisplayTitle(value, roomName = '') {
  const title = String(value || '').trim();
  const roomTitle = String(roomName || '').trim();
  if (!title) return '专辑陈列柜';
  if (roomTitle && title === `${roomTitle} 的专辑陈列柜`) return '专辑陈列柜';
  if (/^.+\s*的专辑陈列柜$/.test(title)) return '专辑陈列柜';
  return title;
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function avatarFor(name) {
  const text = String(name || 'M').trim();
  return text ? text[0].toUpperCase() : 'M';
}

function avatarSrc(user) {
  return user?.avatarUrl || user?.avatarDataUrl || '';
}

function profileToDraft(user) {
  return {
    name: user?.name || '',
    avatar: user?.avatar || avatarFor(user?.name),
    avatarUrl: user?.avatarUrl || '',
    avatarDataUrl: user?.avatarDataUrl || '',
    profile: { ...emptyProfile, ...(user?.profile || {}) },
    publicTags: user?.publicTags || []
  };
}

function publicMemberProfile(user = {}, id = '') {
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

function listToText(value) {
  return Array.isArray(value) ? value.join('、') : String(value || '');
}

function textToList(value) {
  return String(value || '').split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean);
}

function clampText(value, max, fallback = '') {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, max);
}

function cleanImageUrl(value) {
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

function normalizeHeroConfig(config = {}, room = {}) {
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

function editableHeroConfig(config = {}, room = {}) {
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

function countAlbumTracks(item) {
  return item?.tracks?.length || (item?.type === 'song' ? 1 : 0);
}

function heroBackgroundImage(heroConfig, activeItem) {
  return heroConfig.backgroundUrl || activeItem?.cover || '';
}

function UserAvatar({ user, className = '' }) {
  const src = avatarSrc(user);
  return src ? <img className={`user-avatar-img ${className}`} src={src} alt={`${user?.name || '用户'} 头像`} /> : <span className={`mini-avatar ${className}`}>{user?.avatar || avatarFor(user?.name)}</span>;
}

function AuthorChip({ profile, fallbackName, fallbackAvatar, onOpen }) {
  const user = profile || publicMemberProfile({ name: fallbackName, avatar: fallbackAvatar });
  const canOpen = Boolean(profile?.id && onOpen);
  return (
    <button type="button" className="author-chip" disabled={!canOpen} onClick={() => canOpen && onOpen(profile.id)}>
      <UserAvatar user={user} />
      <span>{user.name || fallbackName || 'Music friend'}</span>
    </button>
  );
}

async function imageFileToDataUrl(file) {
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

function slugifyRoom(name) {
  const ascii = String(name || 'room')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${ascii || 'room'}-${Date.now().toString(36)}`;
}

function normalizeMusicText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .trim();
}

function trackTitle(track) {
  if (typeof track === 'string') return track;
  if (track && typeof track === 'object') return String(track.title || track.trackName || track.name || '').trim();
  return '';
}

function trackArtist(track, fallback = '') {
  if (track && typeof track === 'object') return String(track.artist || track.artistName || '').trim() || fallback;
  return fallback;
}

function albumKey(item) {
  if (!item) return '';
  if (item.collectionId) return `collection:${item.collectionId}`;
  if (item.albumId) return `album:${item.albumId}`;
  return `title:${normalizeMusicText(item.albumTitle || item.title)}:${normalizeMusicText(item.artist)}`;
}

function sameAlbum(left, right) {
  const leftKey = albumKey(left);
  const rightKey = albumKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function trackMatchesTitle(track, title) {
  const normalizedTrack = normalizeMusicText(trackTitle(track) || track);
  const normalizedTitle = normalizeMusicText(title);
  return Boolean(normalizedTrack && normalizedTitle && (normalizedTrack === normalizedTitle || normalizedTrack.includes(normalizedTitle) || normalizedTitle.includes(normalizedTrack)));
}

function colorHash(seed, shift = 0) {
  const text = String(seed || 'album-circle');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index) + shift) % 360;
  return `hsl(${hash} 72% ${shift % 2 ? 58 : 46}%)`;
}

function fallbackPalette(item) {
  if (item?.palette?.length >= 3) return item.palette;
  const seed = `${item?.title || ''}-${item?.artist || ''}-${item?.albumTitle || ''}`;
  return [colorHash(seed, 0), colorHash(seed, 97), colorHash(seed, 211)];
}

function rgbToHslString(r, g, b, lightAdjust = 0) {
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

function cssImageUrl(url) {
  return url ? `url("${String(url).replace(/["\\]/g, '\\$&')}")` : 'none';
}

function stableIndex(seed, modulo) {
  const text = String(seed || 'album-circle');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 33 + text.charCodeAt(index)) % 9973;
  return hash % modulo;
}

function providerLabel(provider) {
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

function listeningLinksFor(item) {
  const links = Array.isArray(item?.providerLinks) ? [...item.providerLinks] : [];
  if (item?.trackViewUrl && !links.some((link) => link.url === item.trackViewUrl)) links.unshift({ provider: 'appleMusic', url: item.trackViewUrl, confidence: 'exact', source: 'itunes' });
  if (item?.collectionViewUrl && !links.some((link) => link.url === item.collectionViewUrl)) links.unshift({ provider: 'appleMusic', url: item.collectionViewUrl, confidence: 'exact', source: 'itunes' });
  return links.filter((link) => link.url).slice(0, 8);
}

function useCoverPalette(item) {
  const fallback = useMemo(() => fallbackPalette(item), [item?.palette, item?.title, item?.artist, item?.albumTitle]);
  const [sampled, setSampled] = useState(null);

  useEffect(() => {
    const cover = item?.cover;
    setSampled(null);
    if (!cover || typeof document === 'undefined') return undefined;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);
        const buckets = new Map();
        for (let index = 0; index < data.length; index += 16) {
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];
          if (a < 180) continue;
          const brightness = (r + g + b) / 3;
          if (brightness < 18 || brightness > 242) continue;
          const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`;
          const current = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
          current.count += 1;
          current.r += r;
          current.g += g;
          current.b += b;
          buckets.set(key, current);
        }
        const colors = [...buckets.values()]
          .map((bucket) => ({
            count: bucket.count,
            r: Math.round(bucket.r / bucket.count),
            g: Math.round(bucket.g / bucket.count),
            b: Math.round(bucket.b / bucket.count)
          }))
          .sort((left, right) => {
            const leftSat = Math.max(left.r, left.g, left.b) - Math.min(left.r, left.g, left.b);
            const rightSat = Math.max(right.r, right.g, right.b) - Math.min(right.r, right.g, right.b);
            return right.count * (rightSat + 34) - left.count * (leftSat + 34);
          })
          .slice(0, 3);
        if (colors.length >= 2) {
          setSampled([
            rgbToHslString(colors[0].r, colors[0].g, colors[0].b, -4),
            rgbToHslString(colors[1].r, colors[1].g, colors[1].b, 4),
            rgbToHslString((colors[2] || colors[0]).r, (colors[2] || colors[0]).g, (colors[2] || colors[0]).b, 18)
          ]);
        }
      } catch {
        if (!cancelled) setSampled(null);
      }
    };
    image.onerror = () => {
      if (!cancelled) setSampled(null);
    };
    image.src = cover;
    return () => {
      cancelled = true;
    };
  }, [item?.cover]);

  return sampled || fallback;
}

function authHeaders(session) {
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

async function api(path, { session, ...options } = {}) {
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

async function apiWithTimeout(path, options = {}, timeoutMs = 22000) {
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

function AlbumArt({ item, className = '', size = 'large' }) {
  const [failed, setFailed] = useState(false);
  const title = item?.title || 'Music';
  const artist = item?.artist || 'Unknown artist';
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`album-art ${className} ${size}`}
      aria-label={`${title} 封面`}
      style={{
        '--art-a': item?.palette?.[0] || '#6fc7ff',
        '--art-b': item?.palette?.[1] || '#f7df71',
        '--art-c': item?.palette?.[2] || '#f8fbff'
      }}
    >
      {!failed && item?.cover ? (
        <img src={item.cover} alt={`${title} 封面`} width="640" height="640" loading={size === 'thumb' ? 'lazy' : 'eager'} onError={() => setFailed(true)} />
      ) : (
        <div className="art-fallback">
          <Disc3 size={size === 'thumb' ? 18 : 42} />
          <strong>{initials}</strong>
          <span>{artist}</span>
        </div>
      )}
    </div>
  );
}

function AddGenerationLoader({ item, phaseSteps, activePhaseIndex }) {
  const variants = ['mosaic', 'fill', 'pressing'];
  const variant = variants[stableIndex(item?.id || `${item?.title}-${item?.artist}`, variants.length)];
  const progress = `${Math.max(18, Math.min(100, ((activePhaseIndex + 1) / phaseSteps.length) * 100))}%`;
  const tiles = Array.from({ length: 16 }, (_, index) => index);
  const title = item?.title || '这条音乐';
  const artist = item?.artist || 'Album Circle';

  return (
    <div
      className={`generation-loader generation-${variant}`}
      style={{
        '--loader-cover': cssImageUrl(item?.cover),
        '--loader-level': progress,
        '--loader-a': item?.palette?.[0] || 'var(--cover-a)',
        '--loader-b': item?.palette?.[1] || 'var(--cover-b)',
        '--loader-c': item?.palette?.[2] || 'var(--cover-c)'
      }}
      aria-live="polite"
    >
      <div className="loader-stage" aria-hidden="true">
        <div className="loader-disc" />
        <div className="loader-cover">
          {item?.cover ? tiles.map((tile) => (
            <span
              key={tile}
              style={{
                '--tile-x': `${(tile % 4) * 33.333}%`,
                '--tile-y': `${Math.floor(tile / 4) * 33.333}%`,
                '--tile-delay': `${tile * 42}ms`
              }}
            />
          )) : <AlbumArt item={item} />}
          <i />
        </div>
      </div>
      <div className="loader-copy">
        <p className="eyebrow"><Bot size={14} /> deep guide</p>
        <strong>{title}</strong>
        <small>{artist} 的资料正在被整理成可读导览</small>
      </div>
      <div className="loader-meter"><i /></div>
      <div className="ai-progress rich-progress loader-phases">
        <div>{phaseSteps.map(([key, label], index) => <span key={key} className={index <= activePhaseIndex ? 'active' : ''}>{label}</span>)}</div>
      </div>
    </div>
  );
}

function PersonaGenerationLoader({ tone, selectedCount, profileStats, user }) {
  const [elapsed, setElapsed] = useState(0);
  const [focusCard, setFocusCard] = useState('phase');
  const totalEstimate = 240;
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const variants = ['oracle', 'spectrum', 'constellation'];
  const variant = variants[stableIndex(`${tone}-${selectedCount}-${profileStats?.itemsAdded || 0}`, variants.length)];
  const topArtists = (profileStats?.topArtists || []).slice(0, 5);
  const recentAdds = (profileStats?.recentAdds || []).slice(0, 5);
  const tags = (profileStats?.tags || []).slice(0, 6);
  const commentCount = profileStats?.commentsAdded || (Array.isArray(profileStats?.comments) ? profileStats.comments.length : 0);
  const avatar = avatarSrc(user);
  const profile = user?.profile || {};
  const profileLabel = [profile.mbti, profile.birthYear, profile.major].filter(Boolean).slice(0, 2).join(' / ') || '资料牌';
  const favoriteArtists = Array.isArray(profile.favoriteArtists) ? profile.favoriteArtists : [];
  const favoriteGenres = Array.isArray(profile.favoriteGenres) ? profile.favoriteGenres : [];
  const favoriteAlbums = Array.isArray(profile.favoriteAlbums) ? profile.favoriteAlbums : [];
  const baseCards = [
    { title: user?.name || '你', kind: 'avatar', image: avatar, label: profileLabel },
    { title: selectedCount ? `${selectedCount} 首代表作` : '偏好资料', kind: 'profile', label: favoriteGenres[0] || tags[0]?.name || tone },
    ...recentAdds.slice(0, 3).map((item) => ({ title: item.title, kind: 'music', image: item.cover, label: item.artist })),
    { title: favoriteArtists[0] || topArtists[0]?.name || '歌手雷达', kind: 'artist', label: favoriteAlbums[0] || '相似气质检索' },
    { title: '评论切片', kind: 'comment', label: `${commentCount} 条线索` },
    { title: tags[0]?.name || '隐藏标签', kind: 'tag', label: tags[1]?.name || '等待揭牌' }
  ];
  const cardItems = baseCards.filter((item, index, array) => item.title && array.findIndex((candidate) => candidate.title === item.title && candidate.kind === item.kind) === index).slice(0, 6);
  const phasePlan = [
    { at: 0, label: '资料入阵', detail: '保存个人资料、代表作和评论切片', icon: '01', note: '先把你的资料牌、歌单牌和评论牌放到同一张桌面上。' },
    { at: 18, label: '联网检索', detail: 'Tavily 查找相似艺人、专辑语境和评论来源', icon: '02', note: '这一步在给推荐找外部参照，不让结果只凭空想。' },
    { at: 48, label: '音乐写手', detail: 'v4 Pro 生成音乐人格长稿', icon: '03', note: '它会盯着人声、旋律、专辑感和你留下的歌曲线索。' },
    { at: 88, label: '生活写手', detail: 'v4 Pro 推演日常性格和相处方式', icon: '04', note: '这一步负责把歌单翻译成更像人的侧写。' },
    { at: 128, label: '策展写手', detail: 'v4 Pro 生成推荐方向和口味边界', icon: '05', note: '新的歌手、专辑、歌曲会在这里开始成形。' },
    { at: 168, label: '主编融合', detail: '把多份草稿熔成一篇完整灵魂侧写', icon: '06', note: '主编会删掉套话，保留最像你的句子。' },
    { at: 212, label: '排版成卡', detail: '生成标签、主题色、彩蛋和继续追问', icon: '07', note: '最后把长文装进前端能展示的卡片和标签。' }
  ];
  const nextPhaseIndex = phasePlan.findIndex((phase, index) => elapsed >= phase.at && (index === phasePlan.length - 1 || elapsed < phasePlan[index + 1].at));
  const activePhaseIndex = Math.min(phasePlan.length - 1, Math.max(0, nextPhaseIndex));
  const activePhase = phasePlan[activePhaseIndex] || phasePlan[0];
  const progress = Math.min(96, Math.max(7, Math.round((elapsed / totalEstimate) * 96)));
  const remaining = Math.max(0, totalEstimate - elapsed);
  const waitLine = remaining > 0 ? `预计还要 ${Math.ceil(remaining / 30) * 30} 秒左右` : '正在等最后一张牌落桌';
  const interactionCards = {
    phase: activePhase.note,
    sources: `将参考 ${profileStats?.itemsAdded || 0} 条添加记录、${commentCount} 条评论线索和联网资料。`,
    question: '可以先想一个问题：为什么我会喜欢这些声音？下一批要更安全还是更冒险？'
  };

  return (
    <div className={`persona-loading persona-loading-${variant}`} aria-live="polite">
      <div className="persona-oracle-stage" aria-hidden="true">
        <div className="persona-table-glow" />
        <div className="persona-zodiac">
          {Array.from({ length: 12 }, (_, index) => <span key={index} style={{ '--i': index }} />)}
        </div>
        <div className="persona-orbit persona-orbit-a" />
        <div className="persona-orbit persona-orbit-b" />
        <div className="persona-card-stack">
          {cardItems.map((item, index) => (
            <i
              key={`${item.title}-${index}`}
              className={`persona-loading-card ${item.kind}`}
              style={{
                '--i': index,
                '--card-y': `${Math.abs(index - 2.5) * 5}px`,
                '--card-cover': cssImageUrl(item.image)
              }}
            >
              <span className="persona-card-face persona-card-front">
                <b>{item.title}</b>
                <small>{item.label}</small>
              </span>
              <span className="persona-card-face persona-card-back">
                <em>{item.kind === 'avatar' ? 'YOU' : item.kind}</em>
              </span>
            </i>
          ))}
        </div>
        <div className="persona-pulse-core"><Sparkles size={24} /></div>
      </div>
      <div className="persona-loading-copy">
        <p className="eyebrow"><Sparkles size={14} /> deep persona</p>
        <strong>{activePhase.label}</strong>
        <small>{activePhase.detail}。{waitLine}，已等待 {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}。</small>
      </div>
      <div className="persona-phase-meter" style={{ '--persona-progress': `${progress}%` }}>
        <div><i /></div>
        <span>{progress}%</span>
      </div>
      <div className="persona-phase-rail">
        {phasePlan.map((phase, index) => (
          <button key={phase.label} type="button" className={index <= activePhaseIndex ? 'active' : ''} onClick={() => setFocusCard('phase')}>
            <b>{phase.icon}</b>
            <span>{phase.label}</span>
          </button>
        ))}
      </div>
      <div className="persona-wait-actions" role="group" aria-label="等待时可查看的信息">
        <button type="button" className={focusCard === 'phase' ? 'active' : ''} onClick={() => setFocusCard('phase')}>当前阶段</button>
        <button type="button" className={focusCard === 'sources' ? 'active' : ''} onClick={() => setFocusCard('sources')}>本次素材</button>
        <button type="button" className={focusCard === 'question' ? 'active' : ''} onClick={() => setFocusCard('question')}>待会追问</button>
      </div>
      <div className="persona-wait-card">
        <Sparkles size={15} />
        <p>{interactionCards[focusCard]}</p>
      </div>
      <div className="persona-loading-strip">
        {[
          ['资料', selectedCount ? `${selectedCount} 首代表作` : '个人档案'],
          ['评论', `${commentCount} 条线索`],
          ['艺人', topArtists[0]?.name || '偏好雷达'],
          ['标签', tags[0]?.name || tone]
        ].map(([label, value]) => <span key={label}><b>{label}</b>{value}</span>)}
      </div>
    </div>
  );
}

function AuthGate({ session, setSession }) {
  const [authMode, setAuthMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', avatar: 'M' });
  const [status, setStatus] = useState('');

  const submit = async () => {
    setStatus('正在连接账户');
    try {
      const data = await api('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ ...form, action: authMode === 'signup' ? 'signup' : 'login' })
      });
      const next = { token: data.token, user: data.user };
      setSession(next);
      saveJson('album-circle-session', next);
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  };

  if (session?.token) return null;

  return (
    <main className="app auth-screen">
      <div className="aurora" aria-hidden="true" />
      <section className="auth-shell glass-panel">
        <div className="brand auth-brand">
          <div className="brand-mark"><Disc3 size={22} /></div>
          <div>
            <strong>Album Circle</strong>
            <span>为朋友创建一个共同听歌房间</span>
          </div>
        </div>
        <div>
          <p className="eyebrow"><LockKeyhole size={15} /> account</p>
          <h1>登录后创建房间，收藏歌曲和专辑。</h1>
          <p>你的评论、添加记录和房间成员身份会同步保存。</p>
        </div>
        <div className="auth-tabs">
          <button className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => setAuthMode('login')}>登录</button>
          <button className={authMode === 'signup' ? 'active' : ''} type="button" onClick={() => setAuthMode('signup')}>注册</button>
        </div>
        {authMode === 'signup' && (
          <label>
            昵称
            <input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Ming" />
          </label>
        )}
        <label>
          邮箱
          <input value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} placeholder="you@example.com" />
        </label>
        <label>
          密码
          <input type="password" value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} placeholder="至少 6 位" />
        </label>
        {authMode === 'signup' && (
          <div className="avatar-picker" aria-label="头像选择">
            {avatarOptions.map((avatar) => (
              <button key={avatar} type="button" className={form.avatar === avatar ? 'active' : ''} onClick={() => setForm((value) => ({ ...value, avatar }))}>{avatar}</button>
            ))}
          </div>
        )}
        <button type="button" className="full-action" onClick={submit}><UserRound size={16} />{authMode === 'signup' ? '创建账户' : '登录'}</button>
        {status && <p className="status-line">{status}</p>}
      </section>
    </main>
  );
}

function RoomGate({ session, room, setRoom }) {
  const [name, setName] = useState('周五听歌房');
  const [joinId, setJoinId] = useState(new URLSearchParams(window.location.search).get('room') || '');
  const [joinPassword, setJoinPassword] = useState('');
  const [rooms, setRooms] = useState([]);
  const [discoverRooms, setDiscoverRooms] = useState([]);
  const [status, setStatus] = useState('');
  const autoOpenRef = useRef(false);

  useEffect(() => {
    if (!session?.token || room) return;
    Promise.all([
      api('/api/rooms', { session }).then((data) => setRooms(data.rooms || [])).catch(() => null),
      api('/api/rooms?scope=discover', { session }).then((data) => setDiscoverRooms(data.rooms || [])).catch(() => null)
    ]);
  }, [room, session]);

  const createRoom = async () => {
    setStatus('正在创建房间');
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({ name, slug: slugifyRoom(name) })
      });
      setRoom(data.room);
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const enterRoom = async (id) => {
    if (!id) return;
    setStatus('正在打开房间');
    try {
      const data = await api(`/api/rooms?roomId=${encodeURIComponent(id)}`, { session });
      setRoom(data.room);
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('room') || '';
    if (!session?.token || room || autoOpenRef.current || !requested) return;
    autoOpenRef.current = true;
    enterRoom(requested);
  }, [room, session?.token]);

  const joinRoom = async (id = joinId) => {
    const raw = String(id || '').trim();
    let parsed = raw;
    if (raw.includes('room=')) {
      try {
        parsed = new URL(raw, window.location.origin).searchParams.get('room') || raw;
      } catch {
        parsed = raw.replace(/^.*room=/, '').split('&')[0];
      }
    }
    parsed = String(parsed || '').trim();
    if (!parsed) return;
    setStatus('正在加入房间');
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({ action: 'join', roomId: parsed, password: joinPassword })
      });
      setRoom(data.room);
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  if (!session?.token || room) return null;

  return (
    <main className="app auth-screen room-gate-screen">
      <div className="aurora" aria-hidden="true" />
      <section className="room-shell room-gate-shell">
        <aside className="room-gate-copy">
          <div className="room-gate-identity">
            <div className="brand-mark"><Disc3 size={22} /></div>
            <div>
              <strong>{session.user.name || 'Album Circle'}</strong>
              <span>选择一个房间继续听</span>
            </div>
          </div>
          <div className="room-gate-title">
            <p className="eyebrow"><Library size={15} /> room lobby</p>
            <h1>进入你的听歌房间。</h1>
            <p>从已加入的房间继续听，或用邀请码进入新的展柜。评论、评分和成员设置都会留在对应房间里。</p>
          </div>
          <div className="room-gate-notes" aria-label="房间功能摘要">
            <span><Users size={15} />成员同步</span>
            <span><MessageCircle size={15} />评论留存</span>
            <span><Star size={15} />独立评分</span>
          </div>
        </aside>

        <div className="glass-panel room-gate-actions room-gate-console">
          <article className="room-card room-card-primary room-card-rooms">
            <div>
              <p className="eyebrow"><DoorOpen size={15} /> your rooms</p>
              <h2>已加入的房间</h2>
              <p>选择一个房间继续浏览展柜、评论和评分。</p>
            </div>
            {rooms.length > 0 ? (
              <div className="joined-room-list">
                {rooms.map((knownRoom) => (
                  <button key={knownRoom.id} type="button" onClick={() => enterRoom(knownRoom.id)}>
                    <span>
                      <strong>{knownRoom.name}</strong>
                      <small>{knownRoom.itemCount || 0} 条目 · {knownRoom.commentCount || 0} 评论</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="room-empty-state">
                <Disc3 size={30} />
                <strong>还没有加入任何房间</strong>
                <span>用右侧邀请码加入一个房间，或先创建自己的听歌房间。</span>
              </div>
            )}
          </article>

          <article className="room-card room-card-invite">
            <div>
              <p className="eyebrow"><Share2 size={15} /> invite</p>
              <h2>加入新的房间</h2>
              <p>粘贴邀请链接或 room ID；如果房间设置了密码，在下面填写。</p>
            </div>
            <label>
              邀请码或房间 ID
              <input value={joinId} onChange={(event) => setJoinId(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') joinRoom(); }} placeholder="邀请链接里的 room" />
            </label>
            <label>
              房间密码
              <input type="password" value={joinPassword} onChange={(event) => setJoinPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') joinRoom(); }} placeholder="公开房间可留空" />
            </label>
            <button className="full-action" type="button" onClick={() => joinRoom()}><Users size={16} />加入房间</button>
            {discoverRooms.length > 0 && (
              <div className="known-rooms discover-rooms">
                <strong>公开房间</strong>
                {discoverRooms.map((knownRoom) => (
                  <button key={knownRoom.id} type="button" onClick={() => { setJoinId(knownRoom.id); joinRoom(knownRoom.id); }}>{knownRoom.name}<small>{knownRoom.itemCount} 条目 · {knownRoom.joinMode === 'password' ? '需要密码' : '可加入'}</small></button>
                ))}
              </div>
            )}
          </article>

          <article className="room-card room-card-create">
            <div>
              <p className="eyebrow"><Plus size={15} /> create room</p>
              <h2>创建新的听歌房间</h2>
              <p>适合给一轮主题、朋友聚会或长期歌单开一个展柜。</p>
            </div>
            <label>
              房间名称
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <button className="full-action" type="button" onClick={createRoom}><DoorOpen size={16} />创建房间</button>
          </article>

          {status && (
            <article className="room-card room-card-list">
              <p className="status-line">{status}</p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(() => loadJson('album-circle-session', null));
  const [routeState, setRouteState] = useState(() => parseRoomQuery());
  const [userSettings, setUserSettings] = useState(() => mergeUserSettings(session?.user?.settings));
  const [room, setRoom] = useState(null);
  const [knownRooms, setKnownRooms] = useState([]);
  const [roomDraft, setRoomDraft] = useState('新的听歌房间');
  const [inviteDraft, setInviteDraft] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [roomStatus, setRoomStatus] = useState('');
  const [mode, setMode] = useState('showroom');
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('');
  const [artistQuery, setArtistQuery] = useState('');
  const [link, setLink] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);
  const [glass, setGlass] = useState(() => mergeUserSettings(session?.user?.settings).appearance.glass);
  const [reduceMotion, setReduceMotion] = useState(() => mergeUserSettings(session?.user?.settings).appearance.reduceMotion);
  const [candidates, setCandidates] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [aiInsight, setAiInsight] = useState('');
  const [aiStatus, setAiStatus] = useState('idle');
  const [commentStatus, setCommentStatus] = useState('idle');
  const [itemStatus, setItemStatus] = useState('idle');
  const [initialLoading, setInitialLoading] = useState(true);
  const [backgroundStatus, setBackgroundStatus] = useState('idle');
  const [addPhase, setAddPhase] = useState('idle');
  const [commentAiStatus, setCommentAiStatus] = useState('idle');
  const [addError, setAddError] = useState('');
  const [resolvedLink, setResolvedLink] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [adminStatus, setAdminStatus] = useState('');
  const [aiPromptDraft, setAiPromptDraft] = useState('');
  const [personaPromptDraft, setPersonaPromptDraft] = useState('');
  const [aiMaxTokens, setAiMaxTokens] = useState(2100);
  const [personaMaxTokens, setPersonaMaxTokens] = useState(16000);
  const [personaChatMaxTokens, setPersonaChatMaxTokens] = useState(5200);
  const [aiTemperature, setAiTemperature] = useState(0.5);
  const [personaTemperature, setPersonaTemperature] = useState(0.72);
  const [profileDraft, setProfileDraft] = useState(() => profileToDraft(session?.user));
  const [profileStats, setProfileStats] = useState(null);
  const [profileStatus, setProfileStatus] = useState('');
  const [personaTone, setPersonaTone] = useState('warm');
  const [personaHistoryMode, setPersonaHistoryMode] = useState('mine');
  const [personaSelectedIds, setPersonaSelectedIds] = useState([]);
  const [personaStatus, setPersonaStatus] = useState('idle');
  const [personaReport, setPersonaReport] = useState(session?.user?.latestPersona || null);
  const [personaQuestion, setPersonaQuestion] = useState('');
  const [personaChatStatus, setPersonaChatStatus] = useState('idle');
  const [personaChat, setPersonaChat] = useState([]);
  const [discoverRooms, setDiscoverRooms] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [ratingsByItem, setRatingsByItem] = useState({});
  const [ratingStatus, setRatingStatus] = useState('idle');
  const [corridorOpen, setCorridorOpen] = useState(false);
  const [roomSettingsDraft, setRoomSettingsDraft] = useState({ visibility: 'unlisted', joinMode: 'open', discoverable: false, description: '', password: '', heroConfig: defaultHeroConfig });

  const routeItem = routeState.itemId ? items.find((item) => item.id === routeState.itemId) : null;
  const activeItem = routeItem || items.find((item) => item.id === activeId) || items[0];
  const palette = useCoverPalette(activeItem);
  const roomUrl = room ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.id)}` : '';
  const activeComments = activeItem ? comments.filter((comment) => {
    if (comment.albumId === activeItem.id || comment.albumTitle === activeItem.title) return true;
    const commentedItem = items.find((item) => item.id === comment.albumId);
    return Boolean(activeItem.type === 'album' && commentedItem && sameAlbum(commentedItem, activeItem));
  }) : [];
  const roomMembers = useMemo(() => {
    const profiles = room?.memberProfiles
      ? Object.entries(room.memberProfiles).map(([id, member]) => publicMemberProfile(member, id))
      : [];
    const fallback = session?.user ? [publicMemberProfile(session.user, session.user.id)] : [];
    const merged = (profiles.length ? profiles : fallback).map((member, index) => {
      const liveUser = member.id && member.id === session?.user?.id ? publicMemberProfile(session.user, session.user.id) : member;
      return {
        ...member,
        ...liveUser,
        id: liveUser.id || member.id,
        color: memberColors[index % memberColors.length]
      };
    });
    return merged.slice(0, 8);
  }, [room, session]);
  const visibleTopbarMembers = roomMembers.slice(0, 5);
  const hiddenTopbarMemberCount = Math.max(0, roomMembers.length - visibleTopbarMembers.length);
  const memberProfilesById = useMemo(() => {
    const profiles = {};
    Object.entries(room?.memberProfiles || {}).forEach(([id, member]) => {
      profiles[id] = publicMemberProfile(member, id);
    });
    if (session?.user?.id) profiles[session.user.id] = publicMemberProfile(session.user, session.user.id);
    Object.values(profiles).forEach((member) => {
      if (member.id) profiles[member.id] = member;
    });
    return profiles;
  }, [room?.memberProfiles, session?.user]);
  const selectedMember = selectedMemberId ? memberProfilesById[selectedMemberId] : null;
  const selectedMemberItems = selectedMemberId ? items.filter((item) => item.addedById === selectedMemberId) : [];

  const syncCurrentRoomMember = (user) => {
    if (!user?.id) return;
    const snapshot = publicMemberProfile(user, user.id);
    setRoom((current) => {
      if (!current?.id) return current;
      return {
        ...current,
        memberProfiles: {
          ...(current.memberProfiles || {}),
          [user.id]: {
            ...(current.memberProfiles?.[user.id] || {}),
            ...snapshot
          }
        }
      };
    });
  };

  const refreshRooms = async () => {
    if (!session?.token) return;
    const [mine, discover] = await Promise.all([
      api('/api/rooms', { session }),
      api('/api/rooms?scope=discover', { session }).catch(() => ({ rooms: [] }))
    ]);
    setKnownRooms(mine.rooms || []);
    setDiscoverRooms(discover.rooms || []);
  };

  useEffect(() => {
    initAnalytics().catch(() => null);
  }, []);

  useEffect(() => {
    const onPopState = () => setRouteState(parseRoomQuery());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!room?.id || routeState.itemId || routeState.view === 'cabinet' || mode !== 'showroom') return;
    const nextUrl = roomQueryUrl(room.id, { view: 'cabinet', mine: routeState.mineOnly ? '1' : '' });
    window.history.replaceState(null, '', nextUrl);
    setRouteState(parseRoomQuery());
  }, [room?.id, routeState.view, routeState.itemId, routeState.mineOnly, mode]);

  useEffect(() => {
    setRouteState(parseRoomQuery());
  }, [mode]);

  useEffect(() => {
    const settings = mergeUserSettings(session?.user?.settings);
    setUserSettings(settings);
    setGlass(settings.appearance.glass);
    setReduceMotion(settings.appearance.reduceMotion);
    setPersonaTone(settings.persona.tone);
    setPersonaHistoryMode(settings.persona.historyMode);
  }, [session?.user?.id, session?.user?.settings]);

  useEffect(() => {
    refreshRooms().catch(() => null);
  }, [session?.token, room?.id]);

  useEffect(() => {
    if (!session?.token) return;
    api('/api/auth', { session })
      .then((data) => {
        const next = { ...session, user: data.user };
        setSession(next);
        setProfileDraft(profileToDraft(data.user));
        setPersonaReport(data.user.latestPersona || null);
        saveJson('album-circle-session', next);
      })
      .catch(() => {
        localStorage.removeItem('album-circle-session');
        setSession(null);
      });
  }, []);

  useEffect(() => {
    if (session?.user) setProfileDraft(profileToDraft(session.user));
  }, [session?.user?.id]);

  const loadRoomData = async (targetRoom = room, options = {}) => {
    if (!session?.token || !targetRoom?.id) return;
    const [itemsData, commentsData] = await Promise.all([
      api(`/api/items?roomId=${encodeURIComponent(targetRoom.id)}`, { session }),
      api(`/api/comments?roomId=${encodeURIComponent(targetRoom.id)}`, { session })
    ]);
    setItems(itemsData.items || []);
    if (options.activeId !== undefined) {
      setActiveId(options.activeId);
    } else if (options.preserveActive) {
      setActiveId((current) => current || (itemsData.items || [])[0]?.id || '');
    } else {
      setActiveId((itemsData.items || [])[0]?.id || '');
    }
    setComments(commentsData.comments || []);
    setItemStatus('cloud');
    setCommentStatus('cloud');
  };

  useEffect(() => {
    if (!room) return;
    setRoomSettingsDraft({
      visibility: room.visibility || 'unlisted',
      joinMode: room.joinMode || 'open',
      discoverable: Boolean(room.discoverable),
      description: room.description || '',
      heroConfig: editableHeroConfig(room.heroConfig, room),
      password: ''
    });
  }, [room?.id, room?.visibility, room?.joinMode, room?.discoverable, room?.description, room?.heroConfig]);

  useEffect(() => {
    if (!items.length) return;
    if (routeState.itemId && items.some((item) => item.id === routeState.itemId)) {
      setActiveId(routeState.itemId);
      setMode('showroom');
    }
  }, [items, routeState.itemId]);

  useEffect(() => {
    if (activeItem?.id) loadRatingSummary(activeItem.id);
  }, [activeItem?.id, room?.id, session?.token]);

  useEffect(() => {
    if (!room?.id || !items.length || !session?.token) return;
    items.slice(0, 24).forEach((item) => {
      if (!ratingsByItem[item.id]) loadRatingSummary(item.id);
    });
  }, [room?.id, items.length, session?.token]);

  const loadProfileStats = async () => {
    if (!session?.token) return;
    setProfileStatus('正在读取个人音乐档案');
    try {
      const data = await api('/api/auth?action=stats', { session });
      setProfileStats(data.stats);
      setPersonaSelectedIds((current) => {
        const valid = new Set((data.stats?.recentAdds || []).map((item) => item.id));
        return current.filter((id) => valid.has(id));
      });
      setProfileStatus('');
    } catch (error) {
      setProfileStatus(error.message);
    }
  };

  useEffect(() => {
    loadRoomData().then(() => setInitialLoading(false)).catch((error) => {
      setInitialLoading(false);
      setItemStatus(error.message);
      setCommentStatus(error.message);
    });
  }, [room?.id, session?.token]);

  const logout = () => {
    localStorage.removeItem('album-circle-session');
    setSession(null);
    setRoom(null);
  };

  const updateSessionUser = (user) => {
    const next = { ...session, user };
    setSession(next);
    saveJson('album-circle-session', next);
  };

  const saveUserSettings = async (patch) => {
    const nextSettings = mergeUserSettings({
      ...userSettings,
      ...patch,
      appearance: { ...userSettings.appearance, ...(patch.appearance || {}) },
      showroom: { ...userSettings.showroom, ...(patch.showroom || {}) },
      filters: { ...userSettings.filters, ...(patch.filters || {}) },
      persona: { ...userSettings.persona, ...(patch.persona || {}) }
    });
    setUserSettings(nextSettings);
    setGlass(nextSettings.appearance.glass);
    setReduceMotion(nextSettings.appearance.reduceMotion);
    setPersonaTone(nextSettings.persona.tone);
    setPersonaHistoryMode(nextSettings.persona.historyMode);
    const data = await api('/api/auth', {
      session,
      method: 'POST',
      body: JSON.stringify({ action: 'updateSettings', settings: nextSettings })
    });
    updateSessionUser(data.user);
    return data.user.settings;
  };

  const saveProfile = async (draft = profileDraft) => {
    setProfileStatus('正在保存个人资料');
    try {
      const data = await api('/api/auth', {
        session,
        method: 'POST',
        body: JSON.stringify({ action: 'updateProfile', ...draft })
      });
      updateSessionUser(data.user);
      syncCurrentRoomMember(data.user);
      setProfileDraft(profileToDraft(data.user));
      setProfileStatus('个人资料已保存');
      return data.user;
    } catch (error) {
      setProfileStatus(error.message);
      throw error;
    }
  };

  const uploadAvatar = async (file) => {
    setProfileStatus('正在压缩并上传头像');
    try {
      const dataUrl = await imageFileToDataUrl(file);
      const data = await api('/api/auth', {
        session,
        method: 'POST',
        body: JSON.stringify({ action: 'avatar', dataUrl })
      });
      const nextDraft = { ...profileDraft, avatarUrl: data.avatarUrl || '', avatarDataUrl: data.avatarDataUrl || dataUrl };
      setProfileDraft(nextDraft);
      await saveProfile(nextDraft);
    } catch (error) {
      setProfileStatus(error.message);
    }
  };

  const fillProfileFromHistory = () => {
    const stats = profileStats || {};
    const profile = profileDraft.profile || {};
    setProfileDraft((current) => ({
      ...current,
      profile: {
        ...profile,
        favoriteArtists: [...new Set([...(profile.favoriteArtists || []), ...(stats.topArtists || []).slice(0, 8).map((item) => item.name)])].slice(0, 18),
        favoriteAlbums: [...new Set([...(profile.favoriteAlbums || []), ...(stats.topAlbums || []).slice(0, 8).map((item) => item.name)])].slice(0, 18),
        favoriteSongs: [...new Set([...(profile.favoriteSongs || []), ...(stats.recentAdds || []).filter((item) => item.type !== 'album').slice(0, 10).map((item) => `${item.title} - ${item.artist}`)])].slice(0, 24),
        favoriteGenres: [...new Set([...(profile.favoriteGenres || []), ...(stats.tags || []).slice(0, 8).map((item) => item.name)])].slice(0, 16)
      }
    }));
    setProfileStatus('已把历史添加记录填入偏好草稿，记得保存。');
  };

  const togglePersonaItem = (item) => {
    setPersonaSelectedIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id].slice(0, 24));
    setPersonaHistoryMode('selected');
  };

  const generatePersona = async () => {
    setPersonaStatus('thinking');
    try {
      await saveProfile(profileDraft);
      const data = await apiWithTimeout('/api/ai/recommend?action=persona', {
        session,
        method: 'POST',
        body: JSON.stringify({
          action: 'persona',
          tone: personaTone,
          history: { mode: personaHistoryMode, selected: personaSelectedIds }
        })
      }, 295000);
      setPersonaReport(data.report);
      setPersonaChat([]);
      const nextUser = { ...session.user, latestPersona: data.report };
      updateSessionUser(nextUser);
      setPersonaStatus(data.fallback ? 'fallback' : 'done');
    } catch (error) {
      setPersonaStatus(`error-${error.message}`);
    }
  };

  const askPersona = async (question = personaQuestion) => {
    const text = String(question || '').trim();
    if (!text) return;
    setPersonaChatStatus('thinking');
    setPersonaQuestion('');
    setPersonaChat((current) => [...current, { role: 'user', text }]);
    try {
      const data = await apiWithTimeout('/api/ai/recommend?action=persona-chat', {
        session,
        method: 'POST',
        body: JSON.stringify({
          action: 'persona-chat',
          question: text,
          report: personaReport,
          history: { mode: personaHistoryMode, selected: personaSelectedIds }
        })
      }, 140000);
      setPersonaChat((current) => [...current, { role: 'assistant', text: data.answer, sources: data.research?.sources || [] }]);
      setPersonaChatStatus(data.fallback ? 'fallback' : 'done');
    } catch (error) {
      setPersonaChatStatus(`error-${error.message}`);
    }
  };

  const addPublicTag = async (tag) => {
    const nextTags = [...new Set([...(profileDraft.publicTags || []), tag])].slice(0, 24);
    const nextDraft = { ...profileDraft, publicTags: nextTags };
    setProfileDraft(nextDraft);
    await saveProfile(nextDraft);
  };

  const createAnotherRoom = async () => {
    setRoomStatus('正在创建房间');
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({ name: roomDraft, slug: slugifyRoom(roomDraft) })
      });
      setRoom(data.room);
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
      await refreshRooms();
      setRoomStatus('');
    } catch (error) {
      setRoomStatus(error.message);
    }
  };

  const joinAnotherRoom = async () => {
    const raw = inviteDraft.trim();
    let parsed = raw;
    if (raw.includes('room=')) {
      try {
        parsed = new URL(raw, window.location.origin).searchParams.get('room') || '';
      } catch {
        parsed = raw.replace(/^.*room=/, '').split('&')[0];
      }
    }
    if (!parsed) return;
    setRoomStatus('正在加入房间');
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({ action: 'join', roomId: parsed, password: invitePassword })
      });
      setRoom(data.room);
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
      await refreshRooms();
      setRoomStatus('');
    } catch (error) {
      setRoomStatus(error.message);
    }
  };

  const saveRoomSettings = async () => {
    if (!room) return;
    setRoomStatus('正在保存房间设置');
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({
          action: 'settings',
          roomId: room.id,
          ...roomSettingsDraft,
          heroConfig: normalizeHeroConfig(roomSettingsDraft.heroConfig, room)
        })
      });
      setRoom(data.room);
      await refreshRooms();
      setRoomStatus('房间设置已保存');
    } catch (error) {
      setRoomStatus(error.message);
    }
  };

  const switchRoom = async (roomId) => {
    setRoomStatus('正在切换房间');
    try {
      const data = await api(`/api/rooms?roomId=${encodeURIComponent(roomId)}`, { session });
      setRoom(data.room);
      setItems([]);
      setComments([]);
      setActiveId('');
      setMode('showroom');
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
      setRouteState(parseRoomQuery());
      setRoomStatus('');
    } catch (error) {
      setRoomStatus(error.message);
    }
  };

  const openCabinet = (options = {}) => {
    if (!room) return;
    const mine = options.mineOnly ?? (routeState.mineOnly || userSettings.filters.mineOnly);
    const nextUrl = roomQueryUrl(room.id, { view: 'cabinet', mine: mine ? '1' : '' });
    window.history.pushState(null, '', nextUrl);
    setRouteState(parseRoomQuery());
    setMode('showroom');
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  };

  const openItemDetail = (itemId) => {
    if (!room || !itemId) return;
    setActiveId(itemId);
    const nextUrl = roomQueryUrl(room.id, { item: itemId, mine: routeState.mineOnly ? '1' : '' });
    window.history.pushState(null, '', nextUrl);
    setRouteState(parseRoomQuery());
    setMode('showroom');
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  };

  const loadRatingSummary = async (itemId = activeItem?.id) => {
    if (!room?.id || !itemId || !session?.token) return;
    try {
      const data = await api(`/api/ratings?roomId=${encodeURIComponent(room.id)}&itemId=${encodeURIComponent(itemId)}`, { session });
      setRatingsByItem((current) => ({ ...current, [itemId]: data }));
    } catch {
      setRatingsByItem((current) => ({ ...current, [itemId]: { average: 0, count: 0, mine: null } }));
    }
  };

  const submitRating = async (score) => {
    if (!room?.id || !activeItem?.id) return;
    setRatingStatus('saving');
    try {
      await api(`/api/ratings?roomId=${encodeURIComponent(room.id)}`, {
        session,
        method: 'POST',
        body: JSON.stringify({ itemId: activeItem.id, score })
      });
      await loadRatingSummary(activeItem.id);
      setRatingStatus('cloud');
    } catch (error) {
      setRatingStatus(error.message);
    }
  };

  const runOnlineSearch = async (overrides = {}) => {
    setSearchStatus('searching');
    setAddError('');
    setSelectedCandidate(null);
    try {
      const nextQuery = String(overrides.query ?? query).trim();
      const nextArtistQuery = String(overrides.artistQuery ?? artistQuery).trim();
      const explicitLink = String(overrides.link ?? link).trim();
      const pastedLink = explicitLink || (/^https?:\/\//i.test(nextQuery) ? nextQuery : '');
      if (pastedLink) {
        const resolvedData = await api(`/api/resolve-link?input=${encodeURIComponent(pastedLink)}`);
        setResolvedLink(resolvedData);
      } else {
        setResolvedLink(null);
      }
      const searchTerm = pastedLink || [nextArtistQuery, nextQuery].filter(Boolean).join(' ').trim();
      const params = new URLSearchParams({
        term: searchTerm,
        type: searchType,
        title: pastedLink ? '' : nextQuery,
        artist: pastedLink ? '' : nextArtistQuery,
        link: pastedLink
      });
      const data = await api(`/api/search?${params.toString()}`);
      setCandidates(data.candidates || []);
      setSelectedCandidate(null);
      setSearchStatus(`found-${data.candidates?.length || 0}`);
    } catch (error) {
      setSearchStatus(`error-${error.message}`);
    }
  };

  const completeBackground = async (candidate) => {
    setAddPhase('ai');
    setBackgroundStatus('thinking');
    try {
      const data = await apiWithTimeout('/api/ai/background', {
        session,
        method: 'POST',
        body: JSON.stringify({ item: candidate })
      }, 245000);
      if (!data.background && !data.aiProfile) {
        throw new Error(data.error || '导览没有生成可用内容，本次没有写入展柜，请重试。');
      }
      setBackgroundStatus('done');
      return {
        ...candidate,
        background: data.background || candidate.context,
        context: data.background || candidate.context,
        aiProfile: data.aiProfile
          ? { ...data.aiProfile, sources: data.research?.sources || data.aiProfile.sources || [] }
          : candidate.aiProfile,
        tags: [...new Set([...(candidate.tags || []), ...(data.tags || [])])].slice(0, 8)
      };
    } catch (error) {
      setBackgroundStatus('error');
      throw error;
    }
  };

  const addSelectedToShowroom = async () => {
    if (!selectedCandidate || !room) return false;
    setItemStatus('adding');
    setAddPhase('metadata');
    setAddError('');
    try {
      const enriched = await completeBackground(selectedCandidate);
      setAddPhase('writing');
      const data = await api(`/api/items?roomId=${encodeURIComponent(room.id)}`, {
        session,
        method: 'POST',
        body: JSON.stringify(enriched)
      });
      setItems((current) => [data.item, ...current.filter((item) => item.id !== data.item.id)]);
      setActiveId(data.item.id);
      openItemDetail(data.item.id);
      setItemStatus('cloud');
      await loadRoomData(room, { preserveActive: true });
      setAddPhase('done');
      return true;
    } catch (error) {
      setAddError(error.message);
      setItemStatus('error');
      setBackgroundStatus('error');
      setAddPhase('error');
      return false;
    }
  };

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || !activeItem || !room) return;
    const tempId = `temp-comment-${Date.now()}`;
    const optimistic = {
      id: tempId,
      text,
      mood: '9.0',
      albumId: activeItem.id,
      albumTitle: activeItem.title,
      author: session.user.name,
      avatar: session.user.avatar,
      pending: true,
      createdAt: new Date().toISOString()
    };
    // 乐观更新：立即插入临时评论，输入框清空，等待 API 往返
    setComments((current) => [optimistic, ...current]);
    setDraft('');
    setCommentStatus('sending');
    try {
      const data = await api(`/api/comments?roomId=${encodeURIComponent(room.id)}`, {
        session,
        method: 'POST',
        body: JSON.stringify({ text, mood: '9.0', albumId: activeItem.id, albumTitle: activeItem.title })
      });
      // 成功：用真实数据替换临时评论
      setComments((current) => current.map((entry) => (entry.id === tempId ? data.comment : entry)));
      setCommentStatus('cloud');
      setCommentAiStatus('thinking');
      api(`/api/ai/comment?roomId=${encodeURIComponent(room.id)}`, {
        session,
        method: 'POST',
        body: JSON.stringify({ item: activeItem, comment: data.comment })
      })
        .then((reply) => {
          if (reply.comment) setComments((current) => [reply.comment, ...current]);
          setCommentAiStatus('done');
        })
        .catch((error) => {
          setCommentAiStatus(error.message || 'error');
        });
    } catch (error) {
      // 失败：移除临时评论、还原草稿、弹出错误 toast
      setComments((current) => current.filter((entry) => entry.id !== tempId));
      setDraft(text);
      setCommentStatus(error.message || '发送失败');
      toast.error('评论发送失败', { description: error.message || '网络异常，请稍后重试' });
    }
  };

  const askAi = async () => {
    if (!activeItem) return;
    setAiStatus('thinking');
    try {
      const data = await api('/api/ai/recommend', {
        session,
        method: 'POST',
        body: JSON.stringify({ album: activeItem, comments: activeComments })
      });
      setAiInsight(data.text);
      setAiStatus('done');
    } catch (error) {
      setAiInsight(error.message);
      setAiStatus('error');
    }
  };

  const deleteItem = async (item) => {
    if (!item || !room) return;
    setItemStatus('正在删除');
    try {
      await api(`/api/items?roomId=${encodeURIComponent(room.id)}&itemId=${encodeURIComponent(item.id)}`, { session, method: 'DELETE' });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setActiveId((current) => (current === item.id ? '' : current));
      setItemStatus('cloud');
      await loadRoomData(room, { preserveActive: true });
    } catch (error) {
      setItemStatus(error.message);
    }
  };

  const deleteComment = async (comment) => {
    if (!comment || !room) return;
    setCommentStatus('正在删除');
    try {
      await api(`/api/comments?roomId=${encodeURIComponent(room.id)}&commentId=${encodeURIComponent(comment.id)}`, { session, method: 'DELETE' });
      setComments((current) => current.filter((entry) => entry.id !== comment.id));
      setCommentStatus('cloud');
    } catch (error) {
      setCommentStatus(error.message);
    }
  };

  const requestConfirm = ({ title, message, confirmLabel = '确认', tone = 'danger', action }) => {
    setConfirmAction({ title, message, confirmLabel, tone, action });
  };

  const closeConfirm = () => setConfirmAction(null);

  const confirmDeleteItem = (item) => requestConfirm({
    title: '删除这个展柜条目？',
    message: `《${item?.title || '这个条目'}》会从当前房间移除，相关评论不会自动改写。`,
    confirmLabel: '删除条目',
    action: () => deleteItem(item)
  });

  const confirmDeleteComment = (comment) => requestConfirm({
    title: '删除这条评论？',
    message: '这条评论会从房间里移除。删除后不能从界面恢复。',
    confirmLabel: '删除评论',
    action: () => deleteComment(comment)
  });

  const loadAdmin = async () => {
    if (session?.user?.role !== 'admin') return;
    setAdminStatus('正在加载管理数据');
    try {
      const data = await api('/api/admin', { session });
      setAdminData(data);
      setAiPromptDraft(data.config?.customPrompt || '');
      setPersonaPromptDraft(data.config?.personaPrompt || '');
      setAiMaxTokens(data.config?.maxTokens || 2100);
      setPersonaMaxTokens(data.config?.personaMaxTokens || 16000);
      setPersonaChatMaxTokens(data.config?.personaChatMaxTokens || 5200);
      setAiTemperature(data.config?.temperature ?? 0.5);
      setPersonaTemperature(data.config?.personaTemperature ?? 0.72);
      setAdminStatus('');
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const saveAiConfig = async () => {
    setAdminStatus('正在保存 AI 配置');
    try {
      const data = await api('/api/admin?action=config', {
        session,
        method: 'POST',
        body: JSON.stringify({
          customPrompt: aiPromptDraft,
          personaPrompt: personaPromptDraft,
          maxTokens: aiMaxTokens,
          personaMaxTokens,
          personaChatMaxTokens,
          temperature: aiTemperature,
          personaTemperature
        })
      });
      setAdminData((current) => ({ ...(current || {}), config: data.config }));
      setAdminStatus('AI 配置已保存');
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const adminDeleteRoom = async (roomId) => {
    setAdminStatus('正在删除房间');
    try {
      await api(`/api/admin?action=room&roomId=${encodeURIComponent(roomId)}`, { session, method: 'DELETE' });
      if (room?.id === roomId) {
        setRoom(null);
        setItems([]);
        setComments([]);
      }
      await loadAdmin();
      setAdminStatus('房间已删除');
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const adminDeleteUser = async (userId) => {
    setAdminStatus('正在删除用户');
    try {
      await api(`/api/admin?action=user&userId=${encodeURIComponent(userId)}`, { session, method: 'DELETE' });
      await loadAdmin();
      setAdminStatus('用户已删除');
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const confirmAdminDeleteRoom = (roomId) => requestConfirm({
    title: '删除这个房间？',
    message: `房间 ${roomId} 的展柜、评论和成员记录都会被移除。`,
    confirmLabel: '删除房间',
    action: () => adminDeleteRoom(roomId)
  });

  const confirmAdminDeleteUser = (userId) => requestConfirm({
    title: '删除这个用户？',
    message: `用户 ${userId} 将无法继续使用当前账号数据。`,
    confirmLabel: '删除用户',
    action: () => adminDeleteUser(userId)
  });

  useEffect(() => {
    if (mode === 'admin') loadAdmin();
    if (mode === 'profile') loadProfileStats();
  }, [mode, session?.user?.role]);

  if (!session?.token) return <AuthGate session={session} setSession={setSession} />;
  if (!room) return <RoomGate session={session} room={room} setRoom={setRoom} />;
  const isWorking = searchStatus === 'searching' || backgroundStatus === 'thinking' || itemStatus === 'adding' || ratingStatus === 'saving';
  const isDetailPage = mode === 'showroom' && routeState.itemId && routeItem;
  const isCabinetPage = mode === 'showroom' && !isDetailPage;
  const showInspector = mode === 'room';

  return (
    <main className={`${reduceMotion ? 'app reduce-motion' : 'app'} ${isWorking && userSettings.appearance.rainbowStatus ? 'app-breathing' : ''}`} style={{ '--cover-a': palette[0], '--cover-b': palette[1], '--cover-c': palette[2], '--cover-image': cssImageUrl(activeItem?.cover || ''), '--glass-alpha': glass / 100 }}>
      <div className="aurora" aria-hidden="true" />
      <Toaster position="bottom-right" theme="dark" duration={4000} closeButton offset={20} gap={12} />
      {isWorking && userSettings.appearance.rainbowStatus && <div className="rainbow-status-frame" aria-hidden="true" />}
      <section className="shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <header className="topbar glass-panel">
          <button type="button" className="brand corridor-secret-trigger" onClick={() => setCorridorOpen(true)} aria-label="打开隐藏封面长廊" title="隐藏封面长廊">
            <span className="brand-mark">
              <span className="brand-vinyl-mark" aria-hidden="true">
                <span />
              </span>
            </span>
            <span className="brand-copy">
              <strong>{room.name}</strong>
              <span>Album Circle · {items.length} 个展柜条目</span>
            </span>
          </button>
          <nav className="mode-tabs" aria-label="模式">
            {[
              ['showroom', Grid3X3, '展柜'],
              ['add', CirclePlus, '添加'],
              ['review', MessageCircle, '评论'],
              ['ai', Bot, 'AI'],
              ['room', Users, '房间'],
              ['profile', UserRound, '我的'],
              ...(session.user.role === 'admin' ? [['admin', LockKeyhole, '管理']] : [])
            ].map(([key, Icon, label]) => (
              <button
                key={key}
                className={mode === key ? 'active' : ''}
                onClick={() => {
                  if (key === 'showroom') {
                    openCabinet({ mineOnly: routeState.mineOnly || userSettings.filters.mineOnly });
                    return;
                  }
                  setMode(key);
                }}
                type="button"
              >
                <Icon size={17} /><span>{label}</span>
              </button>
            ))}
          </nav>
          <GlobalMusicSearch
            room={room}
            session={session}
            searchType={searchType}
            setSearchType={setSearchType}
            runSearch={runOnlineSearch}
            query={query}
            setQuery={setQuery}
            artistQuery={artistQuery}
            setArtistQuery={setArtistQuery}
            link={link}
            setLink={setLink}
            searchStatus={searchStatus}
            candidates={candidates}
            selectedCandidate={selectedCandidate}
            setSelectedCandidate={setSelectedCandidate}
            addSelectedToShowroom={addSelectedToShowroom}
            isAdding={backgroundStatus === 'thinking' || itemStatus === 'adding'}
            addPhase={addPhase}
            addError={addError}
          />
          <div className="member-stack" role="group" aria-label="房间成员">
            {visibleTopbarMembers.map((member) => (
              <button key={member.id || member.name} type="button" aria-label={`查看 ${member.name} 的公开资料`} title={`查看 ${member.name} 的公开资料`} style={{ '--dot': member.color }} onClick={() => setSelectedMemberId(member.id)}>
                <UserAvatar user={member} />
              </button>
            ))}
            {hiddenTopbarMemberCount > 0 && (
              <button type="button" className="member-count" aria-label={`还有 ${hiddenTopbarMemberCount} 位房间成员，进入房间查看`} title={`还有 ${hiddenTopbarMemberCount} 位房间成员`} onClick={() => setMode('room')}>
                +{hiddenTopbarMemberCount}
              </button>
            )}
          </div>
        </header>

        <section id="main-content" className={`workspace single-workspace ${isDetailPage ? 'detail-workspace' : ''} ${isCabinetPage ? 'cabinet-workspace' : ''} ${!showInspector ? 'no-inspector-workspace' : ''}`}>
          <section className="main-stage wide-stage">
            {mode === 'showroom' && (
              routeState.itemId && routeItem ? (
                <AlbumDetailPage
                  items={items}
                  activeItem={activeItem}
                  activeComments={activeComments}
                  draft={draft}
                  setDraft={setDraft}
                  submitComment={submitComment}
                  commentStatus={commentStatus}
                  commentAiStatus={commentAiStatus}
                  setActiveId={setActiveId}
                  setMode={setMode}
                  openCabinet={openCabinet}
                  openItemDetail={openItemDetail}
                  askAi={askAi}
                  itemStatus={itemStatus}
                  session={session}
                  deleteItem={confirmDeleteItem}
                  deleteComment={confirmDeleteComment}
                  memberProfilesById={memberProfilesById}
                  openMember={setSelectedMemberId}
                  ratingSummary={ratingsByItem[activeItem.id]}
                  submitRating={submitRating}
                  ratingStatus={ratingStatus}
                  loading={initialLoading}
                  userSettings={userSettings}
                />
              ) : (
                <AlbumCabinetPage
                  room={room}
                  items={items}
                  activeItem={activeItem}
                  openItemDetail={openItemDetail}
                  setMode={setMode}
                  ratingsByItem={ratingsByItem}
                  memberProfilesById={memberProfilesById}
                  userSettings={userSettings}
                  saveUserSettings={saveUserSettings}
                  loading={initialLoading}
                  currentUserId={session.user.id}
                  mineOnly={routeState.mineOnly || userSettings.filters.mineOnly}
                  setMineOnly={(value) => {
                    const nextUrl = roomQueryUrl(room.id, { view: 'cabinet', mine: value ? '1' : '' });
                    window.history.pushState(null, '', nextUrl);
                    setRouteState(parseRoomQuery());
                  }}
                />
              )
            )}
            {mode === 'add' && <AddMusic query={query} setQuery={setQuery} artistQuery={artistQuery} setArtistQuery={setArtistQuery} link={link} setLink={setLink} searchType={searchType} setSearchType={setSearchType} setSearchStatus={setSearchStatus} setCandidates={setCandidates} resolvedLink={resolvedLink} runOnlineSearch={runOnlineSearch} searchStatus={searchStatus} candidates={candidates} selectedCandidate={selectedCandidate} setSelectedCandidate={setSelectedCandidate} addSelectedToShowroom={addSelectedToShowroom} backgroundStatus={backgroundStatus} itemStatus={itemStatus} addPhase={addPhase} addError={addError} />}
            {mode === 'review' && <Review selected={activeItem} comments={activeComments} draft={draft} setDraft={setDraft} submitComment={submitComment} commentStatus={commentStatus} commentAiStatus={commentAiStatus} session={session} deleteComment={confirmDeleteComment} memberProfilesById={memberProfilesById} openMember={setSelectedMemberId} loading={initialLoading} />}
            {mode === 'ai' && <Ai selected={activeItem} aiInsight={aiInsight} aiStatus={aiStatus} askAi={askAi} />}
            {mode === 'room' && <RoomPanel room={room} roomUrl={roomUrl} session={session} comments={comments} items={items} knownRooms={knownRooms} discoverRooms={discoverRooms} switchRoom={switchRoom} roomDraft={roomDraft} setRoomDraft={setRoomDraft} createAnotherRoom={createAnotherRoom} inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} invitePassword={invitePassword} setInvitePassword={setInvitePassword} joinAnotherRoom={joinAnotherRoom} roomStatus={roomStatus} roomSettingsDraft={roomSettingsDraft} setRoomSettingsDraft={setRoomSettingsDraft} saveRoomSettings={saveRoomSettings} userSettings={userSettings} saveUserSettings={saveUserSettings} />}
            {mode === 'profile' && <ProfilePanel session={session} profileDraft={profileDraft} setProfileDraft={setProfileDraft} saveProfile={saveProfile} uploadAvatar={uploadAvatar} profileStats={profileStats} profileStatus={profileStatus} loadProfileStats={loadProfileStats} fillProfileFromHistory={fillProfileFromHistory} personaTone={personaTone} setPersonaTone={setPersonaTone} personaHistoryMode={personaHistoryMode} setPersonaHistoryMode={setPersonaHistoryMode} personaSelectedIds={personaSelectedIds} togglePersonaItem={togglePersonaItem} generatePersona={generatePersona} personaStatus={personaStatus} personaReport={personaReport} addPublicTag={addPublicTag} personaQuestion={personaQuestion} setPersonaQuestion={setPersonaQuestion} askPersona={askPersona} personaChat={personaChat} personaChatStatus={personaChatStatus} />}
            {mode === 'admin' && <AdminPanel adminData={adminData} adminStatus={adminStatus} loadAdmin={loadAdmin} deleteRoom={confirmAdminDeleteRoom} deleteUser={confirmAdminDeleteUser} aiPromptDraft={aiPromptDraft} setAiPromptDraft={setAiPromptDraft} personaPromptDraft={personaPromptDraft} setPersonaPromptDraft={setPersonaPromptDraft} aiMaxTokens={aiMaxTokens} setAiMaxTokens={setAiMaxTokens} personaMaxTokens={personaMaxTokens} setPersonaMaxTokens={setPersonaMaxTokens} personaChatMaxTokens={personaChatMaxTokens} setPersonaChatMaxTokens={setPersonaChatMaxTokens} aiTemperature={aiTemperature} setAiTemperature={setAiTemperature} personaTemperature={personaTemperature} setPersonaTemperature={setPersonaTemperature} saveAiConfig={saveAiConfig} />}
          </section>
          {showInspector && <aside className="inspector glass-panel">
            <div className="section-title"><Wand2 size={18} /><h2>房间状态</h2></div>
            <div className="agent-feed">
              {[
                ['账号', session.user.name],
                ['房间', room.name],
                ['展柜', `${items.length} 个条目`],
                ['评论', `${comments.length} 条评论`],
                ['同步', itemStatus === 'cloud' && commentStatus === 'cloud' ? '已连接' : '同步中']
              ].map(([name, detail], index) => (
                <div className="agent-step" key={name}><span>{index + 1}</span><div><strong>{name}</strong><p>{detail}</p></div></div>
              ))}
            </div>
            <div className="control-block">
              <button type="button" onClick={askAi} disabled={!activeItem}><Bot size={16} />围绕当前条目请求 AI</button>
              {aiInsight && <p className="ai-insight">{aiInsight}</p>}
              <label>玻璃强度<input type="range" min="35" max="82" value={glass} onChange={(event) => setGlass(Number(event.target.value))} /></label>
              <button type="button" onClick={() => setReduceMotion((value) => !value)}>{reduceMotion ? '恢复动效' : '减少动效'}</button>
            </div>
          </aside>}
        </section>
        {selectedMember && (
          <MemberProfileModal
            member={selectedMember}
            items={selectedMemberItems}
            close={() => setSelectedMemberId('')}
            openItem={(itemId) => {
              setSelectedMemberId('');
              openItemDetail(itemId);
            }}
          />
        )}
        <ExperimentalCorridorCarousel
          open={corridorOpen}
          onClose={() => setCorridorOpen(false)}
          items={items}
          activeItem={activeItem}
          roomName={room.name}
          reduceMotion={reduceMotion}
          openItemDetail={openItemDetail}
        />
        {confirmAction && <ConfirmDialog config={confirmAction} close={closeConfirm} />}
      </section>
    </main>
  );
}

function GlobalMusicSearch({ searchType, setSearchType, runSearch, query, setQuery, artistQuery, setArtistQuery, link, setLink, searchStatus, candidates, selectedCandidate, setSelectedCandidate, addSelectedToShowroom, isAdding, addPhase, addError }) {
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(query || '');
  const [addingElapsed, setAddingElapsed] = useState(0);
  const searchRef = useRef(null);
  const popoverRef = useRef(null);
  const queryInputRef = useRef(null);
  const suppressFocusOpenRef = useRef(false);
  const phaseSteps = [
    ['metadata', '读取资料'],
    ['ai', '生成导览'],
    ['writing', '写入展柜']
  ];
  const activePhaseIndex = addPhase === 'done' ? phaseSteps.length : Math.max(0, phaseSteps.findIndex(([key]) => key === addPhase));
  const isAddingSelection = Boolean(isAdding && selectedCandidate);
  const activePhaseLabel = phaseSteps[Math.max(0, Math.min(activePhaseIndex, phaseSteps.length - 1))]?.[1] || '整理资料';
  const addingProgress = `${Math.max(18, Math.min(100, Math.round(((Math.min(activePhaseIndex, phaseSteps.length - 1) + 1) / phaseSteps.length) * 100)))}%`;
  const activePhaseDetail = {
    metadata: '抓取封面、曲目、发行年份和来源信息。',
    ai: '联网整理资料，用 AI 写成可读的专辑导览。',
    writing: '同步到房间展柜，准备刷新陈列墙。'
  }[addPhase] || '正在把这张唱片整理成房间里的完整条目。';
  const elapsedLabel = `${Math.floor(addingElapsed / 60)}:${String(addingElapsed % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      const insideSearch = searchRef.current?.contains(event.target);
      const insidePopover = popoverRef.current?.contains(event.target);
      if (!insideSearch && !insidePopover) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        queryInputRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!isAddingSelection) {
      setAddingElapsed(0);
      return undefined;
    }
    const startedAt = Date.now();
    setAddingElapsed(0);
    const timer = window.setInterval(() => {
      setAddingElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isAddingSelection, selectedCandidate?.id]);

  const closePopover = () => {
    suppressFocusOpenRef.current = true;
    setOpen(false);
    window.setTimeout(() => {
      suppressFocusOpenRef.current = false;
    }, 180);
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextQuery = localQuery.trim();
    const nextLink = link.trim();
    if (!nextQuery && !nextLink) {
      setOpen(false);
      setSelectedCandidate(null);
      return;
    }
    setQuery(localQuery);
    setArtistQuery('');
    setOpen(true);
    await runSearch({ query: localQuery, artistQuery: '', link });
  };

  const chooseCandidate = (candidate) => {
    setSelectedCandidate(candidate);
    setOpen(true);
  };

  const addAndClose = async () => {
    const added = await addSelectedToShowroom();
    if (added !== false) setOpen(false);
  };

  const submitLink = async (event) => {
    event.preventDefault();
    if (!link.trim()) return;
    setOpen(true);
    await runSearch({ query: '', artistQuery: '', link });
  };

  const updateSearchType = (key) => {
    setSearchType(key);
    setSelectedCandidate(null);
    setOpen(true);
  };

  const popover = (
    <div id="global-search-popover" className={`global-search-popover ${isAddingSelection ? 'is-adding' : ''}`} role="dialog" aria-label="音乐搜索结果" ref={popoverRef}>
      <button
        type="button"
        className="popover-close"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          closePopover();
        }}
        aria-label="关闭搜索结果"
      >
        ×
      </button>
      {isAddingSelection ? (
        <div
          className="global-adding-focus"
          style={{
            '--adding-cover': cssImageUrl(selectedCandidate.cover),
            '--adding-progress': addingProgress,
            '--adding-a': selectedCandidate.palette?.[0] || 'var(--cover-a)',
            '--adding-b': selectedCandidate.palette?.[1] || 'var(--cover-b)',
            '--adding-c': selectedCandidate.palette?.[2] || 'var(--cover-c)'
          }}
        >
          <div className="global-adding-coverwash" aria-hidden="true" />
          <div className="global-adding-stage" aria-hidden="true">
            <div className="global-adding-orbit" />
            <div className="global-adding-disc" />
            <div className="global-adding-cover-frame">
              <AlbumArt item={selectedCandidate} className="global-adding-art" />
              <span />
            </div>
            <div className="global-adding-scan" />
          </div>
          <div className="global-adding-copy" aria-live="polite">
            <p className="eyebrow"><Sparkles size={14} /> 正在加入展柜</p>
            <h3>{selectedCandidate.title}</h3>
            <p className="global-adding-meta">{selectedCandidate.artist} · {selectedCandidate.type === 'album' ? `${selectedCandidate.tracks?.length || 0} 首曲目` : selectedCandidate.albumTitle || '单曲'}</p>
            <div className="global-adding-process">
              <div>
                <strong>{activePhaseLabel}</strong>
                <span>{activePhaseDetail}</span>
              </div>
              <small>已等待 {elapsedLabel} · 通常 1-3 分钟</small>
            </div>
            <div className="global-adding-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={parseInt(addingProgress, 10)} aria-label="添加进度">
              <i />
            </div>
            <div className="global-adding-phases">
              {phaseSteps.map(([key, label], index) => (
                <span key={key} className={index <= activePhaseIndex ? 'active' : ''}>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  {label}
                </span>
              ))}
            </div>
            <p className="global-adding-note">正在生成更完整的背景、标签和导览。候选列表已暂时收起，避免添加时误点。</p>
            {addError && <p className="status-line error-line">{addError}</p>}
          </div>
        </div>
      ) : (
        <>
          <div className="global-popover-head">
            <form className="link-inline" onSubmit={submitLink}>
              <label>分享链接
                <input type="url" inputMode="url" name="global-share-link" autoComplete="off" spellCheck={false} value={link} onChange={(event) => setLink(event.target.value)} placeholder="Spotify / Apple / 网易云 / QQ 链接…" />
              </label>
            </form>
            <div className="search-live-status" aria-live="polite">
              {searchStatus === 'idle' && '输入专辑、歌曲、艺人，或用空格组合后按 Enter 搜索。'}
              {searchStatus === 'searching' && '正在从曲库里匹配候选…'}
              {searchStatus.startsWith('found-') && `找到 ${searchStatus.replace('found-', '')} 个候选。`}
              {searchStatus.startsWith('error-') && `搜索失败：${searchStatus.replace('error-', '')}`}
            </div>
          </div>
          <div className="global-popover-body">
            <div className="global-results-pane">
              {searchStatus === 'searching' && <div className="candidate-skeleton-grid">{Array.from({ length: 5 }).map((_, index) => <span key={index} />)}</div>}
              {searchStatus.startsWith('found-') && candidates.length === 0 && <p className="empty-state compact-empty">没有找到候选，试试补上艺人名或换成分享链接。</p>}
              <div className="global-candidate-grid" role="list" aria-label="候选音乐">
                {candidates.map((candidate) => (
                  <button key={candidate.id} type="button" role="listitem" aria-pressed={selectedCandidate?.id === candidate.id} className={selectedCandidate?.id === candidate.id ? 'global-candidate selected' : 'global-candidate'} onClick={() => chooseCandidate(candidate)}>
                    <AlbumArt item={candidate} size="thumb" />
                    <span><strong>{candidate.title}</strong><small>{candidate.artist} · {candidate.year || candidate.albumTitle}</small><small>{candidate.type === 'album' ? '专辑' : '单曲'} · {candidate.source} · {candidate.match}%</small></span>
                  </button>
                ))}
              </div>
            </div>
            <aside className="global-confirm">
              {selectedCandidate ? (
                <>
                  <AlbumArt item={selectedCandidate} size="thumb" />
                  <div>
                    <strong>{selectedCandidate.title}</strong>
                    <span>{selectedCandidate.artist} · {selectedCandidate.type === 'album' ? `${selectedCandidate.tracks?.length || 0} 首曲目` : selectedCandidate.albumTitle}</span>
                  </div>
                  <button type="button" onClick={addAndClose} disabled={isAdding}><CirclePlus size={15} />加入展柜</button>
                </>
              ) : (
                <div className="global-confirm-empty">
                  <Disc3 size={28} />
                  <strong>选择一个候选</strong>
                  <span>封面、艺人、年份和来源会在这里确认。</span>
                </div>
              )}
            </aside>
          </div>
          {addError && <p className="status-line error-line">{addError}</p>}
        </>
      )}
    </div>
  );

  return (
    <form className="global-search" role="search" onSubmit={submit} ref={searchRef}>
      <div className="global-search-field">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          name="global-music-search"
          autoComplete="off"
          spellCheck={false}
          ref={queryInputRef}
          value={localQuery}
          onFocus={() => {
            if (suppressFocusOpenRef.current) return;
            setOpen(true);
          }}
          onChange={(event) => {
            setLocalQuery(event.target.value);
            setSelectedCandidate(null);
          }}
          placeholder="专辑 / 艺人 / 歌曲 / 链接…"
          aria-label="快速搜索专辑或歌曲"
          aria-expanded={open}
          aria-controls="global-search-popover"
        />
        <button type="submit" disabled={searchStatus === 'searching'} aria-label="搜索音乐">
          {searchStatus === 'searching' ? <Sparkles size={16} /> : <Search size={16} />}
        </button>
      </div>
      <div className="global-search-types" role="group" aria-label="搜索类型">
        {[
          ['all', '全部'],
          ['album', '专辑'],
          ['song', '单曲']
        ].map(([key, label]) => <button key={key} type="button" aria-pressed={searchType === key} className={searchType === key ? 'active' : ''} onClick={() => updateSearchType(key)}>{label}</button>)}
      </div>
      {open && createPortal(popover, document.body)}
    </form>
  );
}

function AlbumCabinetPage({ room, items, openItemDetail, setMode, ratingsByItem, memberProfilesById, userSettings, saveUserSettings, currentUserId, loading, mineOnly, setMineOnly }) {
  const layout = userSettings.showroom.wallLayout || '4x3';
  const hoverPreview = userSettings.showroom.hoverPreview || 'flip';
  const showCaptions = Boolean(userSettings.showroom.showCaptions);
  const [sort, setSort] = useState(userSettings.filters?.sort || 'recent');
  const [typeFilter, setTypeFilter] = useState(userSettings.filters?.type || 'all');
  const [ratedFilter, setRatedFilter] = useState(userSettings.filters?.rated || 'all');

  // 筛选 / 排序条件持久化到 userSettings.filters（复用已有 saveUserSettings）
  const firstFiltersRun = useRef(true);
  useEffect(() => {
    if (firstFiltersRun.current) {
      firstFiltersRun.current = false;
      return;
    }
    saveUserSettings({ filters: { sort, type: typeFilter, rated: ratedFilter, mineOnly } });
  }, [sort, typeFilter, ratedFilter, mineOnly]);

  const visibleItems = useMemo(() => {
    let list = items;
    if (mineOnly) list = list.filter((item) => item.addedById === currentUserId);
    if (typeFilter !== 'all') list = list.filter((item) => item.type === typeFilter);
    if (ratedFilter === 'rated') list = list.filter((item) => (ratingsByItem[item.id]?.count || 0) > 0);
    if (ratedFilter === 'unrated') list = list.filter((item) => !(ratingsByItem[item.id]?.count > 0));
    const sorted = [...list];
    if (sort === 'rating') sorted.sort((a, b) => (ratingsByItem[b.id]?.average || 0) - (ratingsByItem[a.id]?.average || 0));
    else if (sort === 'year') sorted.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    else if (sort === 'title') sorted.sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh'));
    else sorted.sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')));
    return sorted;
  }, [items, mineOnly, typeFilter, ratedFilter, sort, ratingsByItem, currentUserId]);
  const cabinetTitle = cabinetDisplayTitle(userSettings.showroom.title, room.name);
  const cabinetDescription = (userSettings.showroom.description || '').trim() || '悬浮封面查看背面资料，点击进入专辑的黑胶开场和完整导览。';
  const layoutLabel = wallLayoutPresets[layout]?.label || wallLayoutPresets['4x3'].label;
  const hoverLabel = hoverPreviewLabels[hoverPreview] || hoverPreviewLabels.flip;

  return (
    <section className="panel-content cabinet-page">
      <div className="cabinet-head">
        <div className="cabinet-title-block">
          <p className="eyebrow"><Grid3X3 size={15} /> {room.name} / album cabinet</p>
          <div className="cabinet-title-row">
            <h1>{cabinetTitle}</h1>
          </div>
          <p>{cabinetDescription}</p>
        </div>
        <div className="cabinet-actions" aria-label="陈列柜摘要">
          <CabinetSettingsPopover
            userSettings={userSettings}
            saveUserSettings={saveUserSettings}
            defaultTitle="专辑陈列柜"
            defaultDescription="悬浮封面查看背面资料，点击进入专辑的黑胶开场和完整导览。"
            mineOnly={mineOnly}
            setMineOnly={setMineOnly}
          />
          <span className="cabinet-summary-chip"><Grid3X3 size={15} />{layoutLabel}</span>
          <span className="cabinet-summary-chip"><Sparkles size={15} />{hoverLabel}</span>
          {mineOnly && <span className="cabinet-summary-chip active"><UserRound size={15} />只看自己</span>}
          <button type="button" className="secondary-chip" onClick={() => setMode('add')}><CirclePlus size={16} />高级添加</button>
        </div>
      </div>
      <div className="cabinet-filters" role="group" aria-label="筛选与排序">
        <label>排序
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="排序方式">
            <option value="recent">添加时间</option>
            <option value="rating">评分</option>
            <option value="year">年份</option>
            <option value="title">标题</option>
          </select>
        </label>
        <label>类型
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="筛选类型">
            <option value="all">全部</option>
            <option value="album">专辑</option>
            <option value="song">单曲</option>
          </select>
        </label>
        <label>评分
          <select value={ratedFilter} onChange={(event) => setRatedFilter(event.target.value)} aria-label="筛选评分">
            <option value="all">全部</option>
            <option value="rated">有评分</option>
            <option value="unrated">未评分</option>
          </select>
        </label>
      </div>
      <AlbumCabinetGrid items={visibleItems} layout={layout} hoverPreview={hoverPreview} openItemDetail={openItemDetail} ratingsByItem={ratingsByItem} memberProfilesById={memberProfilesById} coverSize={userSettings.showroom.coverSize} showCaptions={showCaptions} loading={loading} />
    </section>
  );
}

function CabinetSettingsPopover({ userSettings, saveUserSettings, defaultTitle, defaultDescription, mineOnly, setMineOnly }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => mergeUserSettings({ ...userSettings, filters: { ...(userSettings.filters || {}), mineOnly: Boolean(mineOnly) } }));
  const [status, setStatus] = useState('');
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    setDraft(mergeUserSettings({ ...userSettings, filters: { ...(userSettings.filters || {}), mineOnly: Boolean(mineOnly) } }));
  }, [userSettings, mineOnly]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const update = (group, patch) => setDraft((current) => mergeUserSettings({ ...current, [group]: { ...(current[group] || {}), ...patch } }));

  const save = async () => {
    setStatus('正在同步');
    try {
      await saveUserSettings({
        appearance: draft.appearance,
        showroom: draft.showroom,
        filters: draft.filters
      });
      if (draft.filters.mineOnly !== mineOnly) setMineOnly?.(draft.filters.mineOnly);
      setStatus('已同步到账号');
    } catch (error) {
      setStatus(error.message);
    }
  };

  const resetCopy = () => {
    update('showroom', { title: '', description: '' });
    setStatus('已恢复默认文案，保存后同步');
  };
  const previewTitle = cabinetDisplayTitle(draft.showroom.title, defaultTitle.replace(/\s*的专辑陈列柜$/, ''));

  return (
    <div className="cabinet-settings" ref={panelRef}>
      <button type="button" ref={triggerRef} className="cabinet-settings-trigger" aria-expanded={open} aria-controls="cabinet-settings-panel" onClick={() => setOpen((value) => !value)}><Wand2 size={16} /><span>陈列设置</span></button>
      {open && (
        <div id="cabinet-settings-panel" className="cabinet-settings-panel" role="dialog" aria-modal="false" aria-label="陈列柜设置">
          <div className="cabinet-settings-head">
            <span><Sparkles size={16} /> 展柜视觉</span>
            <button type="button" className="popover-close compact" onClick={() => setOpen(false)} aria-label="关闭陈列柜设置">×</button>
          </div>
          <div className="cabinet-settings-preview">
            <span style={{ background: draft.appearance.customTheme }} />
            <div>
              <strong>{previewTitle}</strong>
              <small>{wallLayoutPresets[draft.showroom.wallLayout]?.label || '4x3'} / {hoverPreviewLabels[draft.showroom.hoverPreview] || hoverPreviewLabels.flip} / {draft.filters.mineOnly ? '只看自己' : '全房间'}</small>
            </div>
          </div>
          <div className="cabinet-settings-grid">
            <label>封面大小<select value={draft.showroom.coverSize} onChange={(event) => update('showroom', { coverSize: event.target.value })}><option value="compact">紧凑</option><option value="comfortable">舒适</option><option value="large">大封面</option></select></label>
            <label>默认布局<select value={draft.showroom.wallLayout} onChange={(event) => update('showroom', { wallLayout: event.target.value })}>{Object.entries(wallLayoutPresets).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}</select></label>
            <label>悬浮方式<select value={draft.showroom.hoverPreview || 'flip'} onChange={(event) => update('showroom', { hoverPreview: event.target.value })}><option value="flip">翻面资料</option><option value="blur">高斯简介</option><option value="lift">轻浮层简介</option></select></label>
            <label>主题策略<select value={draft.appearance.themeStrategy} onChange={(event) => update('appearance', { themeStrategy: event.target.value })}><option value="cover">跟随封面</option><option value="room">跟随房间</option><option value="custom">自定义</option></select></label>
            <label className="color-field">自定义主题<input type="color" value={draft.appearance.customTheme} onChange={(event) => update('appearance', { customTheme: event.target.value })} /></label>
            <label>玻璃强度<input type="range" min="35" max="82" value={draft.appearance.glass} onChange={(event) => update('appearance', { glass: Number(event.target.value) })} /></label>
          </div>
          <div className="cabinet-toggle-list" aria-label="陈列柜偏好">
            <label><input type="checkbox" checked={draft.filters.mineOnly} onChange={(event) => update('filters', { mineOnly: event.target.checked })} /><span><strong>只看自己添加</strong><small>陈列柜默认筛出你添加的专辑和单曲。</small></span></label>
            <label><input type="checkbox" checked={Boolean(draft.showroom.showCaptions)} onChange={(event) => update('showroom', { showCaptions: event.target.checked })} /><span><strong>显示专辑标题</strong><small>在封面下方显示专辑名和歌手名。</small></span></label>
            <label><input type="checkbox" checked={draft.appearance.reduceMotion} onChange={(event) => update('appearance', { reduceMotion: event.target.checked })} /><span><strong>减少动效</strong><small>关闭翻面、入场和呼吸类动画。</small></span></label>
            <label><input type="checkbox" checked={draft.appearance.rainbowStatus} onChange={(event) => update('appearance', { rainbowStatus: event.target.checked })} /><span><strong>彩虹呼吸状态</strong><small>搜索、生成和保存时显示全屏边缘状态光。</small></span></label>
          </div>
          <div className="cabinet-copy-editor">
            <label>标题<input value={draft.showroom.title || ''} onChange={(event) => update('showroom', { title: event.target.value })} placeholder={defaultTitle} maxLength={80} /></label>
            <label>说明<textarea value={draft.showroom.description || ''} onChange={(event) => update('showroom', { description: event.target.value })} placeholder={defaultDescription} maxLength={220} /></label>
          </div>
          <div className="cabinet-settings-footer">
            <button type="button" className="secondary-chip" onClick={resetCopy}>恢复默认文案</button>
            <button type="button" className="filter-chip active" onClick={save}><Sparkles size={15} />保存展柜设置</button>
          </div>
          {status && <p className="status-line">{status}</p>}
        </div>
      )}
    </div>
  );
}

function AlbumCabinetGrid({ items, layout, hoverPreview, openItemDetail, ratingsByItem, memberProfilesById, coverSize, showCaptions, loading }) {
  const gridRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemCount = items.length;

  const focusTile = (index) => {
    const node = gridRef.current?.querySelectorAll('.cabinet-tile')[index];
    if (node) node.focus();
  };

  const onGridKeyDown = (event) => {
    if (!itemCount) return;
    let next = activeIndex;
    switch (event.key) {
      case 'ArrowRight': next = Math.min(activeIndex + 1, itemCount - 1); break;
      case 'ArrowLeft': next = Math.max(activeIndex - 1, 0); break;
      case 'ArrowDown':
      case 'ArrowUp': {
        const computed = gridRef.current ? getComputedStyle(gridRef.current).gridTemplateColumns : '';
        const cols = computed ? computed.split(' ').length || 1 : 1;
        next = event.key === 'ArrowDown'
          ? Math.min(activeIndex + cols, itemCount - 1)
          : Math.max(activeIndex - cols, 0);
        break;
      }
      case 'Home': next = 0; break;
      case 'End': next = itemCount - 1; break;
      default: return;
    }
    event.preventDefault();
    setActiveIndex(next);
  };

  // 焦点落到任意封面时同步 roving 索引（点击 / Tab 进入）
  const onGridFocus = (event) => {
    const tiles = gridRef.current?.querySelectorAll('.cabinet-tile');
    if (!tiles) return;
    const idx = Array.prototype.indexOf.call(tiles, event.target);
    if (idx >= 0 && idx !== activeIndex) setActiveIndex(idx);
  };

  useEffect(() => {
    if (activeIndex > itemCount - 1) setActiveIndex(Math.max(0, itemCount - 1));
  }, [itemCount, activeIndex]);

  useEffect(() => {
    focusTile(activeIndex);
  }, [activeIndex]);

  if (loading && !items.length) {
    return (
      <div className={`cabinet-grid wall-${layout} cabinet-size-${coverSize} cabinet-hover-${hoverPreview} ${showCaptions ? 'cabinet-show-captions' : ''}`} style={wallLayoutStyle(layout)} role="list" aria-label="专辑陈列柜" aria-busy="true">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="skeleton-tile" aria-hidden="true" />
        ))}
      </div>
    );
  }
  if (!items.length) {
    return <div className="empty-state cabinet-empty"><Disc3 size={52} /><strong>展柜还没有封面</strong><span>用顶部搜索添加第一张专辑或单曲。</span></div>;
  }
  return (
    <div ref={gridRef} className={`cabinet-grid wall-${layout} cabinet-size-${coverSize} cabinet-hover-${hoverPreview} ${showCaptions ? 'cabinet-show-captions' : ''}`} style={wallLayoutStyle(layout)} role="list" aria-label="专辑陈列柜" onKeyDown={onGridKeyDown} onFocus={onGridFocus}>
      {items.map((item, index) => (
        <CabinetListItem key={item.id} index={index}>
          <AlbumCabinetTile item={item} index={index} openItemDetail={openItemDetail} ratingSummary={ratingsByItem[item.id]} adder={item.addedById ? memberProfilesById[item.addedById] : null} showCaption={showCaptions} tileTabIndex={index === activeIndex ? 0 : -1} />
        </CabinetListItem>
      ))}
    </div>
  );
}

function CabinetListItem({ index, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      node.classList.add('is-in-view');
      return undefined;
    }
    const reduce = node.closest('.reduce-motion');
    if (reduce) {
      node.classList.add('is-in-view');
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const stagger = Math.min(6, (index % 6) + 1);
  return (
    <div className="cabinet-listitem" role="listitem">
      <div ref={ref} className="polish-reveal" data-stagger={stagger}>
        {children}
      </div>
    </div>
  );
}

function AlbumCabinetTile({ item, index, openItemDetail, ratingSummary, adder, showCaption, tileTabIndex = 0 }) {
  const summary = item.aiProfile?.overview || item.background || item.context || '这张封面正在等待更多朋友写下记忆。';
  return (
    <>
      <button
        type="button"
        className="cabinet-tile"
        style={{ '--tile-index': index, '--poster-a': item.palette?.[0] || 'var(--cover-a)', '--poster-b': item.palette?.[1] || 'var(--cover-b)' }}
        onClick={() => openItemDetail(item.id)}
        tabIndex={tileTabIndex}
        aria-label={`打开 ${item.artist || '未知艺人'} 的 ${item.title} 详情`}
      >
        <span className="cabinet-card-face cabinet-card-front"><AlbumArt item={item} /></span>
        <span className="cabinet-card-face cabinet-card-back">
          <small>{item.type === 'album' ? 'ALBUM' : 'SONG'} · {item.year || 'unknown'}</small>
          <strong>{item.title}</strong>
          <em>{item.artist}</em>
          <p>{summary}</p>
          <span className="cabinet-meta-row"><b>{item.tracks?.length || (item.type === 'song' ? 1 : 0)} 首</b><b>{ratingSummary?.count ? `${ratingSummary.average} / 10` : '待评分'}</b></span>
          <span className="cabinet-adder">{adder?.name || item.addedBy || 'Music friend'}</span>
        </span>
      </button>
      {showCaption && (
        <button
          type="button"
          className="cabinet-caption"
          onClick={() => openItemDetail(item.id)}
          tabIndex={-1}
          aria-label={`打开 ${item.artist || '未知艺人'} 的 ${item.title} 详情`}
        >
          <strong>{item.title}</strong>
          <span>{item.artist || '未知艺人'}</span>
        </button>
      )}
    </>
  );
}

function MemberProfileModal({ member, items, close, openItem }) {
  const profile = member.profile || {};
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const chips = [
    ['所在地', profile.location || member.location],
    ['喜欢风格', profile.favoriteGenres],
    ['喜欢歌手', profile.favoriteArtists],
    ['喜欢乐队', profile.favoriteBands],
    ['喜欢专辑', profile.favoriteAlbums],
    ['喜欢歌曲', profile.favoriteSongs]
  ].map(([label, value]) => {
    const text = Array.isArray(value) ? value.slice(0, 6).join('、') : String(value || '');
    return [label, text];
  }).filter(([, value]) => value);
  const albums = items.filter((item) => item.type === 'album').length;
  const songs = items.length - albums;

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.disabled && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, [close]);

  return (
    <div className="member-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <aside className="member-modal glass-panel" role="dialog" aria-modal="true" aria-label={`${member.name} 的公开资料`} ref={modalRef}>
        <button type="button" className="modal-close" aria-label="关闭" onClick={close} ref={closeButtonRef}>×</button>
        <header className="member-profile-head">
          <div className="member-profile-avatar"><UserAvatar user={member} /></div>
          <div>
            <p className="eyebrow"><Users size={15} /> public profile</p>
            <h2>{member.name}</h2>
            <p>{member.bio || profile.bio || '这个成员还没有写公开简介。'}</p>
          </div>
        </header>
        {(member.publicTags || []).length > 0 && (
          <div className="tag-row compact-tags public-tag-row">
            {member.publicTags.slice(0, 12).map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}
        <div className="member-profile-stats">
          <span><strong>{items.length}</strong>当前房间添加</span>
          <span><strong>{albums}</strong>专辑</span>
          <span><strong>{songs}</strong>歌曲</span>
        </div>
        {chips.length > 0 && (
          <section className="member-public-fields">
            {chips.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
        )}
        <section className="member-added-section">
          <div className="section-title"><Library size={18} /><h3>TA 添加的音乐</h3></div>
          <div className="member-added-list">
            {items.length ? items.slice(0, 12).map((item) => (
              <button key={item.id} type="button" onClick={() => openItem(item.id)}>
                <AlbumArt item={item} size="thumb" />
                <span><strong>{item.title}</strong><small>{item.artist} · {item.type === 'album' ? '专辑' : item.albumTitle || '歌曲'}</small></span>
                <ChevronRight size={15} />
              </button>
            )) : <p className="empty-state compact-empty">TA 还没有在当前房间添加音乐。</p>}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ConfirmDialog({ config, close }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement;
    cancelRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.disabled && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, [busy, close]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await config.action?.();
      close();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section className="confirm-dialog glass-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title" ref={dialogRef}>
        <div>
          <p className="eyebrow"><Trash2 size={15} /> careful action</p>
          <h2 id="confirm-title">{config.title}</h2>
          <p>{config.message}</p>
        </div>
        <div className="confirm-actions">
          <button type="button" className="secondary-chip" onClick={close} disabled={busy} ref={cancelRef}>取消</button>
          <button type="button" className={`danger-confirm ${config.tone === 'danger' ? 'danger' : ''}`} onClick={confirm} disabled={busy}>
            <Trash2 size={15} />{busy ? '处理中…' : config.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function AddMusic({ query, setQuery, artistQuery, setArtistQuery, link, setLink, searchType, setSearchType, setSearchStatus, setCandidates, resolvedLink, runOnlineSearch, searchStatus, candidates, selectedCandidate, setSelectedCandidate, addSelectedToShowroom, backgroundStatus, itemStatus, addPhase, addError }) {
  const selectedType = selectedCandidate?.type === 'album' ? '专辑' : '歌曲';
  const isAdding = backgroundStatus === 'thinking' || itemStatus === 'adding';
  const phaseSteps = [
    ['metadata', '读取 iTunes 元数据'],
    ['ai', '联网检索 + DeepSeek v4 Pro 写长导览'],
    ['writing', '保存高质量导览']
  ];
  const activePhaseIndex = addPhase === 'done' ? phaseSteps.length : Math.max(0, phaseSteps.findIndex(([key]) => key === addPhase));

  return (
    <div id="composer" className="panel-content add-panel">
      <div className="add-header">
        <div><p className="eyebrow"><Search size={15} /> add music</p><h2>添加歌曲或专辑</h2></div>
        <button type="button" onClick={runOnlineSearch}><Search size={17} /> 搜索</button>
      </div>
      <div className="type-toggle" aria-label="添加类型">
        {[
          ['all', '全部'],
          ['song', '歌曲'],
          ['album', '专辑']
        ].map(([key, label]) => <button key={key} type="button" className={searchType === key ? 'active' : ''} onClick={() => { setSearchType(key); setSearchStatus('idle'); setCandidates([]); setSelectedCandidate(null); }}>{label}</button>)}
      </div>
      <div className="search-form-grid">
        <label>歌曲 / 专辑名<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="我爱你 / 唱游 / Blonde" /></label>
        <label>歌手 / 乐队<input value={artistQuery} onChange={(event) => setArtistQuery(event.target.value)} placeholder="李荣浩 / 王菲 / Frank Ocean" /></label>
        <label>分享链接<input value={link} onChange={(event) => setLink(event.target.value)} placeholder="Spotify / Apple / 网易云 / QQ 链接" /></label>
      </div>
      <p className="status-line">
        {searchStatus === 'idle' && '选择歌曲或专辑类型后搜索。'}
        {searchStatus === 'searching' && '正在匹配候选。'}
        {searchStatus.startsWith('found-') && `找到 ${searchStatus.replace('found-', '')} 个候选。`}
        {searchStatus.startsWith('error-') && searchStatus.replace('error-', '搜索失败：')}
        {resolvedLink && ` 链接识别：${resolvedLink.provider}`}
      </p>
      <div className="candidate-board">
        <div className="candidate-list expanded" aria-label="候选结果">
          {candidates.map((item) => (
            <button key={item.id} className={selectedCandidate?.id === item.id ? 'candidate selected' : 'candidate'} onClick={() => setSelectedCandidate(item)} type="button">
              <AlbumArt item={item} size="thumb" />
              <span><strong>{item.title}</strong><small>{item.type === 'album' ? '专辑' : '歌曲'} · {item.artist} · {item.albumTitle || item.year}</small></span>
              <em>{item.match}%</em>
            </button>
          ))}
        </div>
        <div className="candidate-preview">
          {selectedCandidate ? <><AlbumArt item={selectedCandidate} className="feature-art" /><p className="eyebrow"><Album size={15} /> selected {selectedType}</p><h3>{selectedCandidate.title}</h3><p>{selectedCandidate.artist} · {selectedCandidate.type === 'album' ? '专辑' : selectedCandidate.albumTitle}</p><div className="tag-row compact-tags">{(selectedCandidate.tags || []).map((tag) => <span key={tag}>{tag}</span>)}</div><button type="button" className="full-action" disabled={isAdding} onClick={addSelectedToShowroom}><CirclePlus size={16} />{isAdding ? '正在生成导览' : `加入${selectedType}`}</button>{isAdding && <AddGenerationLoader item={selectedCandidate} phaseSteps={phaseSteps} activePhaseIndex={activePhaseIndex} />}<p className="status-line">{isAdding ? '正在联网检索并生成音乐导览；如果模型响应过慢，会先用已核验资料保存可用版本。' : (statusLabels[backgroundStatus] || statusLabels[itemStatus] || '确认后会写入当前房间。')}</p>{addError && <p className="status-line error-line">{addError}</p>}</> : <div className="empty-state">搜索并选择一个候选。</div>}
        </div>
      </div>
      {isAdding && selectedCandidate && <div className="generation-backdrop" style={{ '--loader-cover': cssImageUrl(selectedCandidate.cover) }} aria-hidden="true" />}
    </div>
  );
}

function AlbumDetailPage({ items, activeItem, activeComments, draft, setDraft, submitComment, commentStatus, commentAiStatus, setActiveId, setMode, openCabinet, openItemDetail, askAi, itemStatus, session, deleteItem, deleteComment, memberProfilesById, openMember, ratingSummary, submitRating, loading, ratingStatus }) {
  const selectItem = (id) => {
    setActiveId(id);
    openItemDetail(id);
  };
  const parentAlbum = activeItem?.type === 'song'
    ? items.find((item) => item.type === 'album' && sameAlbum(item, activeItem))
    : null;
  const relatedSongs = activeItem
    ? items.filter((item) => item.type === 'song' && item.id !== activeItem.id && sameAlbum(item, activeItem))
    : [];
  const siblingSongs = activeItem
    ? items.filter((item) => item.type === 'song' && sameAlbum(item, activeItem))
    : [];
  const albumContextItem = activeItem?.type === 'song' ? (parentAlbum || activeItem) : activeItem;
  const tracks = albumContextItem?.tracks?.length ? albumContextItem.tracks : activeItem ? [activeItem.title] : [];
  const activeTrackIndex = activeItem?.type === 'song' ? tracks.findIndex((track) => trackMatchesTitle(track, activeItem.title)) : -1;
  const profile = activeItem?.aiProfile || {};
  const [immersive, setImmersive] = useState(false);
  const genreTags = profile.genre?.length ? profile.genre : activeItem?.tags || [];
  const guide = profile.listeningGuide?.length ? profile.listeningGuide : tracks.slice(0, 5).map((track, index) => `${index + 1}. ${trackTitle(track) || `Track ${index + 1}`}`);
  const prompts = profile.discussionPrompts?.length ? profile.discussionPrompts : ['你最先被哪一个段落吸引？', '这首歌适合推荐给谁？', '你会从同专辑继续听哪一首？'];
  const listeningLinks = listeningLinksFor(activeItem);
  const canDeleteActive = activeItem && (activeItem.addedById === session?.user?.id || session?.user?.role === 'admin');
  const activeAdder = activeItem?.addedById ? memberProfilesById?.[activeItem.addedById] : null;

  if (!items.length) return <div className="panel-content empty-showroom"><Disc3 size={48} /><h2>展柜还没有内容</h2><p>从歌曲或专辑开始，把朋友的推荐放进这个房间。</p><button className="full-action narrow" type="button" onClick={() => setMode('add')}><CirclePlus size={16} />添加第一条</button></div>;
  return (
    <div className="panel-content album-detail-page exclusive-detail">
      <div className="detail-entry-animation" aria-hidden="true"><span /><i /></div>
      {activeItem && (
        <div className="detail-drawer showroom-detail">
          <div className="detail-art-stack">
            <button type="button" className="detail-back" onClick={openCabinet}><Grid3X3 size={16} />返回展柜</button>
            <AlbumArt item={activeItem} className="feature-art" />
            <div className="vinyl-shadow" aria-hidden="true" />
          </div>
          <div className="detail-story">
            <p className="eyebrow"><Album size={15} /> {activeItem.type === 'album' ? 'album' : 'song'} in showroom</p>
            <h2>{activeItem.title}</h2>
            <p>{activeItem.artist} · {activeItem.albumTitle || activeItem.year}</p>
            <div className="detail-stat-row">
              <span>{tracks.length} 首曲目</span>
              <span>{siblingSongs.length || relatedSongs.length} 首已收录歌曲</span>
              <span>{activeComments.length} 条评论</span>
            </div>
            <p>{profile.overview || activeItem.background || activeItem.context}</p>
            <div className="tag-row compact-tags profile-tags">{genreTags.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="detail-actions">
              <button type="button" onClick={() => setImmersive(true)}><BookOpen size={16} />沉浸阅读</button>
              <button type="button" onClick={askAi}><Bot size={16} />请求 AI 推荐</button>
              <button type="button" onClick={() => setMode('add')}><CirclePlus size={16} />继续添加</button>
              {canDeleteActive && <button type="button" className="danger-action" onClick={() => deleteItem(activeItem)}><Trash2 size={16} />删除条目</button>}
            </div>
            <RatingPanel ratingSummary={ratingSummary} submitRating={submitRating} ratingStatus={ratingStatus} />
            {listeningLinks.length > 0 && (
              <div className="listening-links">
                <strong><Radio size={16} />聆听入口</strong>
                <div>
                  {listeningLinks.map((link, index) => (
                    <a key={`${link.provider}-${link.type || index}-${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer">
                      {providerLabel(link.provider)}
                      <small>{link.confidence === 'exact' ? '精确链接' : link.source === 'user' ? '用户提供' : '搜索匹配'}</small>
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="credit-strip">
              <span>添加者 / 来源</span>
              <div className="credit-person">
                <AuthorChip profile={activeAdder} fallbackName={activeItem.addedBy} fallbackAvatar={activeItem.addedByAvatar} onOpen={openMember} />
                <strong>{activeItem.source}</strong>
              </div>
            </div>
            <p className="status-line">{itemStatus === 'cloud' ? '已同步到房间展柜。' : itemStatus}</p>
          </div>
          <div className="tracklist-panel">
            <div className="section-title"><Music2 size={18} /><h3>{activeItem.type === 'album' ? '专辑曲目' : '所属专辑'}</h3></div>
            {activeItem.type === 'song' && (
              <div className="album-context-card">
                <div>
                  <span>收录于</span>
                  <strong>{activeItem.albumTitle || parentAlbum?.title || '未知专辑'}</strong>
                  <p>{parentAlbum ? `${parentAlbum.tracks?.length || tracks.length} 首曲目已同步，可从这里回到整张专辑。` : '这首歌已带入专辑名；加入同名专辑后会自动合并到完整曲目上下文。'}</p>
                </div>
                {parentAlbum && <button type="button" onClick={() => selectItem(parentAlbum.id)}>查看专辑</button>}
              </div>
            )}
            <div className="showroom-tracklist">
              {tracks.map((track, index) => {
                const title = trackTitle(track) || `Track ${index + 1}`;
                return (
                  <button key={`${title}-${index}`} type="button" className={activeTrackIndex === index ? 'showroom-track current' : 'showroom-track'}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{title}</strong>
                    <small>{activeTrackIndex === index ? '当前歌曲' : trackArtist(track, albumContextItem.artist)}</small>
                  </button>
                );
              })}
            </div>
            {activeItem.type === 'album' && (
              <div className="related-song-panel">
                <strong>房间已收录歌曲</strong>
                {relatedSongs.length ? relatedSongs.map((song) => (
                  <button key={song.id} type="button" className="related-song" onClick={() => selectItem(song.id)}>
                    <span><AlbumArt item={song} size="thumb" /></span>
                    <div><b>{song.title}</b><small>{song.artist} · 来自这张专辑</small></div>
                    <ChevronRight size={15} />
                  </button>
                )) : <p>这张专辑还没有单独收录的歌曲。添加其中一首歌后，它会自动出现在这里。</p>}
              </div>
            )}
            <div className="listening-guide">
              <strong>初听导览</strong>
              {guide.slice(0, 6).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
            </div>
          </div>
          <section className="ai-dossier">
            <div className="section-title"><Bot size={18} /><h3>AI 推荐导览</h3></div>
            <div className="ai-profile-grid">
              {[
                ['专辑位置', profile.albumContext],
                ['创作语境', profile.creativeBackground],
                ['旋律动机', profile.melodyMotif],
                ['歌词视角', profile.lyricPerspective],
                ['编曲层次', profile.arrangement],
                ['发行状态', profile.releaseState]
              ].filter(([, value]) => value).map(([title, value], index) => (
                <details key={title} className="profile-note">
                  <summary><span>{String(index + 1).padStart(2, '0')}</span><strong>{title}</strong></summary>
                  <p>{value}</p>
                </details>
              ))}
            </div>
            {profile.sources?.length > 0 && (
              <div className="source-strip">
                <strong>联网来源</strong>
                {profile.sources.slice(0, 4).map((source) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                ))}
              </div>
            )}
          </section>
          <div className="showroom-comments">
            <div className="section-title"><MessageCircle size={18} /><h3>评论</h3></div>
            <div className="prompt-strip">
              {prompts.slice(0, 3).map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt)}>{prompt}</button>)}
            </div>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`写下你推荐《${activeItem.title}》的原因`} />
            <button type="button" onClick={submitComment} disabled={!draft.trim() || commentStatus === 'sending'}><Send size={16} /> {commentStatus === 'sending' ? '发送中…' : '发布到展柜'}</button>
            <p className="status-line" aria-live="polite">{commentStatus === 'cloud' ? '评论已同步。' : commentStatus}</p>
            {commentAiStatus === 'thinking' && <div className="ai-writing"><Bot size={16} />AI 正在阅读你的评论，并准备一个可以继续聊下去的问题。</div>}
            {commentAiStatus && !['idle', 'thinking', 'done'].includes(commentAiStatus) && <p className="status-line error-line">{commentAiStatus}</p>}
            <div className="showroom-comment-list" aria-busy={loading ? 'true' : undefined}>
              {loading && !activeComments.length ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="skeleton-comment" aria-hidden="true" />
                ))
              ) : activeComments.length ? (
                activeComments.map((comment) => {
                  const author = comment.userId ? memberProfilesById?.[comment.userId] : null;
                  return (
                    <article key={comment.id} className={`comment${comment.pending ? ' comment-pending' : ''}`}>
                      <div><AuthorChip profile={author} fallbackName={comment.author} fallbackAvatar={comment.avatar} onOpen={openMember} /><span><Star size={14} /> {comment.mood}</span></div>
                      <p>{comment.text}</p>
                      {(comment.userId === session?.user?.id || session?.user?.role === 'admin') && !comment.isAi && <button type="button" className="inline-delete" onClick={() => deleteComment(comment)}><Trash2 size={14} />删除评论</button>}
                    </article>
                  );
                })
              ) : <p className="empty-state compact-empty">还没有评论。</p>}
            </div>
          </div>
        </div>
      )}
      {immersive && activeItem && (
        <ImmersiveDetail item={activeItem} profile={profile} comments={activeComments} ratingSummary={ratingSummary} onClose={() => setImmersive(false)} />
      )}
    </div>
  );
}

function Review({ selected, comments, draft, setDraft, submitComment, commentStatus, commentAiStatus, session, deleteComment, memberProfilesById, openMember, loading }) {
  if (!selected) return <div className="panel-content empty-state">先在展柜中添加或选择一条音乐。</div>;
  return (
    <div className="panel-content">
      <div className="review-composer">
        <p className="eyebrow"><MessageCircle size={15} /> comments</p>
        <h2>评论 {selected.title}</h2>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="写下你推荐它的原因" />
        <button type="button" onClick={submitComment} disabled={!draft.trim() || commentStatus === 'sending'}>
          <Send size={17} /> {commentStatus === 'sending' ? '发送中…' : '发布评论'}
        </button>
        <p className="status-line">{commentStatus === 'cloud' ? '评论已同步。' : commentStatus}</p>
        {commentAiStatus === 'thinking' && <div className="ai-writing"><Bot size={16} />AI 正在阅读你的评论，并准备一个可以继续聊下去的问题。</div>}
      </div>
      <div className="comment-list" aria-busy={loading ? 'true' : undefined}>
        {loading && !comments.length ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton-comment" aria-hidden="true" />
          ))
        ) : comments.length ? (
          comments.map((comment) => {
            const author = comment.userId ? memberProfilesById?.[comment.userId] : null;
            return (
              <article key={comment.id} className={`comment${comment.pending ? ' comment-pending' : ''}`}>
                <div><AuthorChip profile={author} fallbackName={comment.author} fallbackAvatar={comment.avatar} onOpen={openMember} /><span><Star size={14} /> {comment.mood}</span></div>
                <p>{comment.text}</p>
                {(comment.userId === session?.user?.id || session?.user?.role === 'admin') && !comment.isAi && <button type="button" className="inline-delete" onClick={() => deleteComment(comment)}><Trash2 size={14} />删除评论</button>}
              </article>
            );
          })
        ) : <p className="empty-state">还没有评论。</p>}
      </div>
    </div>
  );
}

function RatingPanel({ ratingSummary, submitRating, ratingStatus }) {
  const [score, setScore] = useState(ratingSummary?.mine?.score || ratingSummary?.average || 8);

  useEffect(() => {
    setScore(ratingSummary?.mine?.score || ratingSummary?.average || 8);
  }, [ratingSummary?.mine?.score, ratingSummary?.average]);

  const quickScores = [6, 7, 8, 9, 10];
  return (
    <section className="rating-panel" aria-label="专辑评分">
      <div>
        <span>好友均分</span>
        <strong>{ratingSummary?.count ? ratingSummary.average.toFixed(1) : '待评分'}</strong>
        <small>{ratingSummary?.count ? `${ratingSummary.count} 人评分` : '给它第一颗星'}</small>
      </div>
      <label>
        我的评分 <b>{Number(score).toFixed(1)}</b>
        <input type="range" min="0" max="10" step="0.5" value={score} onChange={(event) => setScore(Number(event.target.value))} aria-valuetext={`${Number(score).toFixed(1)} 分`} />
      </label>
      <div className="rating-buttons">
        {quickScores.map((value) => <button key={value} type="button" className={Number(score) === value ? 'active' : ''} onClick={() => setScore(value)}><Star size={13} />{value}</button>)}
        <button type="button" className="save-rating" onClick={() => submitRating(score)} disabled={ratingStatus === 'saving'}>{ratingStatus === 'saving' ? '保存中' : '保存评分'}</button>
      </div>
      {ratingStatus && !['idle', 'cloud', 'saving'].includes(ratingStatus) && <p className="status-line error-line" aria-live="assertive">{ratingStatus}</p>}
    </section>
  );
}

function Ai({ selected, aiInsight, aiStatus, askAi }) {
  if (!selected) return <div className="panel-content empty-state">添加音乐后即可请求 AI 推荐。</div>;
  return <div className="panel-content ai-grid"><article className="ai-card wide"><p className="eyebrow"><Bot size={15} /> recommendation</p><h2>围绕 {selected.title} 生成推荐</h2><p>{selected.background || selected.context}</p><button type="button" onClick={askAi}>{aiStatus === 'thinking' ? '生成中' : '生成推荐与追问'} <ChevronRight size={15} /></button>{aiInsight && <p className="ai-insight spacious">{aiInsight}</p>}</article>{recommendations.map(([title, reason]) => <article className="ai-card" key={title}><Music2 size={19} /><strong>{title}</strong><p>{reason}</p></article>)}</div>;
}

function EditableList({ label, value, onChange, placeholder }) {
  const [text, setText] = useState(() => listToText(value));

  useEffect(() => {
    setText(listToText(value));
  }, [Array.isArray(value) ? value.join('\u0001') : value]);

  return (
    <label>
      {label}
      <input
        value={text}
        name={label}
        autoComplete="off"
        onChange={(event) => setText(event.target.value)}
        onBlur={() => onChange(textToList(text))}
        placeholder={placeholder}
      />
    </label>
  );
}

function recoTitle(item, kind) {
  if (typeof item === 'string') return item;
  if (!item) return '';
  if (kind === 'artist' || kind === 'band') return item.name || item.title || '';
  return [item.artist, item.title || item.name].filter(Boolean).join(' - ') || item.title || item.name || '';
}

function recoReason(item) {
  if (!item || typeof item === 'string') return '';
  return item.reason || item.entry || '';
}

function recoEntry(item) {
  if (!item || typeof item === 'string') return '';
  return item.entry && item.entry !== item.reason ? item.entry : '';
}

function PersonaReport({ report, addPublicTag }) {
  if (!report) {
    return (
      <div className="persona-empty">
        <Sparkles size={30} />
        <strong>还没有生成音乐侧写</strong>
        <p>保存资料、勾选几首代表作后，让 AI 分析偏好线索并推荐新的歌手、歌曲和专辑。</p>
      </div>
    );
  }
  const title = report.profileName || report.musicPersonality?.name || '音乐画像';
  const accent = /^#[0-9a-f]{6}$/i.test(report.ui_theme_hint?.primary_color || '') ? report.ui_theme_hint.primary_color : '';
  const recommendationGroups = [
    ['艺人', 'artist', report.recommendations?.artists],
    ['乐队', 'band', report.recommendations?.bands],
    ['专辑', 'album', report.recommendations?.albums],
    ['歌曲', 'song', report.recommendations?.songs]
  ].filter(([, , values]) => values?.length);
  const identityFields = Array.isArray(report.identitySignals?.fields) ? report.identitySignals.fields.filter((item) => item?.label && item?.value) : [];
  const dailyVibes = Array.isArray(report.dailyVibes) ? report.dailyVibes.filter((item) => item?.title && item?.text) : [];
  const oracleCards = Array.isArray(report.oracleCards) ? report.oracleCards.filter((item) => item?.title && item?.text) : [];
  const easterEggs = Array.isArray(report.easterEggs) ? report.easterEggs.filter(Boolean) : [];
  return (
    <article className="persona-report" style={accent ? { '--persona-accent': accent } : undefined}>
      <div className="persona-title">
        <p className="eyebrow"><Sparkles size={15} /> music oracle</p>
        <h3>{report.archetype?.title || title}</h3>
      </div>
      {(report.archetype?.summary || report.headline) && <p className="persona-headline">{report.archetype?.summary || report.headline}</p>}
      {report.summary && <p className="persona-summary">{report.summary}</p>}
      {report.the_roast && <div className="persona-roast"><Sparkles size={18} /><p>{report.the_roast}</p></div>}
      {report.essay && (
        <section className="persona-main-essay">
          <div>
            <span>SOUL READING</span>
            <strong>完整灵魂侧写</strong>
          </div>
          <p>{report.essay}</p>
        </section>
      )}
      {report.lifeReading && (
        <section className="life-reading-card">
          <div className="life-reading-kicker">
            <span>{report.lifeReading.vibe || '人格牌面'}</span>
            <b>{report.lifeReading.title || '日常人格盲盒'}</b>
          </div>
          {report.lifeReading.text && <p>{report.lifeReading.text}</p>}
          <div className="life-reading-facets">
            {report.lifeReading.socialStyle && <article><strong>朋友局</strong><span>{report.lifeReading.socialStyle}</span></article>}
            {report.lifeReading.workStyle && <article><strong>做事方式</strong><span>{report.lifeReading.workStyle}</span></article>}
            {report.lifeReading.loveStyle && <article><strong>亲密雷达</strong><span>{report.lifeReading.loveStyle}</span></article>}
          </div>
        </section>
      )}
      {oracleCards.length > 0 && (
        <section className="oracle-card-grid">
          {oracleCards.map((item, index) => (
            <article key={`${item.title}-${index}`}>
              <span>{item.card || `牌 ${index + 1}`}</span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </section>
      )}
      {(dailyVibes.length > 0 || report.musicAge?.listeningAge) && (
        <section className="persona-vibe-board">
          {report.musicAge?.listeningAge && (
            <article className="music-age-card">
              <Sparkles size={18} />
              <div>
                <strong>音乐年龄：{report.musicAge.listeningAge}</strong>
                {report.musicAge.realAgeHint && <small>现实年龄线索：{report.musicAge.realAgeHint}</small>}
              </div>
              {report.musicAge.reason && <small>{report.musicAge.reason}</small>}
            </article>
          )}
          {dailyVibes.map((item) => (
            <article key={item.title} className="daily-vibe-card">
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </section>
      )}
      {report.personalitySketch && (
        <div className="persona-sketch-card">
          <strong>一句话侧写</strong>
          <p>{report.personalitySketch.text}</p>
          {report.personalitySketch.softGuess && <small>{report.personalitySketch.softGuess}</small>}
        </div>
      )}
      {report.preferenceReading?.length > 0 && (
        <div className="preference-reading-grid">
          {report.preferenceReading.map((item) => (
            <div key={item.signal}>
              <strong>{item.signal}</strong>
              {item.evidence?.length > 0 && <div className="evidence-pills">{item.evidence.slice(0, 5).map((value) => <span key={value}>{value}</span>)}</div>}
              <p>{item.reading}</p>
            </div>
          ))}
        </div>
      )}
      {report.tasteDNA?.length > 0 && (
        <div className="taste-dna-grid">
          {report.tasteDNA.map((item) => <div key={item.axis}><span><strong>{item.axis}</strong><small>{item.value}</small></span><i style={{ '--dna': `${item.value}%` }} /><p>{item.label}</p>{item.evidence?.length > 0 && <em>{item.evidence.join(' / ')}</em>}</div>)}
        </div>
      )}
      {report.evidenceCards?.length > 0 && <div className="evidence-card-grid">{report.evidenceCards.map((item) => <div key={item.claim}><strong>{item.claim}</strong><p>{(item.basedOn || []).join(' / ')}</p><small>{Math.round((item.confidence || 0.6) * 100)}% 玄学命中率</small></div>)}</div>}
      {recommendationGroups.length > 0 && (
        <section className="recommendation-board">
          <div className="section-title"><Music2 size={18} /><h3>给你的下一批歌</h3></div>
          <div className="recommendation-columns">
            {recommendationGroups.map(([groupTitle, kind, values]) => (
              <div key={groupTitle}>
                <strong>{groupTitle}</strong>
                {(values || []).map((value, index) => (
                  <article key={`${groupTitle}-${recoTitle(value, kind)}-${index}`} className="recommendation-chip-card">
                    <b>{recoTitle(value, kind)}</b>
                    {recoReason(value) && <p>{recoReason(value)}</p>}
                    {recoEntry(value) && <small>{recoEntry(value)}</small>}
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      {(report.recommendations?.hidden_gem_music || report.recommendations?.cross_domain) && (
        <div className="cross-reco-grid">
          {report.recommendations?.hidden_gem_music && <div><strong>隐藏宝藏</strong><p>{report.recommendations.hidden_gem_music.title && <b>{report.recommendations.hidden_gem_music.title}： </b>}{report.recommendations.hidden_gem_music.reason}</p></div>}
          {report.recommendations?.cross_domain?.book_or_movie && <div><strong>跨界补刀</strong><p>{report.recommendations.cross_domain.book_or_movie}</p></div>}
          {report.recommendations?.cross_domain?.night_routine && <div><strong>深夜仪式</strong><p>{report.recommendations.cross_domain.night_routine}</p></div>}
        </div>
      )}
      {report.playlistRoutes?.length > 0 && (
        <div className="playlist-route-grid">
          {report.playlistRoutes.map((route) => (
            <div key={route.title}>
              <strong>{route.title}</strong>
              <p>{route.description}</p>
              <div>{(route.items || []).slice(0, 6).map((item) => <span key={item}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      )}
      {easterEggs.length > 0 && (
        <div className="persona-easter-eggs">
          {easterEggs.slice(0, 5).map((item) => <span key={item}>{item}</span>)}
        </div>
      )}
      {report.ui_theme_hint && (
        <div className="persona-theme-card">
          <div><span style={{ background: report.ui_theme_hint.primary_color }} /> <strong>{report.ui_theme_hint.style}</strong></div>
          <p>{report.ui_theme_hint.bg_animation}</p>
        </div>
      )}
      {identityFields.length > 0 && (
        <details className="identity-signal-card compact-identity-card">
          <summary>本次抽到的资料牌</summary>
          <div className="identity-signal-grid">
            {identityFields.map((item) => (
              <article key={`${item.label}-${item.value}`}>
                <span>{item.label}</span>
                <b>{item.value}</b>
                {item.reading && <p>{item.reading}</p>}
              </article>
            ))}
          </div>
        </details>
      )}
      <div className="tag-row persona-tags">
        {(report.tags || []).map((tag) => <button key={tag} type="button" onClick={() => addPublicTag(tag)}>{tag}<Plus size={13} /></button>)}
      </div>
      {report.sources?.length > 0 && <div className="source-strip persona-sources"><strong>联网来源</strong>{report.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}
      <p className="risk-notice">{report.riskNotice}</p>
    </article>
  );
}

function PersonaChatBox({ report, personaQuestion, setPersonaQuestion, askPersona, personaChat, personaChatStatus }) {
  const starters = report?.conversationStarters || ['我下一张应该补什么专辑？', '我的音乐年龄为什么是这样？', '根据我的资料推荐 5 首歌'];
  return (
    <article className="persona-chat-card">
      <div className="section-title"><MessageCircle size={18} /><h3>继续聊这个画像</h3></div>
      <div className="persona-starters">
        {starters.slice(0, 4).map((question) => <button key={question} type="button" onClick={() => askPersona(question)}>{question}</button>)}
      </div>
      <div className="persona-chat-log">
        {personaChat.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`persona-chat-msg ${message.role}`}>
            <strong>{message.role === 'user' ? '你' : 'Album Circle AI'}</strong>
            <p>{message.text}</p>
            {message.sources?.length > 0 && <div className="source-strip compact-source">{message.sources.slice(0, 4).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}
          </div>
        ))}
      </div>
      <div className="persona-chat-input">
        <input value={personaQuestion} onChange={(event) => setPersonaQuestion(event.target.value)} placeholder="继续问：为什么我会喜欢这些歌？下一批听什么？" />
        <button type="button" onClick={() => askPersona()} disabled={personaChatStatus === 'thinking'}><Send size={15} />{personaChatStatus === 'thinking' ? '回复中' : '发送'}</button>
      </div>
      {String(personaChatStatus).startsWith('error-') && <p className="status-line error-line">{String(personaChatStatus).replace('error-', '')}</p>}
    </article>
  );
}

function ProfilePanel({ session, profileDraft, setProfileDraft, saveProfile, uploadAvatar, profileStats, profileStatus, loadProfileStats, fillProfileFromHistory, personaTone, setPersonaTone, personaHistoryMode, setPersonaHistoryMode, personaSelectedIds, togglePersonaItem, generatePersona, personaStatus, personaReport, addPublicTag, personaQuestion, setPersonaQuestion, askPersona, personaChat, personaChatStatus }) {
  const profile = profileDraft.profile || emptyProfile;
  const setProfileField = (key, value) => setProfileDraft((current) => ({ ...current, profile: { ...(current.profile || emptyProfile), [key]: value } }));
  const setPublicTags = (value) => setProfileDraft((current) => ({ ...current, publicTags: value }));
  const avatarUser = { ...session.user, ...profileDraft };
  const recentAdds = profileStats?.recentAdds || [];
  const selectedCount = personaSelectedIds.length;
  return (
    <div className="panel-content profile-workspace">
      <section className="profile-hero-card">
        <div className="profile-portrait"><UserAvatar user={avatarUser} /></div>
        <div>
          <p className="eyebrow"><UserRound size={15} /> my music identity</p>
          <h2>我的音乐档案</h2>
          <p>资料都可以留空。填得越多，AI 对你的房间历史、偏好和公开标签理解得越细。</p>
          <div className="tag-row compact-tags">{(profileDraft.publicTags || []).map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
        <button type="button" onClick={loadProfileStats}><Search size={16} />刷新统计</button>
      </section>

      <section className="profile-grid">
        <article className="profile-card">
          <div className="section-title"><UserRound size={18} /><h3>账户资料</h3></div>
          <label>昵称<input value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>头像字母<input value={profileDraft.avatar} maxLength={2} onChange={(event) => setProfileDraft((current) => ({ ...current, avatar: event.target.value }))} /></label>
          <label>上传头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadAvatar(event.target.files?.[0])} /></label>
          <label>公开简介<textarea value={profile.bio} onChange={(event) => setProfileField('bio', event.target.value)} placeholder="一句话写下你的听歌方式。" /></label>
          <EditableList label="公开 tags" value={profileDraft.publicTags} onChange={setPublicTags} placeholder="专辑补完者、深夜人声控" />
          <button type="button" className="full-action narrow" onClick={() => saveProfile()}><Wand2 size={16} />保存资料</button>
          {profileStatus && <p className="status-line">{profileStatus}</p>}
        </article>

        <article className="profile-card">
          <div className="section-title"><Music2 size={18} /><h3>偏好线索</h3></div>
          <label>所在地<input value={profile.location} onChange={(event) => setProfileField('location', event.target.value)} placeholder="城市或地区，可留空" /></label>
          <EditableList label="喜欢的风格" value={profile.favoriteGenres} onChange={(value) => setProfileField('favoriteGenres', value)} placeholder="R&B、华语流行、Dream Pop" />
          <EditableList label="喜欢的歌手" value={profile.favoriteArtists} onChange={(value) => setProfileField('favoriteArtists', value)} placeholder="王菲、Frank Ocean" />
          <EditableList label="喜欢的乐队" value={profile.favoriteBands} onChange={(value) => setProfileField('favoriteBands', value)} placeholder="Radiohead、The xx" />
          <EditableList label="喜欢的专辑" value={profile.favoriteAlbums} onChange={(value) => setProfileField('favoriteAlbums', value)} placeholder="唱游、Blonde" />
          <EditableList label="喜欢的歌曲" value={profile.favoriteSongs} onChange={(value) => setProfileField('favoriteSongs', value)} placeholder="我爱你 - 李荣浩、暗涌 - 王菲" />
          <div className="profile-mini-grid">
            <label>性别<input value={profile.gender} onChange={(event) => setProfileField('gender', event.target.value)} placeholder="可留空" /></label>
            <label>出生年份<input value={profile.birthYear} onChange={(event) => setProfileField('birthYear', event.target.value)} placeholder="可留空" /></label>
            <label>MBTI<input value={profile.mbti} onChange={(event) => setProfileField('mbti', event.target.value)} placeholder="可留空" /></label>
            <label>专业<input value={profile.major} onChange={(event) => setProfileField('major', event.target.value)} placeholder="可留空" /></label>
          </div>
        </article>

        <article className="profile-card">
          <div className="section-title"><Library size={18} /><h3>添加历史</h3></div>
          <div className="profile-stat-grid">
            <span><strong>{profileStats?.itemsAdded || 0}</strong>自己添加</span>
            <span><strong>{profileStats?.roomsJoined || 0}</strong>加入房间</span>
            <span><strong>{profileStats?.albumsAdded || 0}</strong>专辑</span>
            <span><strong>{profileStats?.songsAdded || 0}</strong>歌曲</span>
          </div>
          <button type="button" onClick={fillProfileFromHistory}>用历史记录填充偏好草稿</button>
          <div className="history-cloud">
            {(profileStats?.topArtists || []).slice(0, 10).map((item) => <span key={item.name}>{item.name}<small>{item.count}</small></span>)}
          </div>
          <div className="recent-adds">
            {(profileStats?.recentAdds || []).slice(0, 5).map((item) => <button key={`${item.roomId}-${item.id}`} type="button"><strong>{item.title}</strong><small>{item.artist} · {item.roomName}</small></button>)}
          </div>
        </article>

        <article className="profile-card persona-card">
          <div className="section-title"><Sparkles size={18} /><h3>音乐灵魂侧写</h3></div>
          <p>先选几首真正代表你的歌或专辑。AI 会结合个人资料、评论片段和所选音乐，分析偏好之间的关联，并推荐新的歌手、歌曲和专辑。</p>
          <div className="persona-controls">
            <label>语气<select value={personaTone} onChange={(event) => setPersonaTone(event.target.value)}><option value="warm">温暖</option><option value="mystic">神秘</option><option value="critic">乐评</option><option value="playful">好玩</option></select></label>
            <label>分析范围<select value={personaHistoryMode} onChange={(event) => setPersonaHistoryMode(event.target.value)}><option value="selected">只分析我勾选的</option><option value="mine">我添加的全部音乐</option><option value="room">所在房间全部音乐</option><option value="none">只使用填写资料</option></select></label>
          </div>
          <div className="persona-selection-head"><strong>代表性音乐</strong><span>{selectedCount ? `已选择 ${selectedCount} 条` : '可从最近添加中点选'}</span></div>
          <div className="persona-pick-list">
            {recentAdds.slice(0, 12).map((item) => (
              <button key={`${item.roomId}-${item.id}`} type="button" className={personaSelectedIds.includes(item.id) ? 'selected' : ''} onClick={() => togglePersonaItem(item)}>
                {item.cover && <img src={item.cover} alt="" />}
                <span><strong>{item.title}</strong><small>{item.artist} · {item.roomName}</small></span>
              </button>
            ))}
            {!recentAdds.length && <p className="empty-state compact-empty">刷新统计后会显示你添加过的歌曲和专辑。</p>}
          </div>
          <button type="button" className="full-action narrow" onClick={generatePersona} disabled={personaStatus === 'thinking'}><Sparkles size={16} />{personaStatus === 'thinking' ? '正在抽音乐人格牌' : '让 AI 拆穿我的歌单'}</button>
          {personaStatus === 'thinking' && <PersonaGenerationLoader tone={personaTone} selectedCount={selectedCount} profileStats={profileStats} user={avatarUser} />}
          {personaStatus === 'fallback' && <p className="status-line">AI 暂时不可用，已生成本地临时侧写。</p>}
          {String(personaStatus).startsWith('error-') && <p className="status-line error-line">{String(personaStatus).replace('error-', '')}</p>}
        </article>
      </section>

      <PersonaReport report={personaReport} addPublicTag={addPublicTag} />
      <PersonaChatBox report={personaReport} personaQuestion={personaQuestion} setPersonaQuestion={setPersonaQuestion} askPersona={askPersona} personaChat={personaChat} personaChatStatus={personaChatStatus} />
    </div>
  );
}

function AdminPanel({ adminData, adminStatus, loadAdmin, deleteRoom, deleteUser, aiPromptDraft, setAiPromptDraft, personaPromptDraft, setPersonaPromptDraft, aiMaxTokens, setAiMaxTokens, personaMaxTokens, setPersonaMaxTokens, personaChatMaxTokens, setPersonaChatMaxTokens, aiTemperature, setAiTemperature, personaTemperature, setPersonaTemperature, saveAiConfig }) {
  return (
    <div className="panel-content admin-panel">
      <div className="admin-head">
        <div>
          <p className="eyebrow"><LockKeyhole size={15} /> admin console</p>
          <h2>管理后台</h2>
          <p>管理房间、用户和 AI 生成策略。保存后的 prompt 会用于之后新加入的歌曲和专辑。</p>
        </div>
        <button type="button" onClick={loadAdmin}><Search size={16} />刷新</button>
      </div>
      {adminStatus && <p className="status-line">{adminStatus}</p>}
      <section className="admin-grid">
        <article className="admin-card wide">
          <div className="section-title"><Bot size={18} /><h3>AI Prompt 配置</h3></div>
          <label>歌曲 / 专辑导览 Prompt<textarea value={aiPromptDraft} onChange={(event) => setAiPromptDraft(event.target.value)} placeholder="用于添加歌曲或专辑时生成导览。可写风格、字数、禁用表达等。" /></label>
          <label>音乐侧写 Prompt<textarea value={personaPromptDraft} onChange={(event) => setPersonaPromptDraft(event.target.value)} placeholder="用于个人页音乐侧写和继续对话。建议简洁写：更像朋友、更自然、根据用户资料、评论和所选歌曲分析并推荐新音乐。" /></label>
          <div className="admin-controls expanded">
            <label>Max Tokens<input type="number" min="700" max="3200" value={aiMaxTokens} onChange={(event) => setAiMaxTokens(Number(event.target.value))} /></label>
            <label>Persona Tokens<input type="number" min="1200" max="16000" value={personaMaxTokens} onChange={(event) => setPersonaMaxTokens(Number(event.target.value))} /></label>
            <label>Chat Tokens<input type="number" min="900" max="8000" value={personaChatMaxTokens} onChange={(event) => setPersonaChatMaxTokens(Number(event.target.value))} /></label>
            <label>Temperature<input type="number" min="0" max="1" step="0.05" value={aiTemperature} onChange={(event) => setAiTemperature(Number(event.target.value))} /></label>
            <label>Persona Temp<input type="number" min="0" max="1" step="0.05" value={personaTemperature} onChange={(event) => setPersonaTemperature(Number(event.target.value))} /></label>
          </div>
          <button type="button" className="full-action narrow" onClick={saveAiConfig}><Wand2 size={16} />保存 AI 配置</button>
        </article>
        <article className="admin-card">
          <div className="section-title"><DoorOpen size={18} /><h3>房间</h3></div>
          <div className="admin-list">
            {(adminData?.rooms || []).map((room) => (
              <div key={room.id} className="admin-row">
                <div><strong>{room.name}</strong><span>{room.id} · {room.itemCount} 条目 · {room.commentCount} 评论 · {room.members} 成员</span></div>
                <button type="button" onClick={() => deleteRoom(room.id)}><Trash2 size={15} />删除</button>
              </div>
            ))}
          </div>
        </article>
        <article className="admin-card">
          <div className="section-title"><Users size={18} /><h3>用户</h3></div>
          <div className="admin-list">
            {(adminData?.users || []).map((user) => (
              <div key={user.id} className="admin-row">
                <div><strong>{user.name}</strong><span>{user.email} · {user.role}</span></div>
                {user.role !== 'admin' && <button type="button" onClick={() => deleteUser(user.id)}><Trash2 size={15} />删除</button>}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function RoomPanel({ room, roomUrl, session, comments, items, knownRooms, discoverRooms, switchRoom, roomDraft, setRoomDraft, createAnotherRoom, inviteDraft, setInviteDraft, invitePassword, setInvitePassword, joinAnotherRoom, roomStatus, roomSettingsDraft, setRoomSettingsDraft, saveRoomSettings, userSettings, saveUserSettings }) {
  const canEditRoom = room.ownerId === session.user.id || session.user.role === 'admin';
  const heroDraft = editableHeroConfig(roomSettingsDraft.heroConfig, room);
  const updateHeroDraft = (patch) => {
    setRoomSettingsDraft((current) => ({
      ...current,
      heroConfig: editableHeroConfig({ ...(current.heroConfig || {}), ...patch }, room)
    }));
  };
  return (
    <div className="panel-content room-detail">
      <p className="eyebrow"><Users size={15} /> room</p>
      <h2>{room.name}</h2>
      <p>登录为 {session.user.name}。你可以公开浏览朋友的展柜，输入密码加入房间后再评论、复制和添加音乐。</p>
      <div className="room-url">{roomUrl}</div>
      <div className="room-actions">
        <button type="button" className="full-action narrow" onClick={() => navigator.clipboard?.writeText(roomUrl)}><Share2 size={16} />复制邀请链接</button>
      </div>
      <div className="blueprint-grid room-stats"><article className="source-card"><strong>{items.length}</strong><p>展柜条目</p></article><article className="source-card"><strong>{comments.length}</strong><p>房间评论</p></article><article className="source-card"><strong>{Object.keys(room.memberProfiles || {}).length}</strong><p>成员</p></article></div>
      <section className="room-manager expanded-room-manager">
        <article>
          <div className="section-title"><DoorOpen size={18} /><h3>切换房间</h3></div>
          <div className="room-list">
            {knownRooms.map((knownRoom) => (
              <button key={knownRoom.id} type="button" className={knownRoom.id === room.id ? 'active' : ''} onClick={() => switchRoom(knownRoom.id)}>
                <strong>{knownRoom.name}</strong>
                <span>{Object.keys(knownRoom.memberProfiles || {}).length} 位成员</span>
              </button>
            ))}
          </div>
        </article>
        <article>
          <div className="section-title"><Search size={18} /><h3>公开房间</h3></div>
          <div className="room-list">
            {(discoverRooms || []).map((knownRoom) => (
              <button key={knownRoom.id} type="button" onClick={() => switchRoom(knownRoom.id)}>
                <strong>{knownRoom.name}</strong>
                <span>{knownRoom.itemCount} 条目 · {knownRoom.joinMode === 'password' ? '密码加入' : '开放加入'}</span>
              </button>
            ))}
            {!discoverRooms?.length && <p className="empty-state compact-empty">还没有公开房间。</p>}
          </div>
        </article>
        <article>
          <div className="section-title"><Plus size={18} /><h3>创建新房间</h3></div>
          <label>房间名称<input value={roomDraft} onChange={(event) => setRoomDraft(event.target.value)} /></label>
          <button type="button" onClick={createAnotherRoom}>创建并切换</button>
        </article>
        <article>
          <div className="section-title"><Share2 size={18} /><h3>加入邀请</h3></div>
          <label>邀请链接或房间 ID<input value={inviteDraft} onChange={(event) => setInviteDraft(event.target.value)} placeholder="https://.../?room=..." /></label>
          <label>房间密码<input type="password" value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} placeholder="公开房间可留空" /></label>
          <button type="button" onClick={joinAnotherRoom}>加入并切换</button>
        </article>
        <article className="room-settings-card">
          <div className="section-title"><LockKeyhole size={18} /><h3>房间设置</h3></div>
          <label>可见性<select disabled={!canEditRoom} value={roomSettingsDraft.visibility} onChange={(event) => setRoomSettingsDraft((current) => ({ ...current, visibility: event.target.value, discoverable: event.target.value === 'public' ? current.discoverable : false }))}><option value="unlisted">不公开</option><option value="public">公开浏览</option><option value="private">私密</option></select></label>
          <label>加入方式<select disabled={!canEditRoom} value={roomSettingsDraft.joinMode} onChange={(event) => setRoomSettingsDraft((current) => ({ ...current, joinMode: event.target.value }))}><option value="open">开放加入</option><option value="password">密码加入</option><option value="ownerOnly">仅房主邀请</option></select></label>
          <label className="checkbox-line"><input type="checkbox" disabled={!canEditRoom || roomSettingsDraft.visibility !== 'public'} checked={Boolean(roomSettingsDraft.discoverable)} onChange={(event) => setRoomSettingsDraft((current) => ({ ...current, discoverable: event.target.checked }))} />出现在公开房间列表</label>
          <label>简介<textarea disabled={!canEditRoom} value={roomSettingsDraft.description} onChange={(event) => setRoomSettingsDraft((current) => ({ ...current, description: event.target.value }))} placeholder="写一句这个房间的听歌主题。" /></label>
          <label>新密码<input disabled={!canEditRoom || roomSettingsDraft.joinMode !== 'password'} type="password" value={roomSettingsDraft.password} onChange={(event) => setRoomSettingsDraft((current) => ({ ...current, password: event.target.value }))} placeholder="留空则沿用旧密码" /></label>
          <div className="hero-theme-fields">
            <div className="section-title"><Sparkles size={18} /><h3>首页主题</h3></div>
            <label>小标题<input disabled={!canEditRoom} value={heroDraft.eyebrow} onChange={(event) => updateHeroDraft({ eyebrow: event.target.value })} /></label>
            <label>主标题<input disabled={!canEditRoom} value={heroDraft.title} onChange={(event) => updateHeroDraft({ title: event.target.value })} placeholder="留空使用房间名" /></label>
            <label>副标题<input disabled={!canEditRoom} value={heroDraft.titleSuffix} onChange={(event) => updateHeroDraft({ titleSuffix: event.target.value })} /></label>
            <label>首页文案<textarea disabled={!canEditRoom} value={heroDraft.description} onChange={(event) => updateHeroDraft({ description: event.target.value })} /></label>
            <div className="theme-form-grid">
              <label>视觉模式<select disabled={!canEditRoom} value={heroDraft.visualMode} onChange={(event) => updateHeroDraft({ visualMode: event.target.value })}><option value="observatory">观测室</option><option value="vinyl">黑胶舞台</option><option value="editorial">杂志大片</option></select></label>
              <label>动效<select disabled={!canEditRoom} value={heroDraft.motionLevel} onChange={(event) => updateHeroDraft({ motionLevel: event.target.value })}><option value="ambient">轻动效</option><option value="cinematic">电影感</option><option value="still">静态</option></select></label>
            </div>
            <label>主题名<input disabled={!canEditRoom} value={heroDraft.accentName} onChange={(event) => updateHeroDraft({ accentName: event.target.value })} /></label>
            <label>背景图 URL<input disabled={!canEditRoom} value={heroDraft.backgroundUrl} onChange={(event) => updateHeroDraft({ backgroundUrl: event.target.value })} placeholder="可留空，默认跟随当前专辑封面" /></label>
          </div>
          <button type="button" disabled={!canEditRoom} onClick={saveRoomSettings}>保存设置</button>
        </article>
        <UserSettingsCard userSettings={userSettings} saveUserSettings={saveUserSettings} />
      </section>
      {roomStatus && <p className="status-line">{roomStatus}</p>}
    </div>
  );
}

function UserSettingsCard({ userSettings, saveUserSettings }) {
  const [draft, setDraft] = useState(() => mergeUserSettings(userSettings));
  const [status, setStatus] = useState('');

  useEffect(() => {
    setDraft(mergeUserSettings(userSettings));
  }, [userSettings]);

  const update = (group, patch) => setDraft((current) => mergeUserSettings({ ...current, [group]: { ...(current[group] || {}), ...patch } }));

  const save = async () => {
    setStatus('正在同步到账号');
    try {
      await saveUserSettings(draft);
      setStatus('设置已同步到账号');
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <article className="room-settings-card user-settings-card">
      <div className="section-title"><Sparkles size={18} /><h3>我的显示设置</h3></div>
      <div className="theme-form-grid">
        <label>主题策略<select value={draft.appearance.themeStrategy} onChange={(event) => update('appearance', { themeStrategy: event.target.value })}><option value="cover">跟随封面</option><option value="room">跟随房间</option><option value="custom">自定义</option></select></label>
        <label>自定义主题<input type="color" value={draft.appearance.customTheme} onChange={(event) => update('appearance', { customTheme: event.target.value })} /></label>
      </div>
      <label>玻璃强度<input type="range" min="35" max="82" value={draft.appearance.glass} onChange={(event) => update('appearance', { glass: Number(event.target.value) })} /></label>
      <label className="checkbox-line"><input type="checkbox" checked={draft.appearance.reduceMotion} onChange={(event) => update('appearance', { reduceMotion: event.target.checked })} />减少动效</label>
      <label className="checkbox-line"><input type="checkbox" checked={draft.appearance.rainbowStatus} onChange={(event) => update('appearance', { rainbowStatus: event.target.checked })} />搜索和 AI 生成时显示彩虹呼吸边缘</label>
      <label className="checkbox-line"><input type="checkbox" checked={draft.filters.mineOnly} onChange={(event) => update('filters', { mineOnly: event.target.checked })} />默认只看自己添加</label>
      <div className="theme-form-grid">
        <label>AI 语气<select value={draft.persona.tone} onChange={(event) => update('persona', { tone: event.target.value })}><option value="warm">温暖</option><option value="mystic">神秘</option><option value="critic">乐评</option><option value="playful">好玩</option></select></label>
        <label>分析范围<select value={draft.persona.historyMode} onChange={(event) => update('persona', { historyMode: event.target.value })}><option value="selected">只分析勾选</option><option value="mine">我添加的全部音乐</option><option value="room">所在房间全部音乐</option><option value="none">只使用填写资料</option></select></label>
      </div>
      <button type="button" onClick={save}>保存我的设置</button>
      {status && <p className="status-line">{status}</p>}
    </article>
  );
}

createRoot(document.getElementById('root')).render(<App />);
