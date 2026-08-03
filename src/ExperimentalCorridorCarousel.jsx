import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Disc3, Pause, Play, Shuffle, X } from 'lucide-react';

const fallbackInstallations = [
  {
    id: 'corridor-fallback-1',
    title: 'What’s Going On',
    artist: 'Marvin Gaye',
    year: '1971',
    type: 'album',
    tracks: Array.from({ length: 9 }),
    context: '一张把灵魂乐推向社会叙事深处的概念专辑，适合作为长廊的精神入口。',
    palette: ['#f0c77b', '#7ed7c9', '#2d4d60']
  },
  {
    id: 'corridor-fallback-2',
    title: 'Purple Rain',
    artist: 'Prince & The Revolution',
    year: '1984',
    type: 'album',
    tracks: Array.from({ length: 9 }),
    context: '舞台、电影和流行乐能量叠在一起，像一张会发光的夜间海报。',
    palette: ['#bb8cff', '#ff7da8', '#121218']
  },
  {
    id: 'corridor-fallback-3',
    title: 'Yellow Magic Orchestra',
    artist: 'Yellow Magic Orchestra',
    year: '1978',
    type: 'album',
    tracks: Array.from({ length: 10 }),
    context: '电子声响、异国趣味和未来感并置，适合放在长廊的机械转角。',
    palette: ['#f5cf58', '#dd5439', '#16202d']
  },
  {
    id: 'corridor-fallback-4',
    title: 'Wish You Were Here',
    artist: 'Pink Floyd',
    year: '1975',
    type: 'album',
    tracks: Array.from({ length: 5 }),
    context: '封面本身就像一段可进入的空间，孤独、商业和回声被压进同一束光里。',
    palette: ['#75a8ff', '#f88d52', '#101216']
  }
];

function normalizeGalleryItems(items = []) {
  const usable = items
    .filter((item) => item && (item.title || item.artist))
    .slice(0, 18)
    .map((item, index) => ({
      ...item,
      id: item.id || `corridor-item-${index}`,
      title: item.title || item.albumTitle || 'Untitled',
      artist: item.artist || 'Unknown artist',
      year: item.year || 'unknown'
    }));

  return usable.length ? usable : fallbackInstallations;
}

function clampIndex(index, count) {
  if (!count) return 0;
  return ((index % count) + count) % count;
}

function compactVisualIndex(index, count) {
  if (!count || Math.abs(index) < count * 3) return index;
  return index - Math.trunc(index / count) * count;
}

function nearestVirtualIndex(targetIndex, currentIndex, count) {
  if (!count) return 0;
  const currentSlot = clampIndex(Math.round(currentIndex), count);
  let delta = targetIndex - currentSlot;
  if (delta > count / 2) delta -= count;
  if (delta < -count / 2) delta += count;
  return Math.round(currentIndex) + delta;
}

function itemSummary(item) {
  return item.aiProfile?.overview || item.background || item.context || '这张封面还在等待朋友补上它的第一段记忆。';
}

function colorAt(item, offset, fallback) {
  return item?.palette?.[offset] || fallback;
}

function normalizeWheelDelta(event) {
  const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (event.deltaMode === 1) return raw * 16;
  if (event.deltaMode === 2) return raw * window.innerHeight;
  return raw;
}

function isFallbackItem(item) {
  return !item?.id || item.id.startsWith('corridor-fallback-');
}

function scheduleIdleTask(callback) {
  if (typeof window === 'undefined') return 0;
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout: 900 });
  }
  return window.setTimeout(callback, 120);
}

function cancelIdleTask(taskId) {
  if (!taskId || typeof window === 'undefined') return;
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(taskId);
    return;
  }
  window.clearTimeout(taskId);
}

function preloadCoverImage(src, cache) {
  if (!src || typeof window === 'undefined') return Promise.resolve();
  if (cache.has(src)) return cache.get(src);
  const job = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (img.decode) {
        img.decode().catch(() => null).finally(resolve);
        return;
      }
      resolve();
    };
    img.onerror = resolve;
    img.src = src;
  });
  cache.set(src, job);
  return job;
}

function CorridorCover({ item, active }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [item?.cover]);

  if (item?.cover && !failed) {
    return (
      <img
        src={item.cover}
        alt={`${item.title} 封面`}
        width="480"
        height="480"
        loading={active ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={active ? 'high' : 'low'}
        draggable="false"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-white/70"
      role="img"
      aria-label={`${item.title} 封面占位`}
    >
      <Disc3 size={64} aria-hidden="true" className="opacity-45" />
      <b className="text-xl font-black tracking-[0.12em]">
        {String(item.title || 'Album').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}
      </b>
      <small className="max-w-[85%] truncate text-[11px] text-white/55">{item.artist}</small>
    </span>
  );
}

const CorridorCard = React.memo(function CorridorCard({ item, index, initialActive, initialDistance, registerCard, onCardClick, onCardKeyDown }) {
  const distanceClass = initialDistance === 1 ? ' is-neighbor' : initialDistance > 2 ? ' is-distant' : '';
  return (
    <button
      ref={(node) => registerCard(index, node)}
      type="button"
      data-corridor-index={index}
      className={`corridor-card ${initialActive ? 'is-active' : ''}${distanceClass}`}
      style={{
        '--i': index,
        '--panel-a': colorAt(item, 0, '#7ed7c9'),
        '--panel-b': colorAt(item, 1, '#ff7da8'),
        '--panel-c': colorAt(item, 2, '#f3d74c')
      }}
      aria-label={`${item.artist} 的 ${item.title}`}
      aria-current={initialActive ? 'true' : undefined}
      tabIndex={initialActive ? 0 : -1}
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
    >
      <span className="corridor-card-cover">
        <CorridorCover item={item} active={initialActive} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-1 pb-0.5 text-left">
        <strong className="truncate text-[15px] font-semibold leading-snug text-white">{item.title}</strong>
        <small className="truncate text-[11px] font-medium uppercase tracking-[0.1em] text-white/55">{item.artist}</small>
      </span>
    </button>
  );
});

export default function ExperimentalCorridorCarousel({ open, onClose, items, activeItem, roomName, reduceMotion = false, openItemDetail }) {
  const galleryItems = useMemo(() => normalizeGalleryItems(items), [items]);
  const initialIndex = Math.max(0, galleryItems.findIndex((item) => item.id === activeItem?.id));
  const count = galleryItems.length || 1;
  const step = 360 / count;
  const [displayIndex, setDisplayIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(0.8);
  const [previewSlot, setPreviewSlotState] = useState(initialIndex >= 0 ? initialIndex : 0);
  const overlayRef = useRef(null);
  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const cardRefs = useRef([]);
  const activeIndexRef = useRef(initialIndex >= 0 ? initialIndex : 0);
  const visualIndexRef = useRef(initialIndex >= 0 ? initialIndex : 0);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startRotation: 0, targetIndex: -1, raf: 0, suppressTimer: 0, tapTimer: 0 });
  const bodyOverflowRef = useRef('');
  const wheelRef = useRef({ total: 0, lastAt: 0, lastStepAt: 0, pendingSteps: 0, raf: 0 });
  const navigationRef = useRef({ pendingSteps: 0, raf: 0, keepAuto: false });
  const settleTimerRef = useRef(0);
  const movingTimerRef = useRef(0);
  const preloadIdleRef = useRef(0);
  const imageCacheRef = useRef(new Map());
  const activeSlot = clampIndex(displayIndex, count);
  const activePreviewSlot = clampIndex(previewSlot, count);
  const active = galleryItems[activePreviewSlot] || galleryItems[activeSlot] || galleryItems[0];
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const reducedMotion = reduceMotion || prefersReducedMotion;

  const setMoving = useCallback((moving) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    window.clearTimeout(movingTimerRef.current);
    if (moving) {
      overlay.classList.add('is-moving');
      return;
    }
    movingTimerRef.current = window.setTimeout(() => {
      overlay.classList.remove('is-moving');
    }, 90);
  }, []);

  const updateCardEmphasis = useCallback((slot) => {
    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const directDistance = Math.abs(index - slot);
      const distance = Math.min(directDistance, count - directDistance);
      const isCurrent = distance === 0;
      card.classList.toggle('is-active', isCurrent);
      card.classList.toggle('is-neighbor', distance === 1);
      card.classList.toggle('is-distant', distance > 2);
      card.tabIndex = isCurrent ? 0 : -1;
      if (isCurrent) {
        card.setAttribute('aria-current', 'true');
      } else {
        card.removeAttribute('aria-current');
      }
    });
  }, [count]);

  const setPreviewSlot = useCallback((slot, options = {}) => {
    if (options.commit) {
      setDisplayIndex((current) => (current === slot ? current : slot));
      setPreviewSlotState((current) => (current === slot ? current : slot));
    }
    updateCardEmphasis(slot);
  }, [updateCardEmphasis]);

  const isFlatCarousel = useCallback(() => (
    reducedMotion || window.matchMedia?.('(max-width: 900px), (pointer: coarse)').matches
  ), [reducedMotion]);

  const scrollCardIntoView = useCallback((slot, immediate = false) => {
    if (!isFlatCarousel()) return;
    const stage = stageRef.current;
    const card = cardRefs.current[slot];
    if (!stage || !card) return;
    const nextLeft = card.offsetLeft - (stage.clientWidth - card.offsetWidth) / 2;
    stage.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: immediate || reducedMotion ? 'auto' : 'smooth'
    });
  }, [isFlatCarousel, reducedMotion]);

  const preloadAround = useCallback((slot) => {
    const cache = imageCacheRef.current;
    [-3, -2, -1, 0, 1, 2, 3].forEach((offset) => {
      const item = galleryItems[clampIndex(slot + offset, count)];
      preloadCoverImage(item?.cover, cache);
    });
  }, [count, galleryItems]);

  const schedulePreloadAround = useCallback((slot) => {
    cancelIdleTask(preloadIdleRef.current);
    preloadIdleRef.current = scheduleIdleTask(() => preloadAround(slot));
  }, [preloadAround]);

  const normalizeTrackRotation = useCallback((slot) => {
    const track = trackRef.current;
    activeIndexRef.current = slot;
    visualIndexRef.current = slot;
    if (!track || isFlatCarousel()) return;
    window.cancelAnimationFrame(dragRef.current.raf);
    const previousTransition = track.style.transition;
    track.style.transition = 'none';
    track.style.setProperty('--corridor-rotate', `${-slot * step}deg`);
    dragRef.current.raf = window.requestAnimationFrame(() => {
      track.style.transition = previousTransition || '';
    });
  }, [isFlatCarousel, step]);

  const commitSettledIndex = useCallback((virtualIndex = activeIndexRef.current) => {
    window.clearTimeout(settleTimerRef.current);
    const slot = clampIndex(Math.round(virtualIndex), count);
    setPreviewSlot(slot, { commit: true });
    scrollCardIntoView(slot, true);
    normalizeTrackRotation(slot);
    setMoving(false);
    schedulePreloadAround(slot);
  }, [count, normalizeTrackRotation, schedulePreloadAround, scrollCardIntoView, setMoving, setPreviewSlot]);

  const writeRotation = useCallback((virtualIndex, immediate = false) => {
    const track = trackRef.current;
    if (!track) return;
    window.cancelAnimationFrame(dragRef.current.raf);
    const nextVisualIndex = compactVisualIndex(virtualIndex, count);
    visualIndexRef.current = nextVisualIndex;
    const rotation = -nextVisualIndex * step;
    const write = () => {
      track.style.setProperty('--corridor-rotate', `${rotation}deg`);
    };
    if (immediate) {
      write();
      return;
    }
    dragRef.current.raf = window.requestAnimationFrame(write);
  }, [count, step]);

  const applyFastIndex = useCallback((virtualIndex, options = {}) => {
    const nextVirtual = Number.isFinite(virtualIndex) ? virtualIndex : 0;
    const slot = clampIndex(Math.round(nextVirtual), count);
    const flatCarousel = isFlatCarousel();
    const nextVisual = nearestVirtualIndex(slot, visualIndexRef.current, count);
    activeIndexRef.current = nextVisual;
    if (!options.immediate && !reducedMotion) setMoving(true);
    writeRotation(nextVisual, options.immediate || reducedMotion);
    setPreviewSlot(slot, { commit: options.commitPreview === true || options.immediate || reducedMotion || flatCarousel });
    if (flatCarousel || options.immediate || reducedMotion) {
      scrollCardIntoView(slot, options.immediate || reducedMotion);
      schedulePreloadAround(slot);
    }
    window.clearTimeout(settleTimerRef.current);
    if (options.settle !== false) {
      settleTimerRef.current = window.setTimeout(() => {
        commitSettledIndex(activeIndexRef.current);
      }, options.immediate || reducedMotion ? 0 : flatCarousel ? 180 : 420);
    }
  }, [commitSettledIndex, count, isFlatCarousel, reducedMotion, schedulePreloadAround, scrollCardIntoView, setMoving, setPreviewSlot, writeRotation]);

  const shiftActiveIndex = useCallback((delta, options = {}) => {
    if (!options.keepAuto) setIsAutoPlaying(false);
    navigationRef.current.pendingSteps += delta;
    navigationRef.current.keepAuto = navigationRef.current.keepAuto || Boolean(options.keepAuto);
    if (navigationRef.current.raf) return;
    navigationRef.current.raf = window.requestAnimationFrame(() => {
      const pendingSteps = Math.max(-count, Math.min(count, navigationRef.current.pendingSteps));
      const keepAuto = navigationRef.current.keepAuto;
      navigationRef.current.pendingSteps = 0;
      navigationRef.current.keepAuto = false;
      navigationRef.current.raf = 0;
      if (!pendingSteps) return;
      applyFastIndex(Math.round(activeIndexRef.current) + pendingSteps, { ...options, keepAuto });
    });
  }, [applyFastIndex, count]);

  const restoreBodyLock = useCallback(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = bodyOverflowRef.current;
    document.body.classList.remove('corridor-modal-open');
  }, []);

  const clearMotionState = useCallback((resetUi = true) => {
    window.cancelAnimationFrame(dragRef.current.raf);
    window.clearTimeout(dragRef.current.suppressTimer);
    window.clearTimeout(dragRef.current.tapTimer);
    window.clearTimeout(settleTimerRef.current);
    window.clearTimeout(movingTimerRef.current);
    cancelIdleTask(preloadIdleRef.current);
    dragRef.current = { active: false, moved: false, startX: 0, startRotation: 0, targetIndex: -1, raf: 0, suppressTimer: 0, tapTimer: 0 };
    window.cancelAnimationFrame(wheelRef.current.raf);
    wheelRef.current = { total: 0, lastAt: 0, lastStepAt: 0, pendingSteps: 0, raf: 0 };
    window.cancelAnimationFrame(navigationRef.current.raf);
    navigationRef.current = { pendingSteps: 0, raf: 0, keepAuto: false };
    overlayRef.current?.classList.remove('is-moving');
    if (!resetUi) return;
    setIsDragging(false);
    setIsAutoPlaying(false);
  }, []);

  const openItemFromCorridor = useCallback((item) => {
    if (isFallbackItem(item)) return;
    clearMotionState();
    restoreBodyLock();
    openItemDetail?.(item.id);
    onClose();
  }, [clearMotionState, onClose, openItemDetail, restoreBodyLock]);

  const openActiveDetail = useCallback(() => {
    const item = galleryItems[clampIndex(Math.round(activeIndexRef.current), count)];
    openItemFromCorridor(item);
  }, [count, galleryItems, openItemFromCorridor]);

  // 随机漫游：从现有 AI 资料里随性跳一张，制造「策展式」发现感
  const randomRoam = useCallback(() => {
    setIsAutoPlaying(false);
    const current = clampIndex(Math.round(activeIndexRef.current), count);
    let target = current;
    if (count > 1) {
      do {
        target = Math.floor(Math.random() * count);
      } while (target === current);
    }
    applyFastIndex(nearestVirtualIndex(target, activeIndexRef.current, count));
  }, [applyFastIndex, count]);

  const registerCard = useCallback((index, node) => {
    if (node) {
      cardRefs.current[index] = node;
    } else {
      delete cardRefs.current[index];
    }
  }, []);

  const handleCardClick = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const targetIndex = Number(event.currentTarget.dataset.corridorIndex ?? -1);
    if (!Number.isFinite(targetIndex) || targetIndex < 0) return;
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      setMoving(false);
      return;
    }
    const targetVirtual = nearestVirtualIndex(targetIndex, activeIndexRef.current, count);
    if (clampIndex(Math.round(activeIndexRef.current), count) === targetIndex) {
      openActiveDetail();
      return;
    }
    setIsAutoPlaying(false);
    applyFastIndex(targetVirtual);
  }, [applyFastIndex, count, openActiveDetail, setMoving]);

  const handleCardKeyDown = useCallback((event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const targetIndex = Number(event.currentTarget.dataset.corridorIndex ?? -1);
    if (!Number.isFinite(targetIndex) || targetIndex < 0) return;
    const targetVirtual = nearestVirtualIndex(targetIndex, activeIndexRef.current, count);
    if (clampIndex(Math.round(activeIndexRef.current), count) === targetIndex) {
      openActiveDetail();
      return;
    }
    setIsAutoPlaying(false);
    applyFastIndex(targetVirtual);
  }, [applyFastIndex, count, openActiveDetail]);

  const beginDrag = useCallback((event) => {
    if (reducedMotion || event.button !== 0 || event.pointerType !== 'mouse') return;
    const targetIndex = Number(event.target.closest?.('.corridor-card')?.dataset?.corridorIndex ?? -1);
    setIsAutoPlaying(false);
    stageRef.current?.setPointerCapture?.(event.pointerId);
    dragRef.current.active = true;
    dragRef.current.moved = false;
    window.clearTimeout(dragRef.current.suppressTimer);
    window.clearTimeout(dragRef.current.tapTimer);
    dragRef.current.startX = event.clientX;
    dragRef.current.startRotation = -visualIndexRef.current * step;
    dragRef.current.targetIndex = Number.isFinite(targetIndex) ? targetIndex : -1;
    window.clearTimeout(settleTimerRef.current);
    setIsDragging(true);
    setMoving(true);
  }, [count, reducedMotion, setMoving, step]);

  const moveDrag = useCallback((event) => {
    if (!dragRef.current.active) return;
    const delta = event.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 6) dragRef.current.moved = true;
    const rotation = dragRef.current.startRotation + delta * 0.16;
    const virtualIndex = -rotation / step;
    activeIndexRef.current = virtualIndex;
    writeRotation(virtualIndex);
    setPreviewSlot(clampIndex(Math.round(virtualIndex), count));
  }, [count, setPreviewSlot, step, writeRotation]);

  const endDrag = useCallback((event) => {
    if (!dragRef.current.active) return;
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    const delta = event.clientX - dragRef.current.startX;
    const targetIndex = dragRef.current.targetIndex;
    dragRef.current.active = false;
    setIsDragging(false);
    if (Math.abs(delta) < 6 && targetIndex >= 0) {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current.moved = true;
      setMoving(false);
      dragRef.current.tapTimer = window.setTimeout(() => {
        dragRef.current.moved = false;
        if (targetIndex === clampIndex(Math.round(activeIndexRef.current), count)) {
          openActiveDetail();
          return;
        }
        setIsAutoPlaying(false);
        applyFastIndex(nearestVirtualIndex(targetIndex, activeIndexRef.current, count));
      }, 0);
      return;
    }
    const finalRotation = dragRef.current.startRotation + delta * 0.16;
    const nextVirtual = Math.round(-finalRotation / step);
    dragRef.current.moved = true;
    dragRef.current.suppressTimer = window.setTimeout(() => {
      dragRef.current.moved = false;
    }, 240);
    applyFastIndex(nextVirtual);
  }, [applyFastIndex, count, openActiveDetail, setMoving, step]);

  const handleWheel = useCallback((event) => {
    if (reducedMotion) return;
    event.preventDefault();
    setIsAutoPlaying(false);
    const direction = normalizeWheelDelta(event);
    if (Math.abs(direction) < 4) return;
    const now = window.performance.now();
    if (now - wheelRef.current.lastAt > 180) wheelRef.current.total = 0;
    wheelRef.current.lastAt = now;
    wheelRef.current.total += direction;
    if (now - wheelRef.current.lastStepAt < 74) return;
    if (Math.abs(wheelRef.current.total) < 82) return;
    const rawSteps = Math.trunc(wheelRef.current.total / 82);
    const steps = Math.max(-3, Math.min(3, rawSteps));
    wheelRef.current.total -= steps * 82;
    wheelRef.current.lastStepAt = now;
    wheelRef.current.pendingSteps += steps;
    if (wheelRef.current.raf) return;
    wheelRef.current.raf = window.requestAnimationFrame(() => {
      const pendingSteps = Math.max(-6, Math.min(6, wheelRef.current.pendingSteps));
      wheelRef.current.pendingSteps = 0;
      wheelRef.current.raf = 0;
      applyFastIndex(Math.round(activeIndexRef.current) + pendingSteps);
    });
  }, [applyFastIndex, reducedMotion]);

  useEffect(() => {
    if (!open) {
      clearMotionState();
      return undefined;
    }
    const startSlot = initialIndex >= 0 ? initialIndex : 0;
    cardRefs.current = cardRefs.current.slice(0, count);
    activeIndexRef.current = startSlot;
    visualIndexRef.current = startSlot;
    setDisplayIndex(startSlot);
    setPreviewSlotState(startSlot);
    const frame = window.requestAnimationFrame(() => {
      applyFastIndex(startSlot, { immediate: true, settle: false });
      preloadAround(startSlot);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [applyFastIndex, clearMotionState, count, initialIndex, open, preloadAround]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('corridor-modal-open');
    return restoreBodyLock;
  }, [open, restoreBodyLock]);

  useEffect(() => {
    if (!open || reducedMotion) setIsAutoPlaying(false);
  }, [open, reducedMotion]);

  useEffect(() => {
    if (!open) return undefined;
    updateCardEmphasis(clampIndex(displayIndex, count));
    scrollCardIntoView(clampIndex(displayIndex, count), true);
    return undefined;
  }, [count, displayIndex, open, scrollCardIntoView, updateCardEmphasis]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.target?.closest?.('input, textarea, select')) return;
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') shiftActiveIndex(1);
      if (event.key === 'ArrowLeft') shiftActiveIndex(-1);
      if (event.key === 'Home') {
        setIsAutoPlaying(false);
        applyFastIndex(nearestVirtualIndex(0, activeIndexRef.current, count));
      }
      if (event.key === 'End') {
        setIsAutoPlaying(false);
        applyFastIndex(nearestVirtualIndex(count - 1, activeIndexRef.current, count));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyFastIndex, count, onClose, open, shiftActiveIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const overlay = overlayRef.current;
    if (!overlay) return undefined;
    overlay.addEventListener('wheel', handleWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleWheel);
  }, [handleWheel, open]);

  useEffect(() => {
    if (!open || !isAutoPlaying || reducedMotion || isDragging) return undefined;
    const interval = Math.max(1000, 6200 - autoSpeed * 2600);
    const timer = window.setInterval(() => {
      shiftActiveIndex(1, { keepAuto: true });
    }, interval);
    return () => window.clearInterval(timer);
  }, [autoSpeed, isAutoPlaying, isDragging, open, reducedMotion, shiftActiveIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;
    let scrollTimer = 0;
    const syncScrollSelection = () => {
      const stageBox = stage.getBoundingClientRect();
      const center = stageBox.left + stageBox.width / 2;
      let nextSlot = -1;
      let nearestDistance = Infinity;
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const box = card.getBoundingClientRect();
        const distance = Math.abs(box.left + box.width / 2 - center);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nextSlot = index;
        }
      });
      if (nextSlot >= 0) {
        applyFastIndex(nearestVirtualIndex(nextSlot, activeIndexRef.current, count), { immediate: true });
      }
    };
    const onScroll = () => {
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(syncScrollSelection, 180);
    };
    stage.addEventListener('scroll', onScroll, { passive: true });
    stage.addEventListener('scrollend', syncScrollSelection, { passive: true });
    return () => {
      window.clearTimeout(scrollTimer);
      stage.removeEventListener('scroll', onScroll);
      stage.removeEventListener('scrollend', syncScrollSelection);
    };
  }, [applyFastIndex, count, open]);

  useEffect(() => () => {
    clearMotionState(false);
  }, [clearMotionState]);

  if (!open) return null;

  const overlay = (
    <div
      ref={overlayRef}
      className="corridor-overlay fixed inset-0 z-[130] isolate grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-ink-950 p-4 sm:p-5 max-[900px]:overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="隐藏封面长廊"
      style={{
        '--corridor-a': colorAt(active, 0, '#7ed7c9'),
        '--corridor-b': colorAt(active, 1, '#ff7da8'),
        '--corridor-c': colorAt(active, 2, '#f3d74c'),
        '--corridor-count': count,
        '--corridor-step': `${step}deg`
      }}
    >
      {/* 底层：封面模糊 wash + 品牌渐变 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {active.cover && (
          <div
            key={active.id}
            className="absolute inset-0 scale-125 animate-fade-in bg-cover bg-center opacity-[0.22] blur-[70px] saturate-[1.4]"
            style={{ backgroundImage: `url(${active.cover})` }}
          />
        )}
        <div
          className="absolute inset-0 opacity-[0.28] transition-[background] duration-700 ease-soft"
          style={{
            background:
              'radial-gradient(70% 50% at 22% 18%, var(--corridor-a), transparent 62%), radial-gradient(60% 50% at 82% 24%, var(--corridor-b), transparent 66%), radial-gradient(80% 60% at 50% 100%, var(--corridor-c), transparent 70%)'
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_8%,rgba(6,7,10,0.28),rgba(4,5,7,0.9)_62%,rgba(3,4,6,0.98))]" />
      </div>

      {/* 头部 */}
      <header
        className="relative z-10 flex items-start justify-between gap-4 px-1 pb-2"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="min-w-0">
          <span className="ac-eyebrow text-white/45">Hidden Installation</span>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {roomName || 'Album Circle'} 封面长廊
          </h2>
        </div>
        <button
          type="button"
          className="ac-glass grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/75 transition hover:scale-105 hover:text-white active:scale-95"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="关闭封面长廊"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {/* 3D 舞台 */}
      <section
        className={`corridor-stage ${isDragging ? 'is-dragging' : ''}`}
        ref={stageRef}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-roledescription="carousel"
        aria-label="3D 专辑封面长廊"
      >
        <div className="corridor-depth-lines" aria-hidden="true" />
        <div className="corridor-track" ref={trackRef}>
          {galleryItems.map((item, index) => (
            <CorridorCard
              key={item.id}
              item={item}
              index={index}
              initialActive={index === activeSlot}
              initialDistance={Math.min(Math.abs(index - activeSlot), count - Math.abs(index - activeSlot))}
              registerCard={registerCard}
              onCardClick={handleCardClick}
              onCardKeyDown={handleCardKeyDown}
            />
          ))}
        </div>
      </section>

      {/* 信息面板 */}
      <aside
        className="ac-glass pointer-events-auto z-20 mx-auto grid w-full max-w-[1100px] gap-4 rounded-lg p-4 shadow-card max-[900px]:static max-[900px]:mt-2 min-[901px]:absolute min-[901px]:inset-x-4 min-[901px]:bottom-4 min-[901px]:w-auto min-[901px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[901px]:items-center sm:p-5"
        aria-live="polite"
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        {/* 序号 */}
        <div className="flex items-baseline gap-1 tabular-nums">
          <span className="text-3xl font-black leading-none tracking-tight text-white sm:text-4xl">
            {String(activeSlot + 1).padStart(2, '0')}
          </span>
          <small className="text-xs font-medium text-white/35">/ {String(count).padStart(2, '0')}</small>
        </div>

        {/* 文案 */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
            {active.type === 'album' ? 'Album Corridor' : 'Single Corridor'} · {active.year}
          </span>
          <h3 className="truncate text-lg font-semibold leading-tight text-white sm:text-xl">{active.title}</h3>
          <p className="truncate text-xs text-white/55">
            {active.artist} · {active.tracks?.length || (active.type === 'song' ? 1 : 0)} 首
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-purple">✦ AI 导览</p>
          <p className="line-clamp-2 text-xs leading-relaxed text-white/50">{itemSummary(active)}</p>
        </div>

        {/* 控件 */}
        <div className="flex flex-wrap items-center gap-2 max-[900px]:col-span-full">
          <button
            type="button"
            className="ac-pill group gap-2 border-white/15 py-2 text-xs text-white/85 hover:border-accent-purple/50 hover:text-white"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              randomRoam();
            }}
            aria-label="随机漫游"
          >
            <Shuffle size={14} aria-hidden="true" /> 随机漫游
            <span className="rounded-full bg-accent-purple/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent-purple">
              AI 策展
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.12] bg-white/[0.06] text-white/80 transition hover:bg-white/[0.14] hover:text-white active:scale-95"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                shiftActiveIndex(-1);
              }}
              aria-label="上一张封面"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.12] bg-white/[0.06] text-white/80 transition hover:bg-white/[0.14] hover:text-white active:scale-95"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                shiftActiveIndex(1);
              }}
              aria-label="下一张封面"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 max-[560px]:w-full">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setIsAutoPlaying((value) => !value);
              }}
              disabled={reducedMotion}
              aria-pressed={isAutoPlaying}
            >
              {isAutoPlaying ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              {isAutoPlaying ? '暂停' : '自动'}
            </button>
            <label className="flex flex-1 items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">
              <span className="shrink-0">速度</span>
              <input
                type="range"
                min="0.4"
                max="1.8"
                step="0.1"
                value={autoSpeed}
                className="ac-range w-20 max-[560px]:w-full"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setAutoSpeed(Number(event.target.value))}
                aria-label="自动旋转速度"
                disabled={reducedMotion}
              />
            </label>
          </div>
        </div>
      </aside>
    </div>
  );

  return createPortal(overlay, document.body);
}
