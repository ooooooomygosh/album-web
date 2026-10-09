import { getRoomScene } from './scene-catalog.mjs';
import React, { useLayoutEffect, useRef, useState } from 'react';
import CabinAtmosphere from './CabinAtmosphere';
import { VinylDisc } from './RecordLibrary';
import { Disc3 } from './icons';
import { roomGeometry } from './room-model.mjs';
import { ShowroomArtwork } from './RoomArtwork';
import { normalizeWeather, timeOfDay } from './room-ambience.mjs';

export const ROOM_DRAG_TYPE = 'application/x-album-circle-record';
export default function RoomScene({ look = 'warm', items = [], selectedId, select, load, startRow = 0, weather = 'snow', hour = new Date().getHours(), cat = null, children }) {
  const viewport = useRef(null), [geometry, setGeometry] = useState({});
  useLayoutEffect(() => {
    const room = viewport.current.closest('.cabin-room');
    const toolbar = room?.querySelector('.cabin-toolbar'), footer = room?.querySelector('.room-now-playing');
    const header = room ? document.querySelector('.app-titlebar') : null;
    const update = () => {
      const rect = viewport.current.getBoundingClientRect();
      // Hidden bars (Zen mode) report empty boxes and must not shrink the room.
      const box = (element) => element && element.getClientRects().length ? element.getBoundingClientRect() : null;
      const zen = document.documentElement.classList.contains('room-zen'), bar = box(toolbar), top = box(header), foot = box(footer);
      const safeArea = room && !zen ? { top: Math.max(bar?.bottom || 0, top?.bottom || 0) - rect.top + 12, bottom: foot ? rect.bottom - foot.top + 12 : 12 } : undefined;
      setGeometry(roomGeometry(rect.width, rect.height, safeArea));
    };
    let frame;
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); });
    [viewport.current, toolbar, footer, header].filter(Boolean).forEach((element) => observer.observe(element)); update();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  const scene = getRoomScene(look);
  const { columns, rows } = scene.geometry;
  return <div ref={viewport} className="room-scene cabin-scene" style={{ background: scene.style.background }} aria-label={scene.label} data-room-look={look} data-weather={normalizeWeather(weather)} data-time-of-day={timeOfDay(hour)}>
    <div className="cabin-scene-canvas" style={geometry}>
      <img key={scene.id} className="cabin-scene-art" src={scene.art} alt={scene.alt} width="1448" height="1086" draggable="false"/>
      <div className="room-rack cabin-rack"><div className="room-rack-grid" role="list" aria-label="木质唱片架" data-start-row={startRow}>
        {Array.from({ length: 12 }, (_, index) => {
          const item = items[index], [x, width] = columns[index % 4], [y, height] = rows[Math.floor(index / 4)];
          return <div className={`room-record-slot ${item ? '' : 'room-record-empty'}`} style={{ left: `${x / 1448 * 100}%`, top: `${y / 1086 * 100}%`, width: `${width / 1448 * 100}%`, height: `${height / 1086 * 100}%` }} role={item ? 'listitem' : undefined} key={index} aria-hidden={item ? undefined : 'true'}>
            {item ? <button type="button" key={item.id} className={`room-record ${selectedId === item.id ? 'is-selected' : ''}`} aria-label={`选择 ${item.artist} 的 ${item.title}`} aria-pressed={selectedId === item.id} title={`${item.title} · ${item.artist}；双击或拖到唱机放盘`} draggable={Boolean(load)} onDragStart={(event) => { event.dataTransfer.setData(ROOM_DRAG_TYPE, item.id); event.dataTransfer.effectAllowed = 'copy'; const ghost = event.currentTarget.querySelector('.room-drag-record'); if (ghost) event.dataTransfer.setDragImage(ghost, 48, 48); }} onClick={() => select?.(item.id)} onDoubleClick={() => load?.(item)}><ShowroomArtwork item={item} pixel={scene.pixel}/>{load && <span className="room-drag-record" aria-hidden="true"><VinylDisc item={item}/><ShowroomArtwork item={item} className="room-drag-label"/></span>}</button> : <span className="cabin-empty-slot"><Disc3/><span>待收藏</span></span>}
          </div>;
        })}
      </div></div>
      {['warm', 'pixel'].includes(scene.id) ? <CabinAtmosphere look={scene.id} weather={normalizeWeather(weather)}/> : <div className="cabin-snow" aria-hidden="true"/>}
      <div className="cabin-weather" aria-hidden="true"/>
      <div className="cabin-daylight" aria-hidden="true"/>
    </div>
    {cat}
    {children}
  </div>;
}
