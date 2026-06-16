import React, { useEffect, useMemo, useRef, useState } from 'react';
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

function nearestVirtualIndex(targetIndex, currentIndex, count) {
  if (!count) return 0;
  const currentSlot = clampIndex(currentIndex, count);
  let delta = targetIndex - currentSlot;
  if (delta > count / 2) delta -= count;
  if (delta < -count / 2) delta += count;
  return currentIndex + delta;
}

function circularDistance(left, right, count) {
  const distance = Math.abs(left - right);
  return Math.min(distance, count - distance);
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

export default function ExperimentalCorridorCarousel({ open, onClose, items, activeItem, roomName, reduceMotion = false, openItemDetail }) {
  const galleryItems = useMemo(() => normalizeGalleryItems(items), [items]);
  const initialIndex = Math.max(0, galleryItems.findIndex((item) => item.id === activeItem?.id));
  const [activeIndex, setActiveIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [backdropIndex, setBackdropIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [previousBackdropIndex, setPreviousBackdropIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(0.8);
  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startRotation: 0, targetIndex: -1, raf: 0, suppressClick: false });
  const openTimerRef = useRef(0);
  const backdropIndexRef = useRef(initialIndex >= 0 ? initialIndex : 0);
  const bodyOverflowRef = useRef('');
  const wheelRef = useRef({ total: 0, lastAt: 0, lastStepAt: 0 });
  const stepLockRef = useRef(0);
  const count = galleryItems.length || 1;
  const step = 360 / count;
  const active = galleryItems[clampIndex(activeIndex, count)] || galleryItems[0];
  const backdropItem = galleryItems[clampIndex(backdropIndex, count)] || active;
  const previousBackdropItem = galleryItems[clampIndex(previousBackdropIndex, count)] || backdropItem;
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const reducedMotion = reduceMotion || prefersReducedMotion;

  useEffect(() => {
    if (!open) return;
    const next = initialIndex >= 0 ? initialIndex : 0;
    setActiveIndex(next);
    setBackdropIndex(next);
    setPreviousBackdropIndex(next);
    backdropIndexRef.current = next;
  }, [open, initialIndex]);

  useEffect(() => {
    backdropIndexRef.current = backdropIndex;
  }, [backdropIndex]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('corridor-modal-open');
    return () => {
      document.body.style.overflow = bodyOverflowRef.current;
      document.body.classList.remove('corridor-modal-open');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const nextSlot = clampIndex(activeIndex, count);
    if (reducedMotion) {
      setPreviousBackdropIndex(nextSlot);
      setBackdropIndex(nextSlot);
      return undefined;
    }
    if (isDragging) return undefined;

    const track = trackRef.current;
    let settled = false;
    const applyBackdrop = () => {
      if (settled) return;
      settled = true;
      if (nextSlot !== clampIndex(backdropIndexRef.current, count)) {
        setPreviousBackdropIndex(backdropIndexRef.current);
        setBackdropIndex(nextSlot);
      }
    };
    const onTransitionEnd = (event) => {
      if (event.propertyName === 'transform') applyBackdrop();
    };

    track?.addEventListener('transitionend', onTransitionEnd);
    const timer = window.setTimeout(applyBackdrop, 860);
    return () => {
      settled = true;
      window.clearTimeout(timer);
      track?.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [activeIndex, count, isDragging, open, reducedMotion]);

  useEffect(() => () => {
    window.clearTimeout(openTimerRef.current);
    window.cancelAnimationFrame(dragRef.current.raf);
  }, []);

  useEffect(() => {
    if (!open || reducedMotion) setIsAutoPlaying(false);
  }, [open, reducedMotion]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setActiveIndex((value) => value + 1);
      if (event.key === 'ArrowLeft') setActiveIndex((value) => value - 1);
      if (event.key === 'Home') setActiveIndex(0);
      if (event.key === 'End') setActiveIndex(count - 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [count, onClose, open]);

  useEffect(() => {
    if (!open || reducedMotion) return undefined;
    const track = trackRef.current;
    if (!track) return undefined;
    const targetRotation = -activeIndex * step;
    track.style.setProperty('--corridor-rotate', `${targetRotation}deg`);
    return undefined;
  }, [activeIndex, open, reducedMotion, step]);

  useEffect(() => {
    if (!open || !isAutoPlaying || reducedMotion || isDragging) return undefined;
    const interval = Math.max(1200, 6200 - autoSpeed * 2600);
    const timer = window.setInterval(() => {
      setActiveIndex((value) => value + 1);
    }, interval);
    return () => window.clearInterval(timer);
  }, [autoSpeed, isAutoPlaying, isDragging, open, reducedMotion]);

  if (!open) return null;

  const shiftActiveIndex = (delta) => {
    const now = window.performance.now();
    if (now - stepLockRef.current < 240) return;
    stepLockRef.current = now;
    setActiveIndex((value) => value + delta);
  };

  const openItemFromCorridor = (item) => {
    if (!item?.id || item.id.startsWith('corridor-fallback-')) return;
    window.clearTimeout(openTimerRef.current);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = bodyOverflowRef.current;
      document.body.classList.remove('corridor-modal-open');
    }
    onClose();
    openItemDetail?.(item.id);
  };

  const openActiveDetail = () => {
    openItemFromCorridor(active);
  };

  const scheduleOpenItemFromCorridor = (item) => {
    if (!item?.id || item.id.startsWith('corridor-fallback-')) return;
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = window.setTimeout(() => {
      dragRef.current.suppressClick = false;
      openItemFromCorridor(item);
    }, 90);
  };

  const setIndexFromRotation = (rotation) => {
    const next = Math.round(-rotation / step);
    setActiveIndex(next);
  };

  const writeRotation = (rotation) => {
    const track = trackRef.current;
    if (!track) return;
    window.cancelAnimationFrame(dragRef.current.raf);
    dragRef.current.raf = window.requestAnimationFrame(() => {
      track.style.setProperty('--corridor-rotate', `${rotation}deg`);
    });
  };

  const beginDrag = (event) => {
    if (reducedMotion || event.button !== 0 || event.pointerType !== 'mouse') return;
    const targetIndex = Number(event.target.closest?.('.corridor-card')?.dataset?.corridorIndex ?? -1);
    stageRef.current?.setPointerCapture?.(event.pointerId);
    dragRef.current.active = true;
    dragRef.current.startX = event.clientX;
    dragRef.current.startRotation = -activeIndex * step;
    dragRef.current.targetIndex = Number.isFinite(targetIndex) ? targetIndex : -1;
    dragRef.current.suppressClick = false;
    setIsAutoPlaying(false);
    setIsDragging(true);
  };

  const moveDrag = (event) => {
    if (!dragRef.current.active) return;
    const delta = event.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 6) dragRef.current.suppressClick = true;
    writeRotation(dragRef.current.startRotation + delta * 0.16);
  };

  const endDrag = (event) => {
    if (!dragRef.current.active) return;
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    const delta = event.clientX - dragRef.current.startX;
    const targetIndex = dragRef.current.targetIndex;
    dragRef.current.active = false;
    setIsDragging(false);
    if (Math.abs(delta) < 6 && targetIndex >= 0) {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current.suppressClick = true;
      if (targetIndex === activeSlot) {
        scheduleOpenItemFromCorridor(galleryItems[clampIndex(targetIndex, count)]);
      } else {
        setActiveIndex((value) => nearestVirtualIndex(targetIndex, value, count));
      }
      return;
    }
    setIndexFromRotation(dragRef.current.startRotation + delta * 0.16);
  };

  const handleCardClick = (event, index, isActive) => {
    event.preventDefault();
    if (dragRef.current.suppressClick) {
      dragRef.current.suppressClick = false;
      return;
    }
    if (isActive) {
      openActiveDetail();
    } else {
      setIsAutoPlaying(false);
      setActiveIndex((value) => nearestVirtualIndex(index, value, count));
    }
  };

  const handleWheel = (event) => {
    if (reducedMotion) return;
    event.preventDefault();
    const direction = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(direction) < 4) return;
    const now = window.performance.now();
    if (now - wheelRef.current.lastStepAt < 460) return;
    if (now - wheelRef.current.lastAt > 360) wheelRef.current.total = 0;
    wheelRef.current.lastAt = now;
    wheelRef.current.total += direction;
    if (Math.abs(wheelRef.current.total) < 220) return;
    const stepDirection = Math.sign(wheelRef.current.total);
    wheelRef.current.total = 0;
    wheelRef.current.lastStepAt = now;
    setIsAutoPlaying(false);
    shiftActiveIndex(stepDirection);
  };

  const activeSlot = clampIndex(activeIndex, count);

  const overlay = (
    <div
      className="corridor-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="隐藏封面长廊"
      style={{
        '--corridor-a': colorAt(backdropItem, 0, '#7ed7c9'),
        '--corridor-b': colorAt(backdropItem, 1, '#ff7da8'),
        '--corridor-c': colorAt(backdropItem, 2, '#f3d74c'),
        '--corridor-cover-image': cssImageUrl(backdropItem.cover),
        '--corridor-count': count,
        '--corridor-step': `${step}deg`
      }}
      onWheel={handleWheel}
    >
      <div className="corridor-glow" aria-hidden="true" />
      <div
        className="corridor-cover-wash is-previous"
        aria-hidden="true"
        style={{
          '--wash-a': colorAt(previousBackdropItem, 0, '#7ed7c9'),
          '--wash-cover-image': cssImageUrl(previousBackdropItem.cover)
        }}
      />
      <div
        key={`${backdropItem.id || 'backdrop'}-${backdropIndex}`}
        className="corridor-cover-wash is-current"
        aria-hidden="true"
        style={{
          '--wash-a': colorAt(backdropItem, 0, '#7ed7c9'),
          '--wash-cover-image': cssImageUrl(backdropItem.cover)
        }}
      />
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
          {galleryItems.map((item, index) => {
            const isActive = index === activeSlot;
            const distance = circularDistance(index, activeSlot, count);
            return (
              <button
                key={item.id}
                type="button"
                data-corridor-index={index}
                className={`corridor-card ${isActive ? 'is-active' : ''}`}
                style={{
                  '--i': index,
                  '--panel-a': colorAt(item, 0, '#7ed7c9'),
                  '--panel-b': colorAt(item, 1, '#ff7da8'),
                  '--panel-c': colorAt(item, 2, '#f3d74c'),
                  '--active-lift': isActive ? '115px' : '0px',
                  '--active-scale': isActive ? 1.13 : 1,
                  '--side-opacity': distance === 0 ? 1 : distance === 1 ? 0.58 : 0.34
                }}
                aria-label={`${item.artist} 的 ${item.title}`}
                aria-current={isActive ? 'true' : undefined}
                tabIndex={0}
                onClick={(event) => handleCardClick(event, index, isActive)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  if (isActive) {
                    openActiveDetail();
                  } else {
                    setActiveIndex((value) => nearestVirtualIndex(index, value, count));
                  }
                }}
              >
                <span className="corridor-card-cover">
                  <CorridorCover item={item} active={isActive} />
                </span>
                <span className="corridor-card-copy">
                  <strong>{item.title}</strong>
                  <small>{item.artist}</small>
                </span>
              </button>
            );
          })}
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
