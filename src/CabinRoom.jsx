import React, { useEffect, useRef, useState } from 'react';
import { Up, Down, Disc3, ArrowUpRight, Grid3X3, Settings, External, Music2, Eye, EyeSlash, Heart } from './icons';
import DiscogsLink from './DiscogsLink';
import { RecordTools, useRecordLibrary } from './RecordLibrary';
import { albumKey, normalizeStyle } from './record-library.mjs';
import { desktopCommand, useDesktopAppearance } from './desktop-client';
import RoomScene from './RoomScene';
import RoomTurntable from './RoomTurntable';
import { shelfWindow } from './room-model.mjs';
import MusicSettings from './MusicSettings';
import useRoomPlayback from './useRoomPlayback';
import useSystemNowPlaying from './useSystemNowPlaying';
import FocusDock, { FocusBadge } from './focus/FocusDock';
import { useFocus } from './focus/useFocus';
import { focusSnapshot } from './focus/focus-model.mjs';
import { useSoundscape } from './audio/useSoundscape';
import RoomCat from './pet/RoomCat';
import './companion-room.css';
export { ShowroomArtwork } from './RoomArtwork';

const snapshotItem = (item) => item ? ({ id: item.id, title: item.title, artist: item.artist, cover: item.cover, type: item.type, tracks: item.tracks, externalIds: item.externalIds, collectionId: item.collectionId }) : null;
export default function CabinRoom({ items, roomName, openItemDetail, setMode, loading, purchaseSlot }) {
  const library = useRecordLibrary(), look = library?.data.rooms[library.roomId]?.look || 'pixel';
  const appearance = useDesktopAppearance();
  const [row, setRow] = useState(0), [selectedId, setSelectedId] = useState(items[0]?.id || '');
  const [record, setRecord] = useState(null), [spinning, setSpinning] = useState(false), [trackIndex, setTrackIndex] = useState(0);
  const [provider, setProvider] = useState(() => { try { const value = localStorage.getItem('album-circle-room-player-v1'); return appearance.client && ['qq', 'netease', 'ma', 'local', 'system'].includes(value) ? value : 'visual'; } catch { return 'visual'; } });
  const [musicSettings, setMusicSettings] = useState(false);
  const playback = useRoomPlayback(record, trackIndex, provider, () => { if (trackIndex < (record?.tracks?.length || 0) - 1) setTrackIndex(trackIndex + 1); });
  const system = useSystemNowPlaying(provider === 'system');
  const deckItem = provider === 'system' ? system.item : record;
  const effectiveSpin = provider === 'visual' ? spinning : provider === 'system' ? Boolean(system.active && system.playing) : playback.playing;
  const [filtersOpen, setFiltersOpen] = useState(false), [wallpaper, setWallpaper] = useState(() => window.albumRoomWallpaperState || {});
  const stage = useRef(null), wheel = useRef({ amount: 0, time: 0 }), snapshot = useRef(null);
  const focus = useFocus(), sound = useSoundscape();
  const [dock, setDock] = useState(() => { try { return JSON.parse(localStorage.getItem('album-circle-focus-dock-v1')) || { open: false, tab: 'timer' }; } catch { return { open: false, tab: 'timer' }; } });
  const saveDock = (change) => setDock((old) => { const next = { ...old, ...change }; try { localStorage.setItem('album-circle-focus-dock-v1', JSON.stringify(next)); } catch {} return next; });
  const [zen, setZen] = useState(false), [pet, setPet] = useState(() => window.albumPetState || {});
  const signature = items.map((item) => item.id).join('|'), view = shelfWindow(items, row);
  const selected = view.items.find((item) => item.id === selectedId) || view.items[0];
  const load = (item) => { if (record?.id === item.id && trackIndex === 0 && provider !== 'visual' && !playback.playing) playback.toggle(); setRecord(item); setSelectedId(item.id); setTrackIndex(0); setSpinning(true); };
  const changeRow = (next) => { const value = shelfWindow(items, next); setRow(value.startRow); setSelectedId(value.items[0]?.id || ''); };
  useEffect(() => { setRow(0); setSelectedId(items[0]?.id || ''); }, [signature]);
  useEffect(() => { setRecord(null); setSpinning(false); setTrackIndex(0); }, [library?.roomId]);
  useEffect(() => {
    document.documentElement.classList.add('room-immersive-active');
    const header = document.querySelector('.app .topbar');
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--room-header-bottom', `${header.getBoundingClientRect().bottom + 10}px`));
    if (header) observer.observe(header);
    return () => { observer.disconnect(); document.documentElement.classList.remove('room-immersive-active', 'room-filters-open'); document.documentElement.style.removeProperty('--room-header-bottom'); };
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('room-filters-open', filtersOpen); }, [filtersOpen]);
  useEffect(() => { document.documentElement.classList.toggle('room-zen', zen); document.documentElement.classList.toggle('room-focus-open', dock.open); }, [zen, dock.open]);
  useEffect(() => () => document.documentElement.classList.remove('room-zen', 'room-focus-open'), []);
  useEffect(() => {
    const key = (event) => {
      if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]') || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]')) return;
      if (event.key === 'z' || event.key === 'Z') { event.preventDefault(); setZen((value) => !value); }
      else if (event.key === 'Escape' && zen) setZen(false);
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [zen]);
  useEffect(() => { const receive = (event) => { window.albumPetState = event.detail; setPet(event.detail || {}); }; window.addEventListener('album-pet-state', receive); return () => window.removeEventListener('album-pet-state', receive); }, []);
  useEffect(() => { sound?.setDucked(provider === 'system' ? Boolean(system.playing) : provider !== 'visual' && playback.playing); }, [provider, playback.playing, system.playing]);
  useEffect(() => {
    const blocked = (target) => target?.closest?.('input,textarea,select,[contenteditable="true"],dialog,.room-turntable,.cabinet-browse-controls') || document.querySelector('dialog[open]');
    const keydown = (event) => {
      if (blocked(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); changeRow(event.key === 'Home' ? 0 : event.key === 'End' ? view.maxRow : view.startRow + (event.key === 'ArrowDown' ? 1 : -1));
    };
    const onWheel = (event) => {
      if (blocked(event.target) || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault(); const now = performance.now(), current = wheel.current;
      if (now - current.time > 280 || Math.sign(current.amount) !== Math.sign(event.deltaY)) current.amount = 0;
      current.amount += event.deltaY * (event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? 200 : 1);
      if (Math.abs(current.amount) >= 65 && now - current.time >= 180) { changeRow(view.startRow + Math.sign(current.amount)); current.amount = 0; current.time = now; }
    };
    document.addEventListener('keydown', keydown); stage.current.addEventListener('wheel', onWheel, { passive: false });
    const element = stage.current;
    return () => { document.removeEventListener('keydown', keydown); element.removeEventListener('wheel', onWheel); };
  }, [view.startRow, view.maxRow, signature]);
  const recordStyle = record ? normalizeStyle(library?.data.styles[albumKey(record)]) : undefined;
  const catFocus = focus ? focusSnapshot(focus.state, focus.now) : {}, weather = catFocus.weather || 'snow';
  const nowTrack = provider === 'visual' ? '' : provider === 'system' ? (system.active ? system.title : '') : playback.actualTrack || (record && playback.playing ? record.tracks?.[trackIndex]?.title || record.tracks?.[trackIndex] || record.title : '');
  const grooving = effectiveSpin || sound?.lofiState === 'playing';
  snapshot.current = { look, roomName, weather, accessory: catFocus.accessory || '', grooving, track: typeof nowTrack === 'string' ? nowTrack : '', startRow: view.startRow, items: view.items.map(snapshotItem), selectedId: selected?.id || '', record: snapshotItem(deckItem), recordStyle, spinning: effectiveSpin, trackIndex: provider === 'system' ? 0 : trackIndex, reduceMotion: appearance.reduceMotion, statusText: provider === 'visual' ? (record ? spinning ? '展示中 · 无音频' : '旋转已暂停 · 无音频' : '等待放盘 · 无音频') : provider === 'system' ? system.statusText : playback.statusText, actualTrack: provider === 'system' ? system.title || '' : playback.actualTrack || '', provider };
  useEffect(() => {
    const getter = () => snapshot.current; window.albumRoomSnapshot = getter;
    const receive = (event) => { window.albumRoomWallpaperState = event.detail; setWallpaper(event.detail || {}); };
    window.addEventListener('album-room-wallpaper', receive);
    return () => { if (window.albumRoomSnapshot === getter) delete window.albumRoomSnapshot; window.removeEventListener('album-room-wallpaper', receive); };
  }, []);
  const setLook = (value) => library?.update((old) => ({ ...old, rooms: { ...old.rooms, [library.roomId]: { ...(old.rooms[library.roomId] || {}), look: value } } }));
  return <div className={`listening-room cabin-room cabin-${look}`}>
    <div className="cabin-toolbar"><span><Disc3 size={17}/>{roomName} · {items.length} 张 / 条</span><div className="cabin-toolbar-actions">
      {focus && <span className="zen-keep cabin-toolbar-group"><FocusBadge onClick={() => saveDock({ open: !dock.open })}/><button type="button" aria-pressed={zen} title="沉浸模式 · Z" onClick={() => setZen(!zen)}>{zen ? <><Eye size={17}/>退出沉浸</> : <><EyeSlash size={17}/>沉浸</>}</button></span>}
      <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Settings size={17}/>筛选与唱片盒</button>
      <button type="button" aria-pressed={look === 'pixel'} onClick={() => setLook(look === 'pixel' ? 'warm' : 'pixel')}><Grid3X3 size={17}/>{look === 'pixel' ? '切换写实风格' : '切换像素风格'}</button>
      {appearance.client && <button type="button" onClick={() => setMusicSettings(true)}><Music2 size={17}/>音源设置</button>}
      {appearance.client && <button type="button" aria-pressed={Boolean(pet.active)} onClick={() => desktopCommand(pet.active ? 'pet-stop' : 'pet-start')}><Heart size={17}/>{pet.active ? '让小猫回家' : '小猫出门'}</button>}
      {appearance.client && <button type="button" disabled={wallpaper.busy} onClick={() => desktopCommand(wallpaper.active ? 'wallpaper-stop' : 'wallpaper-start')}><External size={17}/>{wallpaper.busy ? '正在应用桌面…' : wallpaper.active ? '停止桌面动态背景' : '设为桌面动态背景'}</button>}
    </div></div>
    {wallpaper.error && <p className="wallpaper-error" role="alert">{wallpaper.error}</p>}
    <div ref={stage} className="cabin-stage-wrap"><RoomScene look={look} items={view.items} selectedId={selected?.id} select={setSelectedId} load={load} startRow={view.startRow} weather={weather} cat={<RoomCat focus={catFocus} playing={grooving} track={snapshot.current.track} reduceMotion={appearance.reduceMotion} hidden={Boolean(pet.active)}/>}>
      <RoomTurntable item={deckItem} spinning={effectiveSpin} system={system} trackIndex={provider === 'system' ? 0 : trackIndex} style={recordStyle} items={items} load={load} toggle={() => setSpinning(!spinning)} track={setTrackIndex} eject={() => { setRecord(null); setSpinning(false); }} provider={provider} setProvider={(value) => { setProvider(value); try { localStorage.setItem('album-circle-room-player-v1', value); } catch {} }} playback={playback} desktopClient={appearance.client}/>
      {!items.length && <div className="room-empty"><p>{loading ? '正在整理唱片…' : '木屋的唱片架，等你放上第一张。'}</p>{!loading && <button type="button" onClick={() => setMode('add')}>添加专辑</button>}</div>}
      <div className="room-shelf-navigation" aria-label="唱片架浏览"><button type="button" aria-label="上一排唱片" disabled={view.startRow === 0} onClick={() => changeRow(view.startRow - 1)}><Up/></button><span>{view.rows ? `${view.startRow + 1}–${Math.min(view.rows, view.startRow + 3)} / ${view.rows} 排` : '空唱片架'}</span><button type="button" aria-label="下一排唱片" disabled={view.startRow >= view.maxRow} onClick={() => changeRow(view.startRow + 1)}><Down/></button><small>↑ ↓ / 滚轮浏览</small></div>
    </RoomScene></div>
    <div className="room-now-playing"><div className="room-selection-copy"><small>ON THE SHELF / 唱片架</small><h2 title={selected?.title}>{selected?.title || '你的唱片收藏'}</h2><p>{selected ? `${selected.artist} · ${selected.year || '年份待补充'} · ${selected.tracks?.length || 0} 首曲目` : '添加专辑后，双击或拖拽放盘。'}</p>{selected && purchaseSlot?.(selected)}</div><div className="room-selection-actions">{selected && <><RecordTools item={selected}/><DiscogsLink item={selected}/><button type="button" className="room-open-album" onClick={() => openItemDetail(selected.id)}>查看专辑 <ArrowUpRight size={18}/></button></>}</div></div>
    {focus && <FocusDock open={dock.open} tab={dock.tab} setTab={(tab) => saveDock({ tab })} close={() => saveDock({ open: false })}/>}
    {musicSettings && <MusicSettings close={() => setMusicSettings(false)}/>}
  </div>;
}
