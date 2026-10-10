import RoomPersonalization from './RoomPersonalization';
import CabinWelcome, { WELCOME_KEY } from './CabinWelcome';
import { getRoomScene } from './scene-catalog.mjs';
import { normalizePetId } from './pet/pet-catalog.mjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Up, Down, ArrowUpRight, Grid3X3, Settings, External, Music2, Eye, EyeSlash, Heart, Plus, ListBullet, Check } from './icons';
import DiscogsLink from './DiscogsLink';
import { RecordBoxControls, RecordTools, useRecordLibrary, useRecordStyle } from './RecordLibrary';
import { matchesLibraryFilters } from './record-library.mjs';
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
import { usePlayerQueue, usePlayerShortcuts, usePlaybackBroadcast, suggestProvider } from './player/usePlayer';
import './companion-room.css';
export { ShowroomArtwork } from './RoomArtwork';

const snapshotItem = (item) => item ? ({ id: item.id, title: item.title, artist: item.artist, cover: item.cover, type: item.type, tracks: item.tracks, externalIds: item.externalIds, collectionId: item.collectionId }) : null;
const PROVIDERS = ['auto', 'qq', 'netease', 'ma', 'local', 'system'];
const SORTS = { recent: '最近放上', year: '发行年份', title: '专辑名', artist: '歌手' };
const readJSON = (key, fallback) => { try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) }; } catch { return fallback; } };
const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

// Sort and filter the shelf: kept on this computer between visits.
function useShelfFilters(items) {
  const library = useRecordLibrary();
  const [filters, setFiltersState] = useState(() => readJSON('album-circle-shelf-filters-v1', { sort: 'recent', type: 'all', box: 'all', genre: 'all', decade: 'all', provider: 'all' }));
  const setFilters = (change) => setFiltersState((old) => { const next = typeof change === 'function' ? change(old) : change; writeJSON('album-circle-shelf-filters-v1', next); return next; });
  const visible = useMemo(() => {
    const list = items.filter((item) => (filters.type === 'all' || item.type === filters.type) && matchesLibraryFilters(item, library.data, library.roomId, filters));
    const by = { year: (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0), title: (a, b) => String(a.title).localeCompare(String(b.title), 'zh'), artist: (a, b) => String(a.artist).localeCompare(String(b.artist), 'zh'), recent: (a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')) };
    return [...list].sort(by[filters.sort] || by.recent);
  }, [items, filters, library.data, library.roomId]);
  return { filters, setFilters, visible };
}

export default function CabinRoom({ items, loading, openRecord, openAdd, firstVisit = false, guideRequest = 0, notify }) {
  const library = useRecordLibrary(), look = library?.data.rooms[library.roomId]?.look || 'pixel';
  const appearance = useDesktopAppearance();
  const petId = normalizePetId(library?.data.rooms[library.roomId]?.petId);
  const [personalize, setPersonalize] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const welcomeChecked = useRef(false);
  useEffect(() => {
    if (loading || welcomeChecked.current) return;
    welcomeChecked.current = true;
    if (firstVisit && !items.length) setWelcome(true);
  }, [loading, firstVisit, items.length]);
  useEffect(() => { if (guideRequest) setWelcome(true); }, [guideRequest]);
  const { filters, setFilters, visible } = useShelfFilters(items);
  const [row, setRow] = useState(0), [selectedId, setSelectedId] = useState(visible[0]?.id || '');
  const [record, setRecord] = useState(null), [spinning, setSpinning] = useState(false), [trackIndex, setTrackIndex] = useState(0);
  const [provider, setProvider] = useState(() => { try { const value = localStorage.getItem('album-circle-room-player-v1'); return PROVIDERS.includes(value) || value === 'visual' ? value : 'visual'; } catch { return 'visual'; } });
  const chosenProvider = useRef((() => { try { return Boolean(localStorage.getItem('album-circle-room-player-v1')); } catch { return true; } })());
  const chooseProvider = (value) => { chosenProvider.current = true; setProvider(value); try { localStorage.setItem('album-circle-room-player-v1', value); } catch {} };
  const [musicSettings, setMusicSettings] = useState(false), [filtersOpen, setFiltersOpen] = useState(false);
  const queueRef = useRef(null);
  const playback = useRoomPlayback(record, trackIndex, provider, () => queueRef.current?.current.next(false));
  const system = useSystemNowPlaying(provider === 'system');
  const deckItem = provider === 'system' ? system.item : record;
  const effectiveSpin = provider === 'visual' ? spinning : provider === 'system' ? Boolean(system.active && system.playing) : playback.playing;
  const [wallpaper, setWallpaper] = useState(() => window.albumRoomWallpaperState || {});
  const [wallpaperError, setWallpaperError] = useState('');
  useEffect(() => {
    setWallpaperError(wallpaper.error || '');
    if (!wallpaper.error) return;
    const timer = setTimeout(() => setWallpaperError(''), 5000);
    return () => clearTimeout(timer);
  }, [wallpaper]);
  const stage = useRef(null), wheel = useRef({ amount: 0, time: 0 }), snapshot = useRef(null);
  const focus = useFocus(), sound = useSoundscape();
  const [dock, setDock] = useState(() => readJSON('album-circle-focus-dock-v1', { open: false, tab: 'timer' }));
  const saveDock = (change) => setDock((old) => { const next = { ...old, ...change }; writeJSON('album-circle-focus-dock-v1', next); return next; });
  const [zen, setZen] = useState(false), [pet, setPet] = useState(() => window.albumPetState || {});
  const shelfColumns = getRoomScene(look).geometry.columns.length;
  const signature = visible.map((item) => item.id).join('|'), view = shelfWindow(visible, row, shelfColumns);
  const selected = view.items.find((item) => item.id === selectedId) || view.items[0];
  const load = (item, index = 0) => {
    if (!chosenProvider.current && provider === 'visual') { const suggested = suggestProvider(item); if (suggested) { setProvider(suggested); chosenProvider.current = true; } }
    if (record?.id === item.id && trackIndex === index && provider !== 'visual' && !playback.playing) playback.toggle(); setRecord(item); setSelectedId(item.id); setTrackIndex(index); setSpinning(true); };
  const [player, playerRef] = usePlayerQueue({ items, record, trackIndex, setTrackIndex, loadAlbum: (item, index) => loadRef.current(item, index), playback, provider });
  queueRef.current = playerRef;
  usePlayerShortcuts({ playback, player, provider, record, trackIndex, toggleVisual: () => setSpinning((value) => !value) });
  usePlaybackBroadcast({ playing: provider === 'system' ? Boolean(system.active && system.playing) : provider === 'visual' ? false : playback.playing, provider, spinning: effectiveSpin, record: deckItem, trackIndex: provider === 'system' ? 0 : trackIndex, trackTitle: provider === 'system' ? system.title : playback.actualTrack, audio: playback.audio });
  useEffect(() => { const open = () => setMusicSettings(true); window.addEventListener('cabin-open-music-settings', open); return () => window.removeEventListener('cabin-open-music-settings', open); }, []);
  const changeRow = (next) => { const value = shelfWindow(visible, next, shelfColumns); setRow(value.startRow); setSelectedId(value.items[0]?.id || ''); };
  useEffect(() => { setRow(0); setSelectedId(visible[0]?.id || ''); }, [signature, look]);
  useEffect(() => { if (record && !items.some((item) => item.id === record.id)) { setRecord(null); setSpinning(false); } }, [items]);
  // The album card asks the deck to play an album, optionally from a track.
  const loadRef = useRef(load); loadRef.current = load;
  useEffect(() => {
    const play = (event) => { const item = items.find((entry) => entry.id === event.detail?.id); if (item) loadRef.current(item, Math.max(0, Number(event.detail.track) || 0)); };
    window.addEventListener('cabin-play', play); return () => window.removeEventListener('cabin-play', play);
  }, [items]);
  useEffect(() => { document.documentElement.classList.toggle('room-zen', zen); document.documentElement.classList.toggle('room-focus-open', dock.open); document.documentElement.classList.toggle('room-filters-open', filtersOpen); }, [zen, dock.open, filtersOpen]);
  useEffect(() => () => document.documentElement.classList.remove('room-zen', 'room-focus-open', 'room-filters-open'), []);
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
    const blocked = (target) => target?.closest?.('input,textarea,select,[contenteditable="true"],dialog,.room-turntable,.shelf-filters,.focus-dock') || document.querySelector('dialog[open]');
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
  const recordStyle = useRecordStyle(deckItem);
  const catFocus = focus ? focusSnapshot(focus.state, focus.now) : {}, weather = catFocus.weather || 'snow';
  const nowTrack = provider === 'visual' ? '' : provider === 'system' ? (system.active ? system.title : '') : playback.actualTrack || (record && playback.playing ? record.tracks?.[trackIndex] || record.title : '');
  const grooving = effectiveSpin || sound?.lofiState === 'playing';
  snapshot.current = { look, petId, roomName: getRoomScene(look).label, weather, accessory: catFocus.accessory || '', grooving, track: typeof nowTrack === 'string' ? nowTrack : '', startRow: view.startRow, items: view.items.map(snapshotItem), selectedId: selected?.id || '', record: snapshotItem(deckItem), recordStyle, spinning: effectiveSpin, trackIndex: provider === 'system' ? 0 : trackIndex, reduceMotion: appearance.reduceMotion, statusText: provider === 'visual' ? (record ? spinning ? '展示中 · 无音频' : '旋转已暂停 · 无音频' : '等待放盘 · 无音频') : provider === 'system' ? system.statusText : playback.statusText, actualTrack: provider === 'system' ? system.title || '' : playback.actualTrack || '', provider };
  useEffect(() => {
    const getter = () => snapshot.current; window.albumRoomSnapshot = getter;
    const receive = (event) => { window.albumRoomWallpaperState = event.detail; setWallpaper(event.detail || {}); };
    window.addEventListener('album-room-wallpaper', receive);
    return () => { if (window.albumRoomSnapshot === getter) delete window.albumRoomSnapshot; window.removeEventListener('album-room-wallpaper', receive); };
  }, []);
  const personalizeRoom = (patch) => library?.update((old) => ({ ...old, rooms: { ...old.rooms, [library.roomId]: { ...(old.rooms[library.roomId] || {}), ...patch } } }));
  const filtered = visible.length !== items.length;
  const finishWelcome = (action) => {
    try { localStorage.setItem(WELCOME_KEY, 'seen'); } catch { notify?.('这次未能记住入门状态，下次仍可从入门指南打开。'); }
    setWelcome(false);
    if (action === 'focus') saveDock({ open: true, tab: 'timer' });
    if (action === 'album') openAdd();
    if (action === 'music') setMusicSettings(true);
  };
  return <div className={`listening-room cabin-room cabin-${look}`} style={{ '--amber': getRoomScene(look).style.accent }}>
    <nav className="cabin-toolbar" aria-label="小屋工具">
      {focus && <span className="zen-keep cabin-toolbar-group"><button type="button" aria-pressed={zen} title="沉浸模式 · Z" onClick={() => setZen(!zen)}>{zen ? <><Eye size={17}/><span>退出沉浸</span></> : <><EyeSlash size={17}/><span>沉浸</span></>}</button></span>}
      <span className="cabin-toolbar-group">
        <button type="button" aria-label={petId === 'cat' ? (pet.active ? '让小猫回家' : '小猫出门') : (pet.active ? '让伙伴回家' : '伙伴出门')} title={pet.active ? '让伙伴回家' : '伙伴出门'} aria-pressed={Boolean(pet.active)} onClick={() => desktopCommand(pet.active ? 'pet-stop' : 'pet-start')}><Heart size={17}/><span>{petId === 'cat' ? (pet.active ? '让小猫回家' : '小猫出门') : (pet.active ? '让伙伴回家' : '伙伴出门')}</span></button>
        <button type="button" aria-label={wallpaper.busy ? '取消应用桌面背景' : wallpaper.active ? '停止桌面动态背景' : '设为桌面动态背景'} title={wallpaper.busy ? '取消应用桌面背景' : wallpaper.active ? '停止桌面动态背景' : '设为桌面动态背景'} onClick={() => desktopCommand(wallpaper.active || wallpaper.busy ? 'wallpaper-stop' : 'wallpaper-start')}><External size={17}/><span>{wallpaper.busy ? '取消应用桌面背景' : wallpaper.active ? '停止桌面动态背景' : '设为桌面动态背景'}</span></button>
      </span>
    </nav>
    {filtersOpen && <section id="cabin-shelf-filters" className="shelf-filters" aria-label="筛选与唱片盒">
      <header className="shelf-filters-header"><strong>筛选与唱片盒</strong><button type="button" aria-label="收起筛选与唱片盒" onClick={() => setFiltersOpen(false)}>收起</button></header>
      <div className="shelf-filter-row">
        <label>排序<select aria-label="排序方式" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>{Object.entries(SORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>类型<select aria-label="筛选类型" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="all">全部</option><option value="album">专辑</option><option value="song">单曲</option></select></label>
      </div>
      <RecordBoxControls items={items} filters={filters} setFilters={(change) => setFilters((old) => ({ ...old, ...(typeof change === 'function' ? change(old) : change) }))} count={visible.length}/>
    </section>}
    {library?.error && !personalize && !filtersOpen && <p className="room-preferences-error" role="alert">设置未保存：{library.error}</p>}
    {wallpaperError && <p className="wallpaper-error" role="alert">{wallpaperError}<button type="button" aria-label="关闭动态背景提示" onClick={() => setWallpaperError('')}>×</button></p>}
    <div ref={stage} className="cabin-stage-wrap"><RoomScene look={look} items={view.items} selectedId={selected?.id} select={setSelectedId} load={load} startRow={view.startRow} weather={weather} cat={<RoomCat petId={petId} focus={catFocus} playing={grooving} track={snapshot.current.track} reduceMotion={appearance.reduceMotion} hidden={Boolean(pet.active)}/>}>
      <RoomTurntable item={deckItem} spinning={effectiveSpin} system={system} trackIndex={provider === 'system' ? 0 : trackIndex} style={recordStyle} items={items} load={load} toggle={() => setSpinning(!spinning)} track={setTrackIndex} eject={() => { setRecord(null); setSpinning(false); }} provider={provider} setProvider={chooseProvider} playback={playback} player={player} desktopClient tools={<nav className="turntable-room-tools" aria-label="小屋设置">
        <button type="button" aria-label="筛选与唱片盒" title="筛选与唱片盒" aria-controls="cabin-shelf-filters" aria-expanded={filtersOpen} className={filtered ? 'is-active' : ''} onClick={() => setFiltersOpen(!filtersOpen)}><Settings size={17}/><span>筛选与唱片盒{filtered ? ` · ${visible.length}` : ''}</span></button>
        <button type="button" aria-label="布置小屋" title="布置小屋" onClick={() => setPersonalize(true)}><Grid3X3 size={17}/><span>布置小屋</span></button>
        <button type="button" aria-label="音源设置" title="音源设置" onClick={() => setMusicSettings(true)}><Music2 size={17}/><span>音源设置</span></button>
      </nav>}/>
      {!visible.length && <div className="room-empty">
        <p>{loading ? '正在整理唱片…' : items.length ? '没有符合筛选的唱片。' : '木屋的唱片架，等你放上第一张。'}</p>
        {!loading && (items.length ? <button type="button" onClick={() => setFilters({ ...filters, type: 'all', box: 'all', genre: 'all', decade: 'all', provider: 'all' })}>清除筛选</button> : <>
          <small>也可以先专注一会儿，收藏慢慢来。</small>
          <div className="room-welcome-actions"><button type="button" onClick={() => openAdd()}><Plus size={16}/>添加第一张专辑</button>{focus && <button type="button" className="room-welcome-focus" onClick={() => saveDock({ open: true, tab: 'timer' })}>先专注一会儿</button>}</div>
          <small className="room-welcome-tip">在「布置小屋」里选一个场景和伙伴。</small>
        </>)}
      </div>}
      {view.rows > 3 && <div className="room-shelf-navigation" aria-label="唱片架浏览"><button type="button" aria-label="上一排唱片" disabled={view.startRow === 0} onClick={() => changeRow(view.startRow - 1)}><Up/></button><span>{`${view.startRow + 1}–${Math.min(view.rows, view.startRow + 3)} / ${view.rows} 排`}</span><button type="button" aria-label="下一排唱片" disabled={view.startRow >= view.maxRow} onClick={() => changeRow(view.startRow + 1)}><Down/></button><small>↑ ↓ / 滚轮浏览</small></div>}
    </RoomScene></div>
    {selected && <div className="room-now-playing"><div className="room-selection-copy"><small>唱片架 · 双击封面放盘</small><h2 title={selected.title}>{selected.title}</h2><p title={`${selected.artist} · ${selected.year || '年份待补充'} · ${selected.tracks?.length || 0} 首曲目`}>{`${selected.artist} · ${selected.year || '年份待补充'} · ${selected.tracks?.length || 0} 首曲目`}</p></div><div className="room-selection-actions">{record && record.id !== selected.id && <button type="button" className="room-queue-add" aria-label={player.queue.ids.includes(selected.id) ? '已在待播' : '加入待播'} aria-pressed={player.queue.ids.includes(selected.id)} title="当前唱片放完后接着放" onClick={() => player.queue.ids.includes(selected.id) ? player.remove(selected.id) : player.enqueue(selected.id)}>{player.queue.ids.includes(selected.id) ? <><Check size={16}/><span>已在待播</span></> : <><ListBullet size={16}/><span>加入待播</span></>}</button>}<RecordTools item={selected}/><DiscogsLink item={selected}/><button type="button" className="room-open-album" aria-label="唱片卡片" title="唱片卡片" onClick={() => openRecord(selected.id)}><span>唱片卡片</span><ArrowUpRight size={18}/></button></div></div>}
    {focus && <><FocusBadge open={dock.open} onClick={() => saveDock({ open: !dock.open })}/><FocusDock open={dock.open} tab={dock.tab} setTab={(tab) => saveDock({ tab })} close={() => saveDock({ open: false })}/></>}
    {personalize && <RoomPersonalization look={look} petId={petId} onChange={personalizeRoom} close={() => setPersonalize(false)} reduceMotion={appearance.reduceMotion} error={library?.error}/>}
    {musicSettings && <MusicSettings close={() => setMusicSettings(false)} provider={provider} useSource={chooseProvider}/>}
    {welcome && <CabinWelcome look={look} petId={petId} onChange={personalizeRoom} close={() => finishWelcome()} finish={finishWelcome} reduceMotion={appearance.reduceMotion} error={library?.error}/>}
  </div>;
}
