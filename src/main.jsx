import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Album,
  Bot,
  ChevronRight,
  CirclePlus,
  Disc3,
  DoorOpen,
  Grid3X3,
  Library,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Music2,
  Pencil,
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
import './styles.css';

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

const wallLayoutPresets = {
  '2x2': { label: '2x2', cols: 2, rows: 2 },
  '3x3': { label: '3x3', cols: 3, rows: 3 },
  '4x3': { label: '4x3', cols: 4, rows: 3 },
  '5x4': { label: '5x4', cols: 5, rows: 4 },
  auto: { label: '自动', cols: 0, rows: 0 }
};

function wallLayoutStyle(layout) {
  const preset = wallLayoutPresets[layout] || wallLayoutPresets['4x3'];
  return {
    '--wall-cols': preset.cols || 'auto',
    '--wall-rows': preset.rows || 'auto'
  };
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
  const normalizedTrack = normalizeMusicText(track);
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
        <img src={item.cover} alt={`${title} 封面`} onError={() => setFailed(true)} />
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
        <strong>DeepSeek v4 Pro 正在给你的歌单抽牌</strong>
        <small>会读取个人资料、评论、所选音乐和联网资料，生成更长的人格侧写与推荐。等待会久一点，但这次会尽量把输出拉满。</small>
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

  const joinRoom = async (id = joinId) => {
    if (!id) return;
    setStatus('正在加入房间');
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({ action: 'join', roomId: id, password: joinPassword })
      });
      setRoom(data.room);
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  if (!session?.token || room) return null;

  return (
    <main className="app auth-screen">
      <div className="aurora" aria-hidden="true" />
      <section className="room-shell">
        <article className="glass-panel room-card">
          <p className="eyebrow"><Plus size={15} /> create room</p>
          <h2>创建一个新的听歌房间</h2>
          <label>
            房间名称
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button className="full-action" type="button" onClick={createRoom}><DoorOpen size={16} />创建房间</button>
        </article>
        <article className="glass-panel room-card">
          <p className="eyebrow"><Share2 size={15} /> join room</p>
          <h2>加入已有房间</h2>
          <label>
            房间 ID
            <input value={joinId} onChange={(event) => setJoinId(event.target.value)} placeholder="邀请链接里的 room" />
          </label>
          <label>
            房间密码
            <input type="password" value={joinPassword} onChange={(event) => setJoinPassword(event.target.value)} placeholder="公开房间可留空，密码房间必填" />
          </label>
          <button className="full-action" type="button" onClick={() => joinRoom()}><Users size={16} />加入房间</button>
          {rooms.length > 0 && (
            <div className="known-rooms">
              {rooms.map((knownRoom) => (
                <button key={knownRoom.id} type="button" onClick={() => joinRoom(knownRoom.id)}>{knownRoom.name}</button>
              ))}
            </div>
          )}
          {discoverRooms.length > 0 && (
            <div className="known-rooms discover-rooms">
              <strong>公开房间</strong>
              {discoverRooms.map((knownRoom) => (
                <button key={knownRoom.id} type="button" onClick={() => { setJoinId(knownRoom.id); joinRoom(knownRoom.id); }}>{knownRoom.name}<small>{knownRoom.itemCount} 条目 · {knownRoom.joinMode === 'password' ? '需要密码' : '可加入'}</small></button>
              ))}
            </div>
          )}
        </article>
        {status && <p className="status-line">{status}</p>}
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(() => loadJson('album-circle-session', null));
  const [room, setRoom] = useState(null);
  const [knownRooms, setKnownRooms] = useState([]);
  const [roomDraft, setRoomDraft] = useState('新的听歌房间');
  const [inviteDraft, setInviteDraft] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [roomStatus, setRoomStatus] = useState('');
  const [mode, setMode] = useState('showroom');
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('李荣浩 我爱你');
  const [artistQuery, setArtistQuery] = useState('李荣浩');
  const [link, setLink] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState([]);
  const [glass, setGlass] = useState(62);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [aiInsight, setAiInsight] = useState('');
  const [aiStatus, setAiStatus] = useState('idle');
  const [commentStatus, setCommentStatus] = useState('idle');
  const [itemStatus, setItemStatus] = useState('idle');
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
  const [heroEditing, setHeroEditing] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [roomSettingsDraft, setRoomSettingsDraft] = useState({ visibility: 'unlisted', joinMode: 'open', discoverable: false, description: '', password: '', heroConfig: defaultHeroConfig });

  const activeItem = items.find((item) => item.id === activeId) || items[0];
  const heroConfig = normalizeHeroConfig(room?.heroConfig, room || {});
  const palette = useCoverPalette(activeItem);
  const roomUrl = room ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.id)}` : '';
  const canEditRoom = room && (room.ownerId === session?.user?.id || session?.user?.role === 'admin');
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

  useEffect(() => {
    if (!session?.token || room) return;
    const urlRoom = new URLSearchParams(window.location.search).get('room');
    if (!urlRoom) return;
    api('/api/rooms', {
      session,
      method: 'POST',
      body: JSON.stringify({ action: 'join', roomId: urlRoom })
    })
      .then((data) => setRoom(data.room))
      .catch(() => null);
  }, [room, session]);

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
    loadRoomData().catch((error) => {
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
      }, 245000);
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
      setRoomStatus('');
    } catch (error) {
      setRoomStatus(error.message);
    }
  };

  const runOnlineSearch = async () => {
    setSearchStatus('searching');
    setAddError('');
    setSelectedCandidate(null);
    try {
      if (link) {
        const resolvedData = await api(`/api/resolve-link?input=${encodeURIComponent(link)}`);
        setResolvedLink(resolvedData);
      }
      const searchTerm = [artistQuery, query].filter(Boolean).join(' ').trim() || link;
      const params = new URLSearchParams({ term: searchTerm, type: searchType, title: query, artist: artistQuery });
      const data = await api(`/api/search?${params.toString()}`);
      setCandidates(data.candidates || []);
      setSelectedCandidate(data.candidates?.[0] || null);
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
      if (data.fallback || data.generated !== true) {
        throw new Error(data.error || 'AI 深度导览没有完整生成，本次没有写入展柜，请重试。');
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
    if (!selectedCandidate || !room) return;
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
      setMode('showroom');
      setItemStatus('cloud');
      await loadRoomData(room, { preserveActive: true });
      setAddPhase('done');
    } catch (error) {
      setAddError(error.message);
      setItemStatus('error');
      setBackgroundStatus('error');
      setAddPhase('error');
    }
  };

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || !activeItem || !room) return;
    setCommentStatus('sending');
    try {
      const data = await api(`/api/comments?roomId=${encodeURIComponent(room.id)}`, {
        session,
        method: 'POST',
        body: JSON.stringify({ text, mood: '9.0', albumId: activeItem.id, albumTitle: activeItem.title })
      });
      setComments((current) => [data.comment, ...current]);
      setDraft('');
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
      setCommentStatus(error.message);
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

  useEffect(() => {
    if (mode === 'admin') loadAdmin();
    if (mode === 'profile') loadProfileStats();
  }, [mode, session?.user?.role]);

  if (!session?.token) return <AuthGate session={session} setSession={setSession} />;
  if (!room) return <RoomGate session={session} room={room} setRoom={setRoom} />;

  return (
    <main className={reduceMotion ? 'app reduce-motion' : 'app'} style={{ '--cover-a': palette[0], '--cover-b': palette[1], '--cover-c': palette[2], '--cover-image': cssImageUrl(heroBackgroundImage(heroConfig, activeItem)), '--glass-alpha': glass / 100 }}>
      <div className="aurora" aria-hidden="true" />
      <section className="shell">
        <header className="topbar glass-panel">
          <div className="brand">
            <div className="brand-mark"><Disc3 size={22} /></div>
            <div>
              <strong>{room.name}</strong>
              <span>Album Circle · {items.length} 个展柜条目</span>
            </div>
          </div>
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
              <button key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)} type="button"><Icon size={17} /><span>{label}</span></button>
            ))}
          </nav>
          <div className="member-stack" aria-label="房间成员">
            {roomMembers.map((member) => (
              <button key={member.id || member.name} type="button" title={`查看 ${member.name} 的公开资料`} style={{ '--dot': member.color }} onClick={() => setSelectedMemberId(member.id)}>
                <UserAvatar user={member} />
              </button>
            ))}
          </div>
        </header>

        <RoomHero
          room={room}
          heroConfig={heroConfig}
          roomSettingsDraft={roomSettingsDraft}
          setRoomSettingsDraft={setRoomSettingsDraft}
          saveRoomSettings={saveRoomSettings}
          roomStatus={roomStatus}
          canEditRoom={canEditRoom}
          heroEditing={heroEditing}
          setHeroEditing={setHeroEditing}
          activeItem={activeItem}
          items={items}
          comments={comments}
          roomMembers={roomMembers}
          roomUrl={roomUrl}
          setMode={setMode}
          setActiveId={setActiveId}
          logout={logout}
        />

        <section className="workspace single-workspace">
          <section className="main-stage wide-stage">
            {mode === 'showroom' && <Showroom items={items} activeItem={activeItem} activeComments={activeComments} draft={draft} setDraft={setDraft} submitComment={submitComment} commentStatus={commentStatus} commentAiStatus={commentAiStatus} setActiveId={setActiveId} setMode={setMode} askAi={askAi} itemStatus={itemStatus} session={session} deleteItem={deleteItem} deleteComment={deleteComment} memberProfilesById={memberProfilesById} openMember={setSelectedMemberId} />}
            {mode === 'add' && <AddMusic query={query} setQuery={setQuery} artistQuery={artistQuery} setArtistQuery={setArtistQuery} link={link} setLink={setLink} searchType={searchType} setSearchType={setSearchType} setSearchStatus={setSearchStatus} setCandidates={setCandidates} resolvedLink={resolvedLink} runOnlineSearch={runOnlineSearch} searchStatus={searchStatus} candidates={candidates} selectedCandidate={selectedCandidate} setSelectedCandidate={setSelectedCandidate} addSelectedToShowroom={addSelectedToShowroom} backgroundStatus={backgroundStatus} itemStatus={itemStatus} addPhase={addPhase} addError={addError} />}
            {mode === 'review' && <Review selected={activeItem} comments={activeComments} draft={draft} setDraft={setDraft} submitComment={submitComment} commentStatus={commentStatus} commentAiStatus={commentAiStatus} session={session} deleteComment={deleteComment} memberProfilesById={memberProfilesById} openMember={setSelectedMemberId} />}
            {mode === 'ai' && <Ai selected={activeItem} aiInsight={aiInsight} aiStatus={aiStatus} askAi={askAi} />}
            {mode === 'room' && <RoomPanel room={room} roomUrl={roomUrl} session={session} comments={comments} items={items} knownRooms={knownRooms} discoverRooms={discoverRooms} switchRoom={switchRoom} roomDraft={roomDraft} setRoomDraft={setRoomDraft} createAnotherRoom={createAnotherRoom} inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} invitePassword={invitePassword} setInvitePassword={setInvitePassword} joinAnotherRoom={joinAnotherRoom} roomStatus={roomStatus} roomSettingsDraft={roomSettingsDraft} setRoomSettingsDraft={setRoomSettingsDraft} saveRoomSettings={saveRoomSettings} />}
            {mode === 'profile' && <ProfilePanel session={session} profileDraft={profileDraft} setProfileDraft={setProfileDraft} saveProfile={saveProfile} uploadAvatar={uploadAvatar} profileStats={profileStats} profileStatus={profileStatus} loadProfileStats={loadProfileStats} fillProfileFromHistory={fillProfileFromHistory} personaTone={personaTone} setPersonaTone={setPersonaTone} personaHistoryMode={personaHistoryMode} setPersonaHistoryMode={setPersonaHistoryMode} personaSelectedIds={personaSelectedIds} togglePersonaItem={togglePersonaItem} generatePersona={generatePersona} personaStatus={personaStatus} personaReport={personaReport} addPublicTag={addPublicTag} personaQuestion={personaQuestion} setPersonaQuestion={setPersonaQuestion} askPersona={askPersona} personaChat={personaChat} personaChatStatus={personaChatStatus} />}
            {mode === 'admin' && <AdminPanel adminData={adminData} adminStatus={adminStatus} loadAdmin={loadAdmin} deleteRoom={adminDeleteRoom} deleteUser={adminDeleteUser} aiPromptDraft={aiPromptDraft} setAiPromptDraft={setAiPromptDraft} personaPromptDraft={personaPromptDraft} setPersonaPromptDraft={setPersonaPromptDraft} aiMaxTokens={aiMaxTokens} setAiMaxTokens={setAiMaxTokens} personaMaxTokens={personaMaxTokens} setPersonaMaxTokens={setPersonaMaxTokens} personaChatMaxTokens={personaChatMaxTokens} setPersonaChatMaxTokens={setPersonaChatMaxTokens} aiTemperature={aiTemperature} setAiTemperature={setAiTemperature} personaTemperature={personaTemperature} setPersonaTemperature={setPersonaTemperature} saveAiConfig={saveAiConfig} />}
          </section>
          <aside className="inspector glass-panel">
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
          </aside>
        </section>
        {selectedMember && (
          <MemberProfileModal
            member={selectedMember}
            items={selectedMemberItems}
            close={() => setSelectedMemberId('')}
            openItem={(itemId) => {
              setActiveId(itemId);
              setMode('showroom');
              setSelectedMemberId('');
            }}
          />
        )}
      </section>
    </main>
  );
}

function AlbumWall({ items, activeItem, setActiveId, layout, setLayout, variant = 'hero', showToolbar = true }) {
  const wallItems = variant === 'hero' && layout !== 'auto'
    ? items.slice(0, (wallLayoutPresets[layout]?.cols || 4) * (wallLayoutPresets[layout]?.rows || 3))
    : items;
  const placeholderCount = Math.min(12, Math.max(6, (wallLayoutPresets[layout]?.cols || 4) * (wallLayoutPresets[layout]?.rows || 3)));
  const runTransition = (callback) => {
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(callback);
    } else {
      callback();
    }
  };
  const selectItem = (id) => runTransition(() => setActiveId(id));
  const changeLayout = (nextLayout) => runTransition(() => setLayout(nextLayout));
  const toolbar = showToolbar ? (
    <div className="wall-toolbar" aria-label="陈列布局">
      <div className="wall-label">
        <strong>专辑陈列柜</strong>
        <span>{items.length ? `${items.length} 张封面` : '等待第一张封面'}</span>
      </div>
      <div className="wall-layout-buttons">
        {Object.entries(wallLayoutPresets).map(([key, preset]) => (
          <button key={key} type="button" className={layout === key ? 'active' : ''} onClick={() => changeLayout(key)}>{preset.label}</button>
        ))}
      </div>
    </div>
  ) : null;

  if (!items.length) {
    if (variant === 'hero') {
      return (
        <div className={`album-wall album-wall-${variant} empty-album-wall empty-poster-wall wall-${layout}`} style={wallLayoutStyle(layout)}>
          {toolbar}
          <div className="poster-grid ghost-poster-grid" aria-hidden="true">
            {Array.from({ length: placeholderCount }).map((_, index) => (
              <span key={index} className="ghost-poster" style={{ '--tile-index': index }} />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className={`album-wall album-wall-${variant} empty-album-wall wall-${layout}`} style={wallLayoutStyle(layout)}>
        {toolbar}
        <div className="poster-empty">
          <Disc3 size={58} />
          <strong>第一张封面还在路上</strong>
          <span>添加歌曲或专辑后，这里会变成房间的专辑陈列柜。</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`album-wall album-wall-${variant} wall-${layout}`} style={wallLayoutStyle(layout)}>
      {toolbar}
      <div className="poster-grid" aria-label="专辑陈列墙">
        {wallItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={activeItem?.id === item.id ? 'poster-tile active' : 'poster-tile'}
            aria-label={`${item.type === 'album' ? '专辑' : '歌曲'} ${item.title} ${item.artist}`}
            onClick={() => selectItem(item.id)}
            style={{ '--tile-index': index, '--poster-a': item.palette?.[0] || 'var(--cover-a)', '--poster-b': item.palette?.[1] || 'var(--cover-b)' }}
          >
            <AlbumArt item={item} />
            <span>{item.type === 'album' ? 'album' : 'song'}</span>
            <strong>{item.title}</strong>
            <small>{item.artist}</small>
          </button>
        ))}
      </div>
      {showToolbar && layout !== 'auto' && items.length > wallItems.length && <p className="wall-more">还有 {items.length - wallItems.length} 张封面收在展柜里，切换“自动”查看全部。</p>}
    </div>
  );
}

function MemberProfileModal({ member, items, close, openItem }) {
  const profile = member.profile || {};
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

  return (
    <div className="member-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <aside className="member-modal glass-panel" role="dialog" aria-modal="true" aria-label={`${member.name} 的公开资料`}>
        <button type="button" className="modal-close" aria-label="关闭" onClick={close}>×</button>
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

function RoomHero({ room, heroConfig, roomSettingsDraft, setRoomSettingsDraft, saveRoomSettings, roomStatus, canEditRoom, heroEditing, setHeroEditing, activeItem, items, comments, roomMembers, roomUrl, setMode, setActiveId, logout }) {
  const heroRef = useRef(null);
  const pointerFrame = useRef(0);
  const [wallLayout, setWallLayout] = useState('4x3');
  const themeClass = `hero-${heroConfig.visualMode} motion-${heroConfig.motionLevel}`;

  const updateHeroDraft = (patch) => {
    setRoomSettingsDraft((current) => ({
      ...current,
      heroConfig: editableHeroConfig({ ...(current.heroConfig || {}), ...patch }, room)
    }));
  };

  useEffect(() => () => {
    if (pointerFrame.current) cancelAnimationFrame(pointerFrame.current);
  }, []);

  const updatePointer = (event) => {
    if (heroConfig.motionLevel === 'still' || !heroRef.current) return;
    const target = event.currentTarget;
    const { clientX, clientY } = event;
    if (pointerFrame.current) cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--hero-x', `${Math.round(((clientX - rect.left) / rect.width) * 100)}%`);
      target.style.setProperty('--hero-y', `${Math.round(((clientY - rect.top) / rect.height) * 100)}%`);
      pointerFrame.current = 0;
    });
  };

  return (
    <section
      ref={heroRef}
      className={`hero compact-hero room-hero gallery-only-hero ${themeClass}`}
      onPointerMove={updatePointer}
      style={{ '--hero-x': '50%', '--hero-y': '42%' }}
    >
      <div className="hero-field" aria-hidden="true">
        <span className="field-ring ring-one" />
        <span className="field-ring ring-two" />
        <span className="field-scanline" />
      </div>
      <div className="hero-wall-stage">
        <AlbumWall items={items} activeItem={activeItem} setActiveId={setActiveId} layout={wallLayout} setLayout={setWallLayout} variant="hero" />
      </div>
      {canEditRoom && (
        <button type="button" className="hero-edit-button" aria-label="编辑首页" title="编辑首页" aria-expanded={heroEditing} onClick={() => setHeroEditing((value) => !value)}><Pencil size={16} /></button>
      )}
      {heroEditing && canEditRoom && (
        <HeroEditor
          draft={roomSettingsDraft.heroConfig || heroConfig}
          updateHeroDraft={updateHeroDraft}
          saveRoomSettings={saveRoomSettings}
          roomStatus={roomStatus}
          close={() => setHeroEditing(false)}
        />
      )}
    </section>
  );
}

function HeroRecordStage({ activeItem, items, orbitStats, roomMembers, setMode }) {
  if (!activeItem) {
    return (
      <div className="now-card hero-stage glass-panel empty-hero-card">
        <div className="empty-record" aria-hidden="true"><Disc3 size={54} /></div>
        <h2>展柜是空的</h2>
        <p>添加第一首歌曲或第一张专辑。</p>
        <button type="button" className="full-action narrow" onClick={() => setMode('add')}><CirclePlus size={16} />添加音乐</button>
      </div>
    );
  }

  return (
    <div className="now-card hero-stage glass-panel">
      <div className="record-orbit" aria-hidden="true">
        {orbitStats.map(([label, value], index) => (
          <span key={label} style={{ '--i': index }}><strong>{value || 0}</strong><small>{label}</small></span>
        ))}
      </div>
      <div className="record-core">
        <div className="vinyl-disc" aria-hidden="true" />
        <div className="cover-wrap hero-cover-wrap"><AlbumArt item={activeItem} /></div>
      </div>
      <div className="now-meta hero-now-meta">
        <span>{activeItem.type === 'album' ? '专辑' : '歌曲'} · {activeItem.year || activeItem.albumTitle || '未知年份'}</span>
        <h2>{activeItem.title}</h2>
        <p>{activeItem.artist}</p>
      </div>
      <div className="hero-stage-footer">
        <div className="member-dots">
          {roomMembers.slice(0, 4).map((member) => <span key={member.name} title={member.name} style={{ '--dot': member.color }}>{member.avatar}</span>)}
        </div>
        <div className="platform-pills">{(activeItem.platforms || []).slice(0, 4).map((name) => <span key={name}>{name}</span>)}</div>
        <div className="meter"><span>当前展柜</span><strong>{items.length}</strong></div>
      </div>
    </div>
  );
}

function HeroEditor({ draft, updateHeroDraft, saveRoomSettings, roomStatus, close }) {
  const heroDraft = editableHeroConfig(draft);
  return (
    <aside className="hero-editor glass-panel" role="region" tabIndex="-1" aria-label="首页主题编辑">
      <div className="section-title"><Pencil size={18} /><h2>首页主题</h2></div>
      <label>小标题<input value={heroDraft.eyebrow} onChange={(event) => updateHeroDraft({ eyebrow: event.target.value })} /></label>
      <label>主标题<input value={heroDraft.title} onChange={(event) => updateHeroDraft({ title: event.target.value })} placeholder="留空则使用房间名" /></label>
      <label>副标题<input value={heroDraft.titleSuffix} onChange={(event) => updateHeroDraft({ titleSuffix: event.target.value })} /></label>
      <label>首页文案<textarea value={heroDraft.description} onChange={(event) => updateHeroDraft({ description: event.target.value })} /></label>
      <div className="theme-form-grid">
        <label>视觉模式<select value={heroDraft.visualMode} onChange={(event) => updateHeroDraft({ visualMode: event.target.value })}><option value="observatory">观测室</option><option value="vinyl">黑胶舞台</option><option value="editorial">杂志大片</option></select></label>
        <label>动效强度<select value={heroDraft.motionLevel} onChange={(event) => updateHeroDraft({ motionLevel: event.target.value })}><option value="ambient">轻动效</option><option value="cinematic">电影感</option><option value="still">静态</option></select></label>
      </div>
      <label>主题名<input value={heroDraft.accentName} onChange={(event) => updateHeroDraft({ accentName: event.target.value })} /></label>
      <label>背景图 URL<input value={heroDraft.backgroundUrl} onChange={(event) => updateHeroDraft({ backgroundUrl: event.target.value })} placeholder="可留空，默认跟随当前专辑封面" /></label>
      <div className="hero-editor-actions">
        <button type="button" className="secondary-action" onClick={close}>收起</button>
        <button type="button" className="primary-action" onClick={saveRoomSettings}>保存首页</button>
      </div>
      {roomStatus && <p className="status-line">{roomStatus}</p>}
    </aside>
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
          {selectedCandidate ? <><AlbumArt item={selectedCandidate} className="feature-art" /><p className="eyebrow"><Album size={15} /> selected {selectedType}</p><h3>{selectedCandidate.title}</h3><p>{selectedCandidate.artist} · {selectedCandidate.type === 'album' ? '专辑' : selectedCandidate.albumTitle}</p><div className="tag-row compact-tags">{(selectedCandidate.tags || []).map((tag) => <span key={tag}>{tag}</span>)}</div><button type="button" className="full-action" disabled={isAdding} onClick={addSelectedToShowroom}><CirclePlus size={16} />{isAdding ? '正在深度生成' : `加入${selectedType}`}</button>{isAdding && <AddGenerationLoader item={selectedCandidate} phaseSteps={phaseSteps} activePhaseIndex={activePhaseIndex} />}<p className="status-line">{isAdding ? '正在联网检索资料，并用 DeepSeek v4 Pro 生成更长、更具体的音乐导览；等待会更久，但不会用低质兜底替代。' : (statusLabels[backgroundStatus] || statusLabels[itemStatus] || '确认后会写入当前房间。')}</p>{addError && <p className="status-line error-line">{addError}</p>}</> : <div className="empty-state">搜索并选择一个候选。</div>}
        </div>
      </div>
      {isAdding && selectedCandidate && <div className="generation-backdrop" style={{ '--loader-cover': cssImageUrl(selectedCandidate.cover) }} aria-hidden="true" />}
    </div>
  );
}

function Showroom({ items, activeItem, activeComments, draft, setDraft, submitComment, commentStatus, commentAiStatus, setActiveId, setMode, askAi, itemStatus, session, deleteItem, deleteComment, memberProfilesById, openMember }) {
  const [showcaseMode, setShowcaseMode] = useState('tracks');
  const [wallLayout, setWallLayout] = useState('4x3');
  const runTransition = (callback) => {
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(callback);
    } else {
      callback();
    }
  };
  const switchShowcaseMode = (nextMode) => runTransition(() => setShowcaseMode(nextMode));
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
  const genreTags = profile.genre?.length ? profile.genre : activeItem?.tags || [];
  const guide = profile.listeningGuide?.length ? profile.listeningGuide : tracks.slice(0, 5).map((track, index) => `${index + 1}. ${track}`);
  const prompts = profile.discussionPrompts?.length ? profile.discussionPrompts : ['你最先被哪一个段落吸引？', '这首歌适合推荐给谁？', '你会从同专辑继续听哪一首？'];
  const listeningLinks = listeningLinksFor(activeItem);
  const modeIcon = showcaseMode === 'spotlight' ? Sparkles : showcaseMode === 'tracks' ? Music2 : Grid3X3;
  const ModeIcon = modeIcon;
  const canDeleteActive = activeItem && (activeItem.addedById === session?.user?.id || session?.user?.role === 'admin');
  const activeAdder = activeItem?.addedById ? memberProfilesById?.[activeItem.addedById] : null;

  if (!items.length) return <div className="panel-content empty-showroom"><Disc3 size={48} /><h2>展柜还没有内容</h2><p>从歌曲或专辑开始，把朋友的推荐放进这个房间。</p><button className="full-action narrow" type="button" onClick={() => setMode('add')}><CirclePlus size={16} />添加第一条</button></div>;
  return (
    <div className={`panel-content showroom-panel showcase-${showcaseMode}`}>
      <div className="showroom-command">
        <div>
          <p className="eyebrow"><ModeIcon size={15} /> core showroom</p>
          <h2>{showcaseMode === 'tracks' ? '轨道' : showcaseMode === 'spotlight' ? '聚光' : '封面墙'}</h2>
          <p>左右滑动封面，点击切换条目，再进入曲目、评论和聆听入口。</p>
        </div>
        <div className="showroom-views" aria-label="展柜形态">
          {[
            ['wall', Grid3X3, '封面墙'],
            ['spotlight', Sparkles, '聚光'],
            ['tracks', Music2, '轨道']
          ].map(([key, Icon, label]) => (
            <button key={key} className={showcaseMode === key ? 'active' : ''} type="button" onClick={() => switchShowcaseMode(key)}><Icon size={16} />{label}</button>
          ))}
        </div>
      </div>

      {showcaseMode === 'spotlight' && activeItem && (
        <section className="spotlight-stage">
          <button className="spotlight-cover" type="button" onClick={() => setShowcaseMode('wall')}><AlbumArt item={activeItem} /></button>
          <div className="spotlight-copy">
            <p className="eyebrow"><Album size={15} /> {activeItem.type === 'album' ? 'album focus' : 'song focus'}</p>
            <h3>{activeItem.title}</h3>
            <p>{activeItem.artist} · {activeItem.albumTitle || activeItem.year}</p>
            <div className="spotlight-stats"><span>{tracks.length} 首曲目</span><span>{siblingSongs.length || relatedSongs.length} 首已收录歌曲</span><span>{activeComments.length} 条评论</span></div>
          </div>
        </section>
      )}

      <AlbumWall items={items} activeItem={activeItem} setActiveId={setActiveId} layout={wallLayout} setLayout={setWallLayout} variant={showcaseMode === 'tracks' ? 'rail' : 'showroom'} showToolbar={showcaseMode !== 'tracks'} />

      {activeItem && (
        <div className="detail-drawer glass-panel showroom-detail">
          <div className="detail-art-stack">
            <AlbumArt item={activeItem} className="feature-art" />
            <div className="vinyl-shadow" aria-hidden="true" />
          </div>
          <div className="detail-story">
            <p className="eyebrow"><Album size={15} /> {activeItem.type === 'album' ? 'album' : 'song'} in showroom</p>
            <h2>{activeItem.title}</h2>
            <p>{activeItem.artist} · {activeItem.albumTitle || activeItem.year}</p>
            <p>{profile.overview || activeItem.background || activeItem.context}</p>
            <div className="tag-row compact-tags profile-tags">{genreTags.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="detail-actions">
              <button type="button" onClick={askAi}><Bot size={16} />请求 AI 推荐</button>
              <button type="button" onClick={() => setMode('add')}><CirclePlus size={16} />继续添加</button>
              {canDeleteActive && <button type="button" className="danger-action" onClick={() => deleteItem(activeItem)}><Trash2 size={16} />删除条目</button>}
            </div>
            {listeningLinks.length > 0 && (
              <div className="listening-links">
                <strong><Radio size={16} />聆听入口</strong>
                <div>
                  {listeningLinks.map((link) => (
                    <a key={`${link.provider}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
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
                {parentAlbum && <button type="button" onClick={() => setActiveId(parentAlbum.id)}>查看专辑</button>}
              </div>
            )}
            <div className="showroom-tracklist">
              {tracks.map((track, index) => (
                <button key={`${track}-${index}`} type="button" className={activeTrackIndex === index ? 'showroom-track current' : 'showroom-track'}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{track}</strong>
                  <small>{activeTrackIndex === index ? '当前歌曲' : albumContextItem.artist}</small>
                </button>
              ))}
            </div>
            {activeItem.type === 'album' && (
              <div className="related-song-panel">
                <strong>房间已收录歌曲</strong>
                {relatedSongs.length ? relatedSongs.map((song) => (
                  <button key={song.id} type="button" className="related-song" onClick={() => setActiveId(song.id)}>
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
            <button type="button" onClick={submitComment}><Send size={16} />发布到展柜</button>
            <p className="status-line">{commentStatus === 'cloud' ? '评论已同步。' : commentStatus}</p>
            {commentAiStatus === 'thinking' && <div className="ai-writing"><Bot size={16} />AI 正在阅读你的评论，并准备一个可以继续聊下去的问题。</div>}
            {commentAiStatus && !['idle', 'thinking', 'done'].includes(commentAiStatus) && <p className="status-line error-line">{commentAiStatus}</p>}
            <div className="showroom-comment-list">
              {activeComments.length ? activeComments.map((comment) => {
                const author = comment.userId ? memberProfilesById?.[comment.userId] : null;
                return (
                  <article key={comment.id} className="comment">
                    <div><AuthorChip profile={author} fallbackName={comment.author} fallbackAvatar={comment.avatar} onOpen={openMember} /><span><Star size={14} /> {comment.mood}</span></div>
                    <p>{comment.text}</p>
                    {(comment.userId === session?.user?.id || session?.user?.role === 'admin') && !comment.isAi && <button type="button" className="inline-delete" onClick={() => deleteComment(comment)}><Trash2 size={14} />删除评论</button>}
                  </article>
                );
              }) : <p className="empty-state compact-empty">还没有评论。</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Review({ selected, comments, draft, setDraft, submitComment, commentStatus, commentAiStatus, session, deleteComment, memberProfilesById, openMember }) {
  if (!selected) return <div className="panel-content empty-state">先在展柜中添加或选择一条音乐。</div>;
  return <div className="panel-content"><div className="review-composer"><p className="eyebrow"><MessageCircle size={15} /> comments</p><h2>评论 {selected.title}</h2><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="写下你推荐它的原因" /><button type="button" onClick={submitComment}><Send size={17} /> 发布评论</button><p className="status-line">{commentStatus === 'cloud' ? '评论已同步。' : commentStatus}</p>{commentAiStatus === 'thinking' && <div className="ai-writing"><Bot size={16} />AI 正在阅读你的评论，并准备一个可以继续聊下去的问题。</div>}</div><div className="comment-list">{comments.length ? comments.map((comment) => { const author = comment.userId ? memberProfilesById?.[comment.userId] : null; return <article key={comment.id} className="comment"><div><AuthorChip profile={author} fallbackName={comment.author} fallbackAvatar={comment.avatar} onOpen={openMember} /><span><Star size={14} /> {comment.mood}</span></div><p>{comment.text}</p>{(comment.userId === session?.user?.id || session?.user?.role === 'admin') && !comment.isAi && <button type="button" className="inline-delete" onClick={() => deleteComment(comment)}><Trash2 size={14} />删除评论</button>}</article>; }) : <p className="empty-state">还没有评论。</p>}</div></div>;
}

function Ai({ selected, aiInsight, aiStatus, askAi }) {
  if (!selected) return <div className="panel-content empty-state">添加音乐后即可请求 AI 推荐。</div>;
  return <div className="panel-content ai-grid"><article className="ai-card wide"><p className="eyebrow"><Bot size={15} /> recommendation</p><h2>围绕 {selected.title} 生成推荐</h2><p>{selected.background || selected.context}</p><button type="button" onClick={askAi}>{aiStatus === 'thinking' ? '生成中' : '生成推荐与追问'} <ChevronRight size={15} /></button>{aiInsight && <p className="ai-insight spacious">{aiInsight}</p>}</article>{recommendations.map(([title, reason]) => <article className="ai-card" key={title}><Music2 size={19} /><strong>{title}</strong><p>{reason}</p></article>)}</div>;
}

function EditableList({ label, value, onChange, placeholder }) {
  return (
    <label>
      {label}
      <input value={listToText(value)} onChange={(event) => onChange(textToList(event.target.value))} placeholder={placeholder} />
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

function RoomPanel({ room, roomUrl, session, comments, items, knownRooms, discoverRooms, switchRoom, roomDraft, setRoomDraft, createAnotherRoom, inviteDraft, setInviteDraft, invitePassword, setInvitePassword, joinAnotherRoom, roomStatus, roomSettingsDraft, setRoomSettingsDraft, saveRoomSettings }) {
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
      </section>
      {roomStatus && <p className="status-line">{roomStatus}</p>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
