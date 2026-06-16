import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Disc3, Pause, Play, X } from 'lucide-react';

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

function cssImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return 'none';
  return `url("${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}")`;
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
    <span className="corridor-cover-fallback" role="img" aria-label={`${item.title} 封面占位`}>
      <Disc3 size={84} aria-hidden="true" />
      <b>{String(item.title || 'Album').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</b>
      <small>{item.artist}</small>
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
      <span className="corridor-card-copy">
        <strong>{item.title}</strong>
        <small>{item.artist}</small>
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
  const active = galleryItems[activeSlot] || galleryItems[0];
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

  const setPreviewSlot = useCallback((slot) => {
    setDisplayIndex((current) => (current === slot ? current : slot));
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
    setPreviewSlot(slot);
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
    setPreviewSlot(slot);
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
      className="corridor-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="隐藏封面长廊"
      style={{
        '--corridor-a': colorAt(active, 0, '#7ed7c9'),
        '--corridor-b': colorAt(active, 1, '#ff7da8'),
        '--corridor-c': colorAt(active, 2, '#f3d74c'),
        '--corridor-cover-image': cssImageUrl(active.cover),
        '--corridor-count': count,
        '--corridor-step': `${step}deg`
      }}
    >
      <div
        className="corridor-cover-backdrop"
        aria-hidden="true"
        style={{
          '--backdrop-a': colorAt(active, 0, '#7ed7c9'),
          '--backdrop-cover-image': cssImageUrl(active.cover)
        }}
      />
      {/*
        Temporarily disabled after performance/taste review:
        - corridor-glow: rotating background halo
        - corridor-cover-wash: heavy blurred cover crossfade
      */}
      {/*
      <div className="corridor-glow" aria-hidden="true" />
      <div
        className="corridor-cover-wash is-current"
        aria-hidden="true"
        style={{
          '--wash-a': colorAt(active, 0, '#7ed7c9'),
          '--wash-cover-image': cssImageUrl(active.cover)
        }}
      />
      */}
      <header className="corridor-header" onPointerDown={(event) => event.stopPropagation()}>
        <div>
          <span>Hidden Installation</span>
          <h2>{roomName || 'Album Circle'} 封面长廊</h2>
        </div>
        <button
          type="button"
          className="corridor-close"
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

      <aside className="corridor-info" aria-live="polite" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
        <div className="corridor-index">
          <span>{String(activeSlot + 1).padStart(2, '0')}</span>
          <small>/ {String(count).padStart(2, '0')}</small>
        </div>
        <div className="corridor-copy">
          <span>{active.type === 'album' ? 'Album Corridor' : 'Single Corridor'} · {active.year}</span>
          <h3>{active.title}</h3>
          <p>{active.artist} · {active.tracks?.length || (active.type === 'song' ? 1 : 0)} 首</p>
          <p>{itemSummary(active)}</p>
        </div>
        <div className="corridor-action-stack">
          <div className="corridor-controls">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                shiftActiveIndex(-1);
              }}
              aria-label="上一张封面"
            >
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                shiftActiveIndex(1);
              }}
              aria-label="下一张封面"
            >
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          </div>
          <div className="corridor-autoplay">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setIsAutoPlaying((value) => !value);
              }}
              disabled={reducedMotion}
              aria-pressed={isAutoPlaying}
            >
              {isAutoPlaying ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
              {isAutoPlaying ? '暂停' : '自动'}
            </button>
            <label>
              <span>速度</span>
              <input
                type="range"
                min="0.4"
                max="1.8"
                step="0.1"
                value={autoSpeed}
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
