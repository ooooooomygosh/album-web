import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RoomScene from './RoomScene';
import RoomTurntable from './RoomTurntable';
import './cabin-room.css';
import './record-library.css';
import './room-immersive.css';
import './wallpaper.css';

function WallpaperRoom() {
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    let alive = true;
    window.albumWallpaper?.getSnapshot().then((value) => { if (alive) setSnapshot(value); });
    const unsubscribe = window.albumWallpaper?.onSnapshot((value) => setSnapshot(value));
    return () => { alive = false; unsubscribe?.(); };
  }, []);
  useEffect(() => { document.documentElement.dataset.desktopReduceMotion = String(Boolean(snapshot?.reduceMotion)); }, [snapshot?.reduceMotion]);
  if (!snapshot) return null;
  return <main className={`wallpaper-room cabin-${snapshot.look}`}><RoomScene look={snapshot.look} items={snapshot.items} selectedId={snapshot.selectedId} startRow={snapshot.startRow}>
    <RoomTurntable item={snapshot.record} spinning={snapshot.spinning} trackIndex={snapshot.trackIndex} style={snapshot.recordStyle} readOnly provider={snapshot.provider} statusText={snapshot.statusText} actualTrack={snapshot.actualTrack}/>
    <div className="wallpaper-caption">{snapshot.roomName} · {snapshot.statusText || '你的唱片收藏'}</div>
  </RoomScene></main>;
}
createRoot(document.getElementById('root')).render(<WallpaperRoom/>);
