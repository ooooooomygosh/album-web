import React, { useLayoutEffect, useRef, useState } from 'react';
import { Disc3 } from './icons';
import { roomGeometry, SHELF } from './room-model.mjs';
import { ShowroomArtwork } from './RoomArtwork';

export const ROOM_DRAG_TYPE = 'application/x-album-circle-record';
export default function RoomScene({ look = 'warm', items = [], selectedId, select, load, startRow = 0, children }) {
  const viewport = useRef(null), [geometry, setGeometry] = useState({});
  useLayoutEffect(() => {
    const update = () => { const rect = viewport.current.getBoundingClientRect(); setGeometry(roomGeometry(rect.width, rect.height)); };
    const observer = new ResizeObserver(update); observer.observe(viewport.current); update();
    return () => observer.disconnect();
  }, []);
  const { columns, rows } = SHELF[look] || SHELF.warm;
  return <div ref={viewport} className="room-scene cabin-scene" aria-label={look === 'pixel' ? '像素温馨小屋' : '写实温馨小屋'} data-room-look={look}>
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
    </div>
    {children}
  </div>;
}
