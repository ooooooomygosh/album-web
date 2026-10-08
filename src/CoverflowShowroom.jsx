import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Disc3 } from './icons';
import DiscogsLink from './DiscogsLink';
import { ShowroomArtwork } from './CabinRoom';
import { RecordTools, VinylDisc } from './RecordLibrary';
import CorridorBackground from './CorridorBackground';

export default function CoverflowShowroom({ items, openItemDetail, setMode, loading, reduceMotion = false, purchaseSlot }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id || '');
  const index = Math.max(0, items.findIndex((item) => item.id === selectedId));
  const selected = items[index];
  const sectionRef = useRef(null), deckRef = useRef(null), imageCache = useRef(new Map());
  const drag = useRef({ active: false, x: 0, distance: 0, moved: false, suppressClick: false });
  const wheel = useRef({ total: 0, at: 0 });
  const shift = useCallback((amount) => setSelectedId((id) => {
    const current = Math.max(0, items.findIndex((item) => item.id === id));
    return items[Math.max(0, Math.min(items.length - 1, current + amount))]?.id || '';
  }), [items]);
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    const onWheel = (event) => {
      if (items.length < 2) return;
      const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
      if (Math.abs(delta) < 1) return;
      event.preventDefault();
      const now = performance.now(); if (now - wheel.current.at > 250) wheel.current.total = 0;
      wheel.current.total += delta;
      if (Math.abs(wheel.current.total) >= 60 && now - wheel.current.at >= 100) { shift(Math.sign(wheel.current.total)); wheel.current.total = 0; wheel.current.at = now; }
    };
    deck.addEventListener('wheel', onWheel, { passive: false });
    return () => deck.removeEventListener('wheel', onWheel);
  }, [items.length, shift]);
  useEffect(() => { sectionRef.current?.focus({ preventScroll: true }); }, []);
  const endDrag = (event, cancelled = false) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    deckRef.current?.releasePointerCapture?.(event.pointerId);
    deckRef.current?.style.setProperty('--flow-drag', '0px');
    if (!cancelled && drag.current.moved) { shift(-Math.sign(drag.current.distance) * Math.min(3, Math.max(1, Math.round(Math.abs(drag.current.distance) / 120)))); drag.current.suppressClick = true; }
    window.setTimeout(() => { drag.current.suppressClick = false; }, 0);
  };
  if (!selected) return <div className="coverflow-empty"><Disc3 size={48}/><h2>{loading ? '正在加载专辑…' : '让第一张封面，成为主角。'}</h2>{!loading && <button onClick={() => setMode('add')}>添加专辑</button>}</div>;
  return <section ref={sectionRef} tabIndex={0} className={`coverflow-showroom ${reduceMotion ? 'is-reduced' : ''}`} aria-label="Coverflow 专辑浏览" aria-roledescription="封面流" onKeyDown={(event) => {
    if (event.target.closest('input,select,textarea')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); shift(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); shift(1); }
    if (event.key === 'Home') { event.preventDefault(); setSelectedId(items[0].id); }
    if (event.key === 'End') { event.preventDefault(); setSelectedId(items.at(-1).id); }
    if (event.key === 'Enter' && event.target === event.currentTarget) openItemDetail(selected.id);
  }}>
    <CorridorBackground item={selected} reducedMotion={reduceMotion} imageCache={imageCache.current}/>
    <div className="flow-deck" ref={deckRef} aria-label="拖动或滚动切换专辑" onPointerDown={(event) => {
      if (event.button !== 0) return; sectionRef.current?.focus({ preventScroll: true });
      drag.current = { active: true, x: event.clientX, distance: 0, moved: false, suppressClick: false };
    }} onPointerMove={(event) => {
      if (!drag.current.active) return;
      const distance = event.clientX - drag.current.x;
      if (Math.abs(distance) > 8) { drag.current.moved = true; deckRef.current?.setPointerCapture?.(event.pointerId); }
      drag.current.distance = distance; deckRef.current?.style.setProperty('--flow-drag', `${Math.max(-150, Math.min(150, distance * 0.35))}px`);
    }} onPointerUp={(event) => endDrag(event)} onPointerCancel={(event) => endDrag(event, true)}>
      <div className="flow-horizon" aria-hidden="true"/>
      {items.map((item, i) => ({ item, i, distance: i - index })).filter(({ distance }) => Math.abs(distance) <= 5).map(({ item, i, distance }) => {
        const side = Math.sign(distance), depth = Math.abs(distance);
        return <button key={item.id} className={`flow-card ${distance === 0 ? 'is-current' : ''}`} tabIndex={distance === 0 ? 0 : -1} aria-current={distance === 0 ? 'true' : undefined} aria-label={`浏览 ${item.artist} 的 ${item.title}`} data-flow-index={i} style={{ '--flow-x': side * (depth ? 0.78 + (depth - 1) * 0.48 : 0), '--flow-z': depth ? -85 - depth * 45 : 90, '--flow-angle': `${side * -58}deg`, '--flow-opacity': depth ? Math.max(0.25, 0.84 - depth * 0.13) : 1, zIndex: 100 - depth }} onClick={() => {
          if (drag.current.suppressClick) return;
          if (distance === 0) openItemDetail(item.id); else setSelectedId(item.id);
        }}>
          {item.type === 'album' && <VinylDisc item={item}/>}<ShowroomArtwork item={item}/><span className="flow-reflection" aria-hidden="true"><ShowroomArtwork item={item}/></span>
        </button>;
      })}
      <div className="flow-deck-hint">← → 切换 · 拖动浏览 · Enter 查看</div>
    </div>
    <div className="flow-bottom">
      <div className="flow-selection" aria-live="polite"><span className="flow-index">{String(index + 1).padStart(2, '0')} <small>/ {String(items.length).padStart(2, '0')}</small></span><div><small>COVERFLOW COLLECTION</small><h2>{selected.title}</h2><p>{selected.artist} · {selected.year || '年份待补充'} · {selected.tracks?.length || 0} 首曲目</p>{purchaseSlot?.(selected)}<DiscogsLink item={selected} compact/></div></div>
      <div className="flow-actions"><RecordTools item={selected}/><div className="flow-navigation"><button aria-label="上一张专辑" disabled={index === 0} onClick={() => shift(-1)}><ChevronLeft/></button><button className="flow-open-album" onClick={() => openItemDetail(selected.id)}>查看专辑 <ArrowUpRight size={17}/></button><button aria-label="下一张专辑" disabled={index >= items.length - 1} onClick={() => shift(1)}><ChevronRight/></button></div><input className="flow-scrubber" type="range" min="0" max={Math.max(0, items.length - 1)} value={index} onChange={(event) => setSelectedId(items[Number(event.target.value)].id)} aria-label="专辑位置"/><select aria-label="跳转到专辑" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.artist} · {item.title}</option>)}</select></div>
    </div>
  </section>;
}
