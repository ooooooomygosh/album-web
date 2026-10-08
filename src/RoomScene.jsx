import React, { useLayoutEffect, useRef, useState } from 'react';
import { Disc3 } from './icons';
import { roomGeometry, SHELF } from './room-model.mjs';
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
  const { columns, rows } = SHELF[look] || SHELF.warm;
  return <div ref={viewport} className="room-scene cabin-scene" aria-label={look === 'pixel' ? '像素温馨小屋' : '写实温馨小屋'} data-room-look={look} data-weather={normalizeWeather(weather)} data-time-of-day={timeOfDay(hour)}>
    <div className="cabin-scene-canvas" style={geometry}>
      <img className="cabin-scene-art" src={`/room-scenes/${look}-cabin.png`} alt={look === 'pixel' ? '像素木屋 雪窗与壁炉' : '温馨木屋 雪窗与壁炉'} width="1448" height="1086" draggable="false"/>
      <div className="room-rack cabin-rack"><div className="room-rack-grid" role="list" aria-label="木质唱片架" data-start-row={startRow}>
        {Array.from({ length: 12 }, (_, index) => {
          const item = items[index], [x, width] = columns[index % 4], [y, height] = rows[Math.floor(index / 4)];
          return <div className={`room-record-slot ${item ? '' : 'room-record-empty'}`} style={{ left: `${x / 1448 * 100}%`, top: `${y / 1086 * 100}%`, width: `${width / 1448 * 100}%`, height: `${height / 1086 * 100}%` }} role={item ? 'listitem' : undefined} key={index} aria-hidden={item ? undefined : 'true'}>
            {item ? <button type="button" key={item.id} className={`room-record ${selectedId === item.id ? 'is-selected' : ''}`} aria-label={`选择 ${item.artist} 的 ${item.title}`} aria-pressed={selectedId === item.id} title={`${item.title} · ${item.artist}；双击或拖到唱机放盘`} draggable={Boolean(load)} onDragStart={(event) => { event.dataTransfer.setData(ROOM_DRAG_TYPE, item.id); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => select?.(item.id)} onDoubleClick={() => load?.(item)}><ShowroomArtwork item={item} pixel={look === 'pixel'}/></button> : <span className="cabin-empty-slot"><Disc3/><span>待收藏</span></span>}
          </div>;
        })}
      </div></div>
      <div className="cabin-fire-glow" aria-hidden="true"/>
      <div className="cabin-snow" aria-hidden="true"/>
      <div className="cabin-weather" aria-hidden="true"/>
      <div className="cabin-daylight" aria-hidden="true"/>
    </div>
    {cat}
    {children}
  </div>;
}
