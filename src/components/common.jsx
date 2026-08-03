import React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Bot, ChevronRight, Disc3, Music2, Sparkles, Star, Trash2 } from 'lucide-react';
import {
  recommendations,
  avatarFor,
  avatarSrc,
  publicMemberProfile,
  listToText,
  textToList,
  fallbackPalette,
  rgbToHslString,
  cssImageUrl,
  stableIndex,
} from '../lib/utils.js';

/* ------------------------------------------------------------------ *
 * 头像
 * ------------------------------------------------------------------ */
export function UserAvatar({ user, className = '' }) {
  const src = avatarSrc(user);
  if (src) {
    return (
      <img
        className={`h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/15 ${className}`}
        src={src}
        alt={`${user?.name || '用户'} 头像`}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-sky/70 to-accent-purple/60 text-[11px] font-bold text-ink-950 ring-1 ring-white/15 ${className}`}
    >
      {user?.avatar || avatarFor(user?.name)}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * 作者胶囊
 * ------------------------------------------------------------------ */
export function AuthorChip({ profile, fallbackName, fallbackAvatar, onOpen }) {
  const user = profile || publicMemberProfile({ name: fallbackName, avatar: fallbackAvatar });
  const canOpen = Boolean(profile?.id && onOpen);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] py-1 pl-1 pr-3 text-xs font-medium text-paper-dim transition-colors duration-200 enabled:hover:border-white/20 enabled:hover:bg-white/[0.1] enabled:hover:text-paper disabled:cursor-default"
      disabled={!canOpen}
      onClick={() => canOpen && onOpen(profile.id)}
      title={canOpen ? `查看 ${user.name} 的公开资料` : undefined}
    >
      <UserAvatar user={user} className="!h-6 !w-6 !text-[10px]" />
      <span className="max-w-[10rem] truncate">{user.name || fallbackName || 'Music friend'}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * 封面取色
 * ------------------------------------------------------------------ */
export function useCoverPalette(item) {
  const fallback = useMemo(
    () => fallbackPalette(item),
    [item?.palette, item?.title, item?.artist, item?.albumTitle]
  );
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
            b: Math.round(bucket.b / bucket.count),
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
            rgbToHslString((colors[2] || colors[0]).r, (colors[2] || colors[0]).g, (colors[2] || colors[0]).b, 18),
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

/* ------------------------------------------------------------------ *
 * 专辑封面
 * ------------------------------------------------------------------ */
const ART_SIZES = {
  thumb: 'h-12 w-12 rounded-sm',
  small: 'h-20 w-20 rounded-md',
  large: 'aspect-square w-full rounded-lg',
};

export function AlbumArt({ item, className = '', size = 'large' }) {
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

  useEffect(() => setFailed(false), [item?.cover]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-ink-800 ring-1 ring-white/[0.08] ${ART_SIZES[size] || ART_SIZES.large} ${className}`}
      aria-label={`${title} 封面`}
      style={{
        '--art-a': item?.palette?.[0] || '#6fc7ff',
        '--art-b': item?.palette?.[1] || '#f7df71',
        '--art-c': item?.palette?.[2] || '#f8fbff',
      }}
    >
      {!failed && item?.cover ? (
        <img
          src={item.cover}
          alt={`${title} 封面`}
          width="640"
          height="640"
          className="h-full w-full object-cover"
          loading={size === 'thumb' ? 'lazy' : 'eager'}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center"
          style={{
            background:
              'linear-gradient(140deg, var(--art-a) 0%, var(--art-b) 55%, var(--art-c) 100%)',
          }}
        >
          <Disc3 size={size === 'thumb' ? 16 : 38} className="text-ink-950/70" />
          {size !== 'thumb' && (
            <>
              <strong className="text-lg font-black text-ink-950/85">{initials}</strong>
              <span className="line-clamp-1 text-[10px] font-medium text-ink-950/60">{artist}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 添加导览生成中
 * ------------------------------------------------------------------ */
export function AddGenerationLoader({ item, phaseSteps, activePhaseIndex }) {
  const progress = `${Math.max(18, Math.min(100, ((activePhaseIndex + 1) / phaseSteps.length) * 100))}%`;
  const title = item?.title || '这条音乐';
  const artist = item?.artist || 'Album Circle';

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-white/[0.1] bg-ink-900/80 p-5 backdrop-blur-xl"
      aria-live="polite"
      style={{ '--loader-cover': cssImageUrl(item?.cover) }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25 blur-2xl"
        aria-hidden="true"
        style={{ backgroundImage: 'var(--loader-cover)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="relative flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          <span className="absolute inset-0 animate-slow-spin rounded-full border border-dashed border-accent-sky/40" aria-hidden="true" />
          <AlbumArt item={item} size="small" className="!h-16 !w-16" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="ac-eyebrow">
            <Bot size={14} /> deep guide
          </p>
          <strong className="mt-1 block truncate text-sm font-semibold text-paper">{title}</strong>
          <small className="ac-muted line-clamp-1">{artist} 的资料正在被整理成可读导览</small>
        </div>
      </div>
      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.1]">
        <i
          className="block h-full rounded-full bg-gradient-to-r from-accent-sky to-accent-purple transition-[width] duration-700 ease-soft"
          style={{ width: progress }}
        />
      </div>
      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {phaseSteps.map(([key, label], index) => (
          <span
            key={key}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-300 ${
              index <= activePhaseIndex
                ? 'bg-accent-sky/20 text-accent-sky'
                : 'bg-white/[0.05] text-paper-faint'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 音乐人格生成中
 * ------------------------------------------------------------------ */
export function PersonaGenerationLoader({ tone, selectedCount, profileStats, user }) {
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

  const topArtists = (profileStats?.topArtists || []).slice(0, 5);
  const recentAdds = (profileStats?.recentAdds || []).slice(0, 5);
  const tags = (profileStats?.tags || []).slice(0, 6);
  const commentCount =
    profileStats?.commentsAdded || (Array.isArray(profileStats?.comments) ? profileStats.comments.length : 0);
  const avatar = avatarSrc(user);
  const profile = user?.profile || {};
  const profileLabel =
    [profile.mbti, profile.birthYear, profile.major].filter(Boolean).slice(0, 2).join(' / ') || '资料牌';
  const favoriteArtists = Array.isArray(profile.favoriteArtists) ? profile.favoriteArtists : [];
  const favoriteGenres = Array.isArray(profile.favoriteGenres) ? profile.favoriteGenres : [];
  const favoriteAlbums = Array.isArray(profile.favoriteAlbums) ? profile.favoriteAlbums : [];

  const baseCards = [
    { title: user?.name || '你', kind: 'avatar', image: avatar, label: profileLabel },
    {
      title: selectedCount ? `${selectedCount} 首代表作` : '偏好资料',
      kind: 'profile',
      label: favoriteGenres[0] || tags[0]?.name || tone,
    },
    ...recentAdds.slice(0, 3).map((item) => ({ title: item.title, kind: 'music', image: item.cover, label: item.artist })),
    { title: favoriteArtists[0] || topArtists[0]?.name || '歌手雷达', kind: 'artist', label: favoriteAlbums[0] || '相似气质检索' },
    { title: '评论切片', kind: 'comment', label: `${commentCount} 条线索` },
    { title: tags[0]?.name || '隐藏标签', kind: 'tag', label: tags[1]?.name || '等待揭牌' },
  ];
  const cardItems = baseCards
    .filter(
      (item, index, array) =>
        item.title && array.findIndex((c) => c.title === item.title && c.kind === item.kind) === index
    )
    .slice(0, 6);

  const phasePlan = [
    { at: 0, label: '资料入阵', detail: '保存个人资料、代表作和评论切片', icon: '01', note: '先把你的资料牌、歌单牌和评论牌放到同一张桌面上。' },
    { at: 18, label: '联网检索', detail: 'Tavily 查找相似艺人、专辑语境和评论来源', icon: '02', note: '这一步在给推荐找外部参照，不让结果只凭空想。' },
    { at: 48, label: '音乐写手', detail: 'v4 Pro 生成音乐人格长稿', icon: '03', note: '它会盯着人声、旋律、专辑感和你留下的歌曲线索。' },
    { at: 88, label: '生活写手', detail: 'v4 Pro 推演日常性格和相处方式', icon: '04', note: '这一步负责把歌单翻译成更像人的侧写。' },
    { at: 128, label: '策展写手', detail: 'v4 Pro 生成推荐方向和口味边界', icon: '05', note: '新的歌手、专辑、歌曲会在这里开始成形。' },
    { at: 168, label: '主编融合', detail: '把多份草稿熔成一篇完整灵魂侧写', icon: '06', note: '主编会删掉套话，保留最像你的句子。' },
    { at: 212, label: '排版成卡', detail: '生成标签、主题色、彩蛋和继续追问', icon: '07', note: '最后把长文装进前端能展示的卡片和标签。' },
  ];
  const nextPhaseIndex = phasePlan.findIndex(
    (phase, index) => elapsed >= phase.at && (index === phasePlan.length - 1 || elapsed < phasePlan[index + 1].at)
  );
  const activePhaseIndex = Math.min(phasePlan.length - 1, Math.max(0, nextPhaseIndex));
  const activePhase = phasePlan[activePhaseIndex] || phasePlan[0];
  const progress = Math.min(96, Math.max(7, Math.round((elapsed / totalEstimate) * 96)));
  const remaining = Math.max(0, totalEstimate - elapsed);
  const waitLine = remaining > 0 ? `预计还要 ${Math.ceil(remaining / 30) * 30} 秒左右` : '正在等最后一张牌落桌';
  const interactionCards = {
    phase: activePhase.note,
    sources: `将参考 ${profileStats?.itemsAdded || 0} 条添加记录、${commentCount} 条评论线索和联网资料。`,
    question: '可以先想一个问题：为什么我会喜欢这些声音？下一批要更安全还是更冒险？',
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/[0.1] bg-ink-900/80 p-5 backdrop-blur-xl" aria-live="polite">
      {/* 占卜台 */}
      <div className="relative mx-auto grid h-40 w-full max-w-md place-items-center" aria-hidden="true">
        <div className="absolute h-32 w-32 animate-halo-pulse rounded-full bg-accent-purple/25 blur-3xl" />
        <div className="absolute h-36 w-36 animate-slow-spin rounded-full border border-dashed border-accent-sky/25" />
        <div className="absolute h-28 w-28 rounded-full border border-white/[0.06]" />
        <div className="relative flex items-end justify-center">
          {cardItems.map((item, index) => (
            <i
              key={`${item.title}-${index}`}
              className="relative -mx-3 block h-24 w-16 overflow-hidden rounded-md border border-white/[0.12] bg-ink-800 shadow-soft"
              style={{
                transform: `rotate(${(index - (cardItems.length - 1) / 2) * 8}deg) translateY(${Math.abs(index - (cardItems.length - 1) / 2) * 5}px)`,
                backgroundImage: item.image ? cssImageUrl(item.image) : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                zIndex: index,
              }}
            >
              <span className="absolute inset-0 flex flex-col justify-end gap-0.5 bg-gradient-to-t from-ink-950/90 to-transparent p-1.5">
                <b className="line-clamp-2 text-[9px] font-semibold leading-tight text-paper">{item.title}</b>
                <small className="line-clamp-1 text-[8px] text-paper-faint">{item.label}</small>
              </span>
            </i>
          ))}
        </div>
        <div className="absolute grid h-11 w-11 place-items-center rounded-full bg-accent-sky/20 text-accent-sky backdrop-blur">
          <Sparkles size={20} />
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="ac-eyebrow justify-center">
          <Sparkles size={14} /> deep persona
        </p>
        <strong className="mt-1 block text-lg font-bold text-paper">{activePhase.label}</strong>
        <small className="ac-muted">
          {activePhase.detail}。{waitLine}，已等待 {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}。
        </small>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.1]">
          <i
            className="block h-full rounded-full bg-gradient-to-r from-accent-sky via-accent-purple to-accent-gold transition-[width] duration-1000 ease-soft"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-10 text-right text-xs font-semibold tabular-nums text-accent-sky">{progress}%</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {phasePlan.map((phase, index) => (
          <button
            key={phase.label}
            type="button"
            onClick={() => setFocusCard('phase')}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors duration-300 ${
              index <= activePhaseIndex ? 'bg-accent-sky/20 text-accent-sky' : 'bg-white/[0.05] text-paper-faint'
            }`}
          >
            <b className="font-bold tabular-nums">{phase.icon}</b>
            <span>{phase.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-1.5" role="group" aria-label="等待时可查看的信息">
        {[
          ['phase', '当前阶段'],
          ['sources', '本次素材'],
          ['question', '待会追问'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`ac-pill flex-1 ${focusCard === key ? 'ac-pill-active' : ''}`}
            onClick={() => setFocusCard(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-start gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] p-3">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-accent-gold" />
        <p className="ac-body">{interactionCards[focusCard]}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          ['资料', selectedCount ? `${selectedCount} 首代表作` : '个人档案'],
          ['评论', `${commentCount} 条线索`],
          ['艺人', topArtists[0]?.name || '偏好雷达'],
          ['标签', tags[0]?.name || tone],
        ].map(([label, value]) => (
          <span key={label} className="flex flex-col gap-0.5 rounded-sm bg-white/[0.04] px-2.5 py-2">
            <b className="text-[10px] uppercase tracking-wider text-paper-faint">{label}</b>
            <span className="truncate text-xs font-medium text-paper-dim">{value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 确认对话框（带焦点陷阱）
 * ------------------------------------------------------------------ */
export function ConfirmDialog({ config, close }) {
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
      const focusable = [
        ...dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((element) => !element.disabled && element.offsetParent !== null);
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
    <div
      className="fixed inset-0 z-[90] grid animate-fade-in place-items-center bg-ink-950/75 p-4 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <section
        className="ac-card w-full max-w-md animate-scale-in bg-ink-900/90"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        ref={dialogRef}
      >
        <p className="ac-eyebrow !text-accent-pink">
          <Trash2 size={15} /> careful action
        </p>
        <h2 id="confirm-title" className="mt-2 text-xl font-bold text-paper">
          {config.title}
        </h2>
        <p className="ac-body mt-2">{config.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="ac-btn" onClick={close} disabled={busy} ref={cancelRef}>
            取消
          </button>
          <button type="button" className="ac-btn-danger" onClick={confirm} disabled={busy}>
            <Trash2 size={15} />
            {busy ? '处理中…' : config.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 评分面板
 * ------------------------------------------------------------------ */
export function RatingPanel({ ratingSummary, submitRating, ratingStatus }) {
  const [score, setScore] = useState(ratingSummary?.mine?.score || ratingSummary?.average || 8);

  useEffect(() => {
    setScore(ratingSummary?.mine?.score || ratingSummary?.average || 8);
  }, [ratingSummary?.mine?.score, ratingSummary?.average]);

  const quickScores = [6, 7, 8, 9, 10];
  return (
    <section className="ac-card flex flex-col gap-4 !p-4" aria-label="专辑评分">
      <div className="flex items-baseline gap-3">
        <span className="ac-muted">好友均分</span>
        <strong className="text-2xl font-black tabular-nums text-accent-gold">
          {ratingSummary?.count ? ratingSummary.average.toFixed(1) : '—'}
        </strong>
        <small className="ac-muted">{ratingSummary?.count ? `${ratingSummary.count} 人评分` : '给它第一颗星'}</small>
      </div>
      <label className="ac-field">
        <span className="flex items-center justify-between">
          我的评分
          <b className="text-sm font-bold tabular-nums text-accent-sky">{Number(score).toFixed(1)}</b>
        </span>
        <input
          type="range"
          className="ac-range"
          min="0"
          max="10"
          step="0.5"
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          aria-valuetext={`${Number(score).toFixed(1)} 分`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        {quickScores.map((value) => (
          <button
            key={value}
            type="button"
            className={`ac-pill ${Number(score) === value ? 'ac-pill-active' : ''}`}
            onClick={() => setScore(value)}
          >
            <Star size={12} />
            {value}
          </button>
        ))}
        <button
          type="button"
          className="ac-btn-primary ml-auto !px-3.5 !py-1.5 !text-xs"
          onClick={() => submitRating(score)}
          disabled={ratingStatus === 'saving'}
        >
          {ratingStatus === 'saving' ? '保存中' : '保存评分'}
        </button>
      </div>
      {ratingStatus && !['idle', 'cloud', 'saving'].includes(ratingStatus) && (
        <p className="ac-status-error" aria-live="assertive">
          {ratingStatus}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * AI 推荐页
 * ------------------------------------------------------------------ */
export function Ai({ selected, aiInsight, aiStatus, askAi }) {
  if (!selected) {
    return (
      <div className="ac-page">
        <div className="ac-empty">
          <Bot size={40} className="text-paper-faint" />
          <p className="ac-body">添加音乐后即可请求 AI 推荐。</p>
        </div>
      </div>
    );
  }
  return (
    <div className="ac-page">
      <article className="ac-card animate-slide-up">
        <p className="ac-eyebrow">
          <Bot size={15} /> recommendation
        </p>
        <h2 className="ac-h2 mt-2">围绕 {selected.title} 生成推荐</h2>
        <p className="ac-body mt-2">{selected.background || selected.context}</p>
        <button type="button" className="ac-btn-primary mt-4" onClick={askAi} disabled={aiStatus === 'thinking'}>
          {aiStatus === 'thinking' ? '生成中…' : '生成推荐与追问'}
          <ChevronRight size={15} />
        </button>
        {aiInsight && (
          <p className="mt-4 whitespace-pre-wrap rounded-md border border-accent-sky/20 bg-accent-sky/[0.06] p-4 text-sm leading-relaxed text-paper-dim">
            {aiInsight}
          </p>
        )}
      </article>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.map(([title, reason], index) => (
          <article
            key={title}
            className="ac-card ac-card-hover animate-slide-up"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <Music2 size={19} className="text-accent-gold" />
            <strong className="mt-2 block text-sm font-semibold text-paper">{title}</strong>
            <p className="ac-body mt-1">{reason}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 可编辑列表（逗号分隔）
 * ------------------------------------------------------------------ */
export function EditableList({ label, value, onChange, placeholder }) {
  const [text, setText] = useState(() => listToText(value));

  useEffect(() => {
    setText(listToText(value));
  }, [Array.isArray(value) ? value.join('\u0001') : value]);

  return (
    <label className="ac-field">
      {label}
      <input
        className="ac-input"
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
