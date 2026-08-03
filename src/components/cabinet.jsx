import React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronRight,
  CirclePlus,
  Disc3,
  Grid3X3,
  Library,
  Sparkles,
  UserRound,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import {
  hoverPreviewLabels,
  wallLayoutPresets,
  mergeUserSettings,
  wallLayoutStyle,
  cabinetDisplayTitle,
  roomQueryUrl,
  parseRoomQuery,
} from '../lib/utils.js';
import { useAppStore } from '../store/useAppStore.js';
import { UserAvatar, AlbumArt } from './common.jsx';

const SORT_OPTIONS = [
  { value: 'recent', label: '添加时间' },
  { value: 'rating', label: '评分' },
  { value: 'year', label: '年份' },
  { value: 'title', label: '标题' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'album', label: '专辑' },
  { value: 'song', label: '单曲' },
];

const RATED_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'rated', label: '有评分' },
  { value: 'unrated', label: '未评分' },
];

function useSyncFilters() {
  const userSettings = useAppStore((s) => s.userSettings);
  const saveUserSettings = useAppStore((s) => s.saveUserSettings);
  const [sort, setSort] = useState(userSettings.filters?.sort || 'recent');
  const [typeFilter, setTypeFilter] = useState(userSettings.filters?.type || 'all');
  const [ratedFilter, setRatedFilter] = useState(userSettings.filters?.rated || 'all');

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    saveUserSettings({ filters: { sort, type: typeFilter, rated: ratedFilter } });
  }, [sort, typeFilter, ratedFilter]);

  return {
    sort,
    setSort,
    typeFilter,
    setTypeFilter,
    ratedFilter,
    setRatedFilter,
  };
}

export function AlbumCabinetPage() {
  const room = useAppStore((s) => s.room);
  const items = useAppStore((s) => s.items);
  const ratingsByItem = useAppStore((s) => s.ratingsByItem);
  const session = useAppStore((s) => s.session);
  const userSettings = useAppStore((s) => s.userSettings);
  const loading = useAppStore((s) => s.initialLoading);
  const routeState = useAppStore((s) => s.routeState);
  const setRouteState = useAppStore((s) => s.setRouteState);
  const setMode = useAppStore((s) => s.setMode);
  const openItemDetail = useAppStore((s) => s.openItemDetail);

  const { sort, setSort, typeFilter, setTypeFilter, ratedFilter, setRatedFilter } = useSyncFilters();
  const mineOnly = Boolean(routeState.mineOnly || userSettings.filters?.mineOnly);
  const setMineOnly = (value) => {
    if (!room?.id) return;
    const nextUrl = roomQueryUrl(room.id, { view: 'cabinet', mine: value ? '1' : '' });
    window.history.pushState(null, '', nextUrl);
    setRouteState(parseRoomQuery());
  };

  const currentUserId = session?.user?.id;
  const memberProfilesById = useMemo(() => {
    const profiles = {};
    Object.entries(room?.memberProfiles || {}).forEach(([id, member]) => {
      profiles[id] = member;
    });
    if (currentUserId) profiles[currentUserId] = session?.user;
    return profiles;
  }, [room?.memberProfiles, currentUserId, session?.user]);

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

  const layout = userSettings.showroom.wallLayout || '4x3';
  const hoverPreview = userSettings.showroom.hoverPreview || 'flip';
  const showCaptions = Boolean(userSettings.showroom.showCaptions);
  const cabinetTitle = cabinetDisplayTitle(userSettings.showroom.title, room?.name);
  const cabinetDescription = (userSettings.showroom.description || '').trim() || '悬浮封面查看背面资料，点击进入专辑的黑胶开场和完整导览。';
  const layoutLabel = wallLayoutPresets[layout]?.label || wallLayoutPresets['4x3'].label;
  const hoverLabel = hoverPreviewLabels[hoverPreview] || hoverPreviewLabels.flip;

  return (
    <section className="relative flex flex-col gap-6 p-5 md:p-8" aria-labelledby="cabinet-title">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-sky">
            <Grid3X3 size={15} /> {room?.name} / album cabinet
          </p>
          <h1 id="cabinet-title" className="text-4xl font-black text-paper md:text-5xl lg:text-6xl">
            {cabinetTitle}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-paper-dim md:text-base">
            {cabinetDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="陈列柜摘要">
          <CabinetSettingsPopover mineOnly={mineOnly} setMineOnly={setMineOnly} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-paper backdrop-blur-sm">
            <Grid3X3 size={15} /> {layoutLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-paper backdrop-blur-sm">
            <Sparkles size={15} /> {hoverLabel}
          </span>
          {mineOnly && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-sky/30 bg-accent-sky/15 px-3 py-1.5 text-xs font-semibold text-accent-sky backdrop-blur-sm">
              <UserRound size={15} /> 只看自己
            </span>
          )}
          <button
            type="button"
            onClick={() => setMode('add')}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-white/[0.14] hover:shadow-soft active:scale-[0.98]"
          >
            <CirclePlus size={16} /> 高级添加
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4" role="group" aria-label="筛选与排序">
        <FilterSelect label="排序" value={sort} onChange={setSort} options={SORT_OPTIONS} />
        <FilterSelect label="类型" value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} />
        <FilterSelect label="评分" value={ratedFilter} onChange={setRatedFilter} options={RATED_OPTIONS} />
      </div>

      <AlbumCabinetGrid
        items={visibleItems}
        layout={layout}
        hoverPreview={hoverPreview}
        openItemDetail={openItemDetail}
        ratingsByItem={ratingsByItem}
        memberProfilesById={memberProfilesById}
        coverSize={userSettings.showroom.coverSize}
        showCaptions={showCaptions}
        loading={loading}
      />
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  const id = `${label}-select`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-xs font-semibold text-paper-dim">
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-[6.5rem] rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-paper outline-none transition hover:bg-white/[0.10] focus:ring-2 focus:ring-accent-sky/60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CabinetSettingsPopover({ mineOnly, setMineOnly }) {
  const userSettings = useAppStore((s) => s.userSettings);
  const saveUserSettings = useAppStore((s) => s.saveUserSettings);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() =>
    mergeUserSettings({ ...userSettings, filters: { ...(userSettings.filters || {}), mineOnly: Boolean(mineOnly) } })
  );
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

  const update = (group, patch) =>
    setDraft((current) => mergeUserSettings({ ...current, [group]: { ...(current[group] || {}), ...patch } }));

  const save = async () => {
    setStatus('正在同步');
    try {
      await saveUserSettings({
        appearance: draft.appearance,
        showroom: draft.showroom,
        filters: draft.filters,
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

  const previewTitle = cabinetDisplayTitle(draft.showroom.title, (userSettings.showroom.title || '专辑陈列柜').replace(/\s*的专辑陈列柜$/, ''));

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls="cabinet-settings-panel"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-white/[0.14] hover:shadow-soft active:scale-[0.98]"
      >
        <Wand2 size={16} /> 陈列设置
      </button>
      {open && (
        <div
          id="cabinet-settings-panel"
          role="dialog"
          aria-modal="false"
          aria-label="陈列柜设置"
          className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-ink-800/90 p-4 shadow-card backdrop-blur-xl animate-scale-in"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-paper">
              <Sparkles size={16} /> 展柜视觉
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="关闭陈列柜设置"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-paper-dim transition hover:bg-white/10 hover:text-paper"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/[0.05] p-3">
            <span
              className="h-10 w-10 rounded-full shadow-inner"
              style={{ background: draft.appearance.customTheme }}
            />
            <div className="flex flex-col gap-0.5">
              <strong className="text-sm font-bold text-paper">{previewTitle}</strong>
              <small className="text-xs text-paper-faint">
                {wallLayoutPresets[draft.showroom.wallLayout]?.label || '4x3'} / {hoverPreviewLabels[draft.showroom.hoverPreview] || hoverPreviewLabels.flip} / {draft.filters.mineOnly ? '只看自己' : '全房间'}
              </small>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <SettingsSelect label="封面大小" value={draft.showroom.coverSize} onChange={(value) => update('showroom', { coverSize: value })} options={{ compact: '紧凑', comfortable: '舒适', large: '大封面' }} />
            <SettingsSelect label="默认布局" value={draft.showroom.wallLayout} onChange={(value) => update('showroom', { wallLayout: value })} options={Object.fromEntries(Object.entries(wallLayoutPresets).map(([k, v]) => [k, v.label]))} />
            <SettingsSelect label="悬浮方式" value={draft.showroom.hoverPreview || 'flip'} onChange={(value) => update('showroom', { hoverPreview: value })} options={{ flip: '翻面资料', blur: '高斯简介', lift: '浮起简介' }} />
            <SettingsSelect label="主题策略" value={draft.appearance.themeStrategy} onChange={(value) => update('appearance', { themeStrategy: value })} options={{ cover: '跟随封面', room: '跟随房间', custom: '自定义' }} />
            <label className="col-span-2 flex items-center justify-between gap-3 text-xs font-semibold text-paper-dim">
              自定义主题
              <input
                type="color"
                value={draft.appearance.customTheme}
                onChange={(event) => update('appearance', { customTheme: event.target.value })}
                className="h-8 w-14 cursor-pointer rounded border border-white/10 bg-transparent"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1.5 text-xs font-semibold text-paper-dim">
              玻璃强度
              <input
                type="range"
                min="35"
                max="82"
                value={draft.appearance.glass}
                onChange={(event) => update('appearance', { glass: Number(event.target.value) })}
                className="w-full accent-accent-sky"
              />
            </label>
          </div>

          <div className="mb-4 flex flex-col gap-2 rounded-xl bg-white/[0.03] p-3" aria-label="陈列柜偏好">
            <Toggle label="只看自己添加" hint="陈列柜默认筛出你添加的专辑和单曲" checked={draft.filters.mineOnly} onChange={(value) => update('filters', { mineOnly: value })} />
            <Toggle label="显示专辑标题" hint="在封面下方显示专辑名和歌手名" checked={Boolean(draft.showroom.showCaptions)} onChange={(value) => update('showroom', { showCaptions: value })} />
            <Toggle label="减少动效" hint="关闭翻面、入场和呼吸类动画" checked={draft.appearance.reduceMotion} onChange={(value) => update('appearance', { reduceMotion: value })} />
            <Toggle label="彩虹呼吸状态" hint="搜索、生成和保存时显示全屏边缘状态光" checked={draft.appearance.rainbowStatus} onChange={(value) => update('appearance', { rainbowStatus: value })} />
          </div>

          <div className="mb-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-paper-dim">
              标题
              <input
                value={draft.showroom.title || ''}
                onChange={(event) => update('showroom', { title: event.target.value })}
                placeholder="专辑陈列柜"
                maxLength={80}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-paper outline-none transition focus:ring-2 focus:ring-accent-sky/60"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-paper-dim">
              说明
              <textarea
                value={draft.showroom.description || ''}
                onChange={(event) => update('showroom', { description: event.target.value })}
                placeholder="悬浮封面查看背面资料，点击进入专辑的黑胶开场和完整导览。"
                maxLength={220}
                rows={3}
                className="resize-none rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-paper outline-none transition focus:ring-2 focus:ring-accent-sky/60"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={resetCopy}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-white/[0.12]"
            >
              恢复默认文案
            </button>
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-sky px-4 py-1.5 text-xs font-bold text-ink-950 transition hover:brightness-110 active:scale-[0.98]"
            >
              <Sparkles size={15} /> 保存展柜设置
            </button>
          </div>
          {status && <p className="mt-3 text-xs text-paper-dim">{status}</p>}
        </div>
      )}
    </div>
  );
}

function SettingsSelect({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-paper-dim">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-2 text-sm text-paper outline-none transition focus:ring-2 focus:ring-accent-sky/60"
      >
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-accent-sky"
      />
      <span className="flex flex-col">
        <strong className="text-sm font-semibold text-paper">{label}</strong>
        <small className="text-xs text-paper-faint">{hint}</small>
      </span>
    </label>
  );
}

export function AlbumCabinetGrid({ items, layout, hoverPreview, openItemDetail, ratingsByItem, memberProfilesById, coverSize, showCaptions, loading }) {
  const gridRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemCount = items.length;
  const reduceMotion = useAppStore((s) => s.reduceMotion);

  const focusTile = (index) => {
    const node = gridRef.current?.querySelectorAll('[data-tile]')[index];
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
        next = event.key === 'ArrowDown' ? Math.min(activeIndex + cols, itemCount - 1) : Math.max(activeIndex - cols, 0);
        break;
      }
      case 'Home': next = 0; break;
      case 'End': next = itemCount - 1; break;
      default: return;
    }
    event.preventDefault();
    setActiveIndex(next);
  };

  const onGridFocus = (event) => {
    const tiles = gridRef.current?.querySelectorAll('[data-tile]');
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

  const gridStyle = wallLayoutStyle(layout);
  const sizeClass = coverSize === 'compact' ? '[--cabinet-min:210px]' : coverSize === 'large' ? '[--cabinet-min:320px]' : '[--cabinet-min:260px]';

  if (loading && !items.length) {
    return (
      <div
        className={`grid grid-cols-[repeat(auto-fill,minmax(min(var(--cabinet-min,260px),100%),1fr))] gap-[clamp(18px,2vw,32px)] items-start ${sizeClass}`}
        style={gridStyle}
        role="list"
        aria-label="专辑陈列柜"
        aria-busy="true"
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-[26px] bg-white/[0.06]" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/[0.04] py-16 text-center">
        <Disc3 size={52} className="text-paper-faint" />
        <strong className="text-lg font-bold text-paper">展柜还没有封面</strong>
        <span className="text-sm text-paper-dim">用顶部搜索添加第一张专辑或单曲。</span>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className={`grid grid-cols-[repeat(auto-fill,minmax(min(var(--cabinet-min,260px),100%),1fr))] gap-[clamp(18px,2vw,32px)] items-start ${sizeClass}`}
      style={gridStyle}
      role="list"
      aria-label="专辑陈列柜"
      onKeyDown={onGridKeyDown}
      onFocus={onGridFocus}
    >
      {items.map((item, index) => (
        <CabinetListItem key={item.id} index={index} reduceMotion={reduceMotion}>
          <AlbumCabinetTile
            item={item}
            index={index}
            hoverPreview={hoverPreview}
            openItemDetail={openItemDetail}
            ratingSummary={ratingsByItem[item.id]}
            adder={item.addedById ? memberProfilesById[item.addedById] : null}
            showCaption={showCaptions}
            tileTabIndex={index === activeIndex ? 0 : -1}
          />
        </CabinetListItem>
      ))}
    </div>
  );
}

export function CabinetListItem({ index, children, reduceMotion }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const reveal = () => node.classList.add('is-in-view');
    if (reduceMotion || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      reveal();
      return undefined;
    }
    let revealed = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealed = true;
            reveal();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: '0px 0px -4% 0px' }
    );
    observer.observe(node);
    // 兜底：任何时序/重挂载导致观察者未触发时，也确保瓦片可见且可点
    const safety = window.setTimeout(() => { if (!revealed) reveal(); }, 600);
    return () => { observer.disconnect(); window.clearTimeout(safety); };
  }, [reduceMotion]);

  const stagger = Math.min(6, (index % 6) + 1);
  return (
    <div role="listitem">
      <div
        ref={ref}
        className="tile-reveal"
        data-stagger={stagger}
      >
        {children}
      </div>
    </div>
  );
}

export function AlbumCabinetTile({ item, index, hoverPreview, openItemDetail, ratingSummary, adder, showCaption, tileTabIndex = 0 }) {
  const summary = item.aiProfile?.overview || item.background || item.context || '这张封面正在等待更多朋友写下记忆。';
  const isFlip = hoverPreview === 'flip';
  const isBlur = hoverPreview === 'blur';
  const isLift = hoverPreview === 'lift';

  return (
    <>
      <button
        type="button"
        data-tile
        data-item-id={item.id}
        className="group relative aspect-square w-full cursor-pointer rounded-[26px] border-0 bg-transparent p-0 text-left transform-style-3d transition-transform duration-[420ms] ease-snap hover:-translate-y-1 hover:rotate-x-1 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
        style={{
          '--tile-index': index,
          '--poster-a': item.palette?.[0] || 'var(--cover-a)',
          '--poster-b': item.palette?.[1] || 'var(--cover-b)',
          animationDelay: `${index * 45}ms`,
        }}
        onClick={() => openItemDetail(item.id)}
        tabIndex={tileTabIndex}
        aria-label={`打开 ${item.artist || '未知艺人'} 的 ${item.title} 详情`}
      >
        {/* Front face */}
        <span
          className={`absolute inset-0 overflow-hidden rounded-[26px] backface-hidden transition-transform duration-[900ms] ease-[cubic-bezier(.13,.92,.15,1.08)] ${isFlip ? 'group-hover:rotate-y-180 group-focus-visible:rotate-y-180' : ''}`}
        >
          <AlbumArt item={item} className="h-full w-full" />
        </span>

        {/* Back face - flip */}
        {isFlip && (
          <span className="absolute inset-0 grid rotate-y-180 content-end gap-2 overflow-hidden rounded-[26px] bg-gradient-to-br from-ink-900 to-ink-800 p-[clamp(14px,1.4vw,22px)] backface-hidden transition-transform duration-[900ms] ease-[cubic-bezier(.13,.92,.15,1.08)] group-hover:rotate-y-0 group-focus-visible:rotate-y-0">
            <small className="text-[10px] font-bold uppercase tracking-wider text-accent-sky">{item.type === 'album' ? 'ALBUM' : 'SONG'} · {item.year || 'unknown'}</small>
            <strong className="text-[clamp(1rem,1.4vw,1.5rem)] font-extrabold leading-tight text-paper">{item.title}</strong>
            <em className="text-sm font-semibold not-italic text-paper-dim">{item.artist}</em>
            <p className="line-clamp-4 text-xs leading-relaxed text-paper-faint">{summary}</p>
            <span className="flex items-center justify-between text-xs font-semibold text-paper-dim">
              <b>{item.tracks?.length || (item.type === 'song' ? 1 : 0)} 首</b>
              <b>{ratingSummary?.count ? `${ratingSummary.average} / 10` : '待评分'}</b>
            </span>
            <span className="truncate text-xs font-medium text-paper-faint">{adder?.name || item.addedBy || 'Music friend'}</span>
          </span>
        )}

        {/* Back face - blur overlay */}
        {isBlur && (
          <span className="absolute inset-0 grid content-end gap-2 overflow-hidden rounded-[26px] bg-ink-950/60 p-[clamp(14px,1.4vw,22px)] opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            <small className="text-[10px] font-bold uppercase tracking-wider text-accent-sky">{item.type === 'album' ? 'ALBUM' : 'SONG'} · {item.year || 'unknown'}</small>
            <strong className="text-[clamp(1rem,1.4vw,1.5rem)] font-extrabold leading-tight text-paper">{item.title}</strong>
            <em className="text-sm font-semibold not-italic text-paper-dim">{item.artist}</em>
            <p className="line-clamp-4 text-xs leading-relaxed text-paper-faint">{summary}</p>
          </span>
        )}

        {/* Lift hint */}
        {isLift && (
          <span className="pointer-events-none absolute inset-0 rounded-[26px] opacity-0 shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
        )}
      </button>

      {showCaption && (
        <button
          type="button"
          onClick={() => openItemDetail(item.id)}
          tabIndex={-1}
          aria-label={`打开 ${item.artist || '未知艺人'} 的 ${item.title} 详情`}
          className="mt-2 grid w-full min-w-0 cursor-pointer border-0 bg-transparent px-1 text-left"
        >
          <strong className="block min-w-0 truncate text-xs font-extrabold text-paper transition group-hover:text-white">{item.title}</strong>
          <span className="block min-w-0 truncate text-[11px] font-semibold text-paper-faint">{item.artist || '未知艺人'}</span>
        </button>
      )}
    </>
  );
}

export function MemberProfileModal({ member, items, close, openItem }) {
  const profile = member.profile || {};
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const chips = [
    ['所在地', profile.location || member.location],
    ['喜欢风格', profile.favoriteGenres],
    ['喜欢歌手', profile.favoriteArtists],
    ['喜欢乐队', profile.favoriteBands],
    ['喜欢专辑', profile.favoriteAlbums],
    ['喜欢歌曲', profile.favoriteSongs],
  ]
    .map(([label, value]) => [label, Array.isArray(value) ? value.slice(0, 6).join('、') : String(value || '')])
    .filter(([, value]) => value);
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
      const focusable = [...modalRef.current.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled && element.offsetParent !== null);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <aside
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-ink-800/90 p-6 shadow-card backdrop-blur-xl animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-label={`${member.name} 的公开资料`}
        ref={modalRef}
      >
        <button
          type="button"
          ref={closeButtonRef}
          aria-label="关闭"
          onClick={close}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-paper-dim transition hover:bg-white/10 hover:text-paper"
        >
          <X size={18} />
        </button>

        <header className="mb-4 flex items-start gap-4">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl">
            <UserAvatar user={member} className="h-full w-full" />
          </div>
          <div>
            <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-sky">
              <Users size={15} /> public profile
            </p>
            <h2 className="text-2xl font-black text-paper">{member.name}</h2>
            <p className="mt-1 text-sm leading-relaxed text-paper-dim">{member.bio || profile.bio || '这个成员还没有写公开简介。'}</p>
          </div>
        </header>

        {(member.publicTags || []).length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {member.publicTags.slice(0, 12).map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-paper">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mb-5 grid grid-cols-3 gap-3">
          <Stat value={items.length} label="当前房间添加" />
          <Stat value={albums} label="专辑" />
          <Stat value={songs} label="歌曲" />
        </div>

        {chips.length > 0 && (
          <section className="mb-5 grid gap-3">
            {chips.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 rounded-xl bg-white/[0.04] p-3">
                <span className="text-xs font-semibold text-paper-faint">{label}</span>
                <strong className="text-sm font-bold text-paper">{value}</strong>
              </div>
            ))}
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Library size={18} className="text-accent-sky" />
            <h3 className="text-sm font-bold text-paper">TA 添加的音乐</h3>
          </div>
          <div className="flex flex-col gap-2">
            {items.length ? (
              items.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item.id)}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
                >
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
                    <AlbumArt item={item} size="thumb" className="h-full w-full" />
                  </div>
                  <span className="flex min-w-0 flex-col">
                    <strong className="min-w-0 truncate text-sm font-bold text-paper">{item.title}</strong>
                    <small className="min-w-0 truncate text-xs text-paper-dim">{item.artist} · {item.type === 'album' ? '专辑' : item.albumTitle || '歌曲'}</small>
                  </span>
                  <ChevronRight size={15} className="ml-auto text-paper-faint" />
                </button>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-paper-dim">TA 还没有在当前房间添加音乐。</p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-white/[0.04] py-3">
      <strong className="text-xl font-black text-paper">{value}</strong>
      <span className="text-[11px] font-semibold text-paper-faint">{label}</span>
    </div>
  );
}
