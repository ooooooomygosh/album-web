import React, { useRef, useState } from 'react';
import SceneDeck from './scene/SceneDeck';
import { ChevronLeft, ChevronRight, Disc3, Pause, Play, X, Plus } from './icons';
import { ROOM_DRAG_TYPE } from './RoomScene';
import useTurntablePosition from './useTurntablePosition';
import { trackNames } from './room-model.mjs';
import PlayerControls from './player/PlayerControls';

export default function RoomTurntable({ item, spinning, trackIndex = 0, style, items = [], load, toggle, track, eject, readOnly = false, desktopClient = false, provider = 'visual', setProvider, playback, statusText, actualTrack, system, player }) {
  const [dragging, setDragging] = useState(false), names = trackNames(item), deckAnchor = useRef(null);
  const placement = useTurntablePosition(readOnly);
  const trackName = actualTrack || playback?.actualTrack || names[trackIndex] || (item ? '原始资料暂无曲目' : '双击封面，或将唱片拖到这里');
  return <aside ref={placement.ref} style={placement.style} data-moving={String(placement.moving)} className={`room-turntable ${spinning ? 'is-spinning' : ''} ${dragging ? 'is-drop-target' : ''}`} aria-label="黑胶唱机" data-loaded-id={item?.id || ''} data-spinning={String(Boolean(spinning))} onDragOver={(event) => { if (!readOnly && event.dataTransfer.types.includes(ROOM_DRAG_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragging(true); } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => {
    event.preventDefault(); setDragging(false);
    const found = items.find((candidate) => candidate.id === event.dataTransfer.getData(ROOM_DRAG_TYPE)); if (found && !readOnly) load?.(found);
  }}>
    {/* The physical deck lives in the scene (shelf top) — see src/scene/SceneDeck.jsx. */}
    <span ref={deckAnchor} hidden/>
    <SceneDeck anchor={deckAnchor} item={item} spinning={spinning} vinyl={style} readOnly={readOnly} dragType={ROOM_DRAG_TYPE}
      onActivate={() => deckAnchor.current?.closest('.room-turntable')?.querySelector('.turntable-toggle')?.click()}
      onDropRecord={(id) => { const found = items.find((candidate) => candidate.id === id); if (found && !readOnly) load?.(found); }}/>
    <div className="turntable-side-cabinet">
      <span className="cabinet-side-face" aria-hidden="true"/><span className="cabinet-leg cabinet-leg-left" aria-hidden="true"/><span className="cabinet-leg cabinet-leg-right" aria-hidden="true"/>
      <div className="turntable-console">
    <div className="turntable-heading">{readOnly ? <span><Disc3 size={15}/>木屋唱机</span> : <button type="button" className="turntable-drag-handle" aria-label="移动唱机" title="拖动移动唱机 · 方向键微调 · 双击或 Home 复位" {...placement.handle}><Disc3 size={15}/>木屋唱机 ⠿</button>}<small>{{ visual: 'VISUAL EDITION', ma: 'MUSIC ASSISTANT', local: 'LOCAL FILES', system: 'NOW PLAYING' }[provider] || 'SIMPLE MUSIC'}</small></div>
    {!readOnly && playback && <audio ref={playback.audio} {...playback.events} preload="metadata"/>}
    {!readOnly && <label className="turntable-source">音源<select aria-label="唱机音源" value={provider} onChange={(event) => setProvider?.(event.target.value)}><option value="visual">仅动画展示</option><option value="qq" disabled={!desktopClient}>QQ 音乐 · {desktopClient ? 'Simple Music' : '桌面客户端'}</option><option value="netease" disabled={!desktopClient}>网易云 · {desktopClient ? 'Simple Music' : '桌面客户端'}</option><option value="ma" disabled={!desktopClient}>Music Assistant · {desktopClient ? '服务器播放器' : '桌面客户端'}</option><option value="local" disabled={!desktopClient}>本地音乐 · {desktopClient ? '文件夹' : '桌面客户端'}</option><option value="system" disabled={!desktopClient}>系统正在播放 · {desktopClient ? '跟随播放器' : '桌面客户端'}</option></select></label>}
    <div className="turntable-copy"><strong title={item?.title}>{item?.title || '让收藏转起来'}</strong><span className="turntable-artist">{item?.artist || '专辑库原始封面与曲目'}</span><p className="turntable-track" title={trackName}>{item && names.length ? `${String(trackIndex + 1).padStart(2, '0')} · ` : ''}{trackName}</p><small className="turntable-status" role="status">{statusText || (provider === 'system' ? system?.statusText : provider === 'visual' ? (item ? spinning ? '展示中 · 无音频' : '旋转已暂停 · 无音频' : '等待放盘 · 无音频') : playback?.statusText)}</small></div>
    {!readOnly && provider === 'system' && system && <div className="turntable-controls turntable-system-controls">
      <button type="button" aria-label="系统播放器上一首" disabled={!system.active} onClick={() => system.control('previous')}><ChevronLeft size={18}/></button>
      <button type="button" className="turntable-toggle" aria-label={system.playing ? '暂停系统播放器' : '继续系统播放器'} disabled={!system.active} onClick={() => system.control('toggle')}>{system.playing ? <Pause size={19}/> : <Play size={19}/>}</button>
      <button type="button" aria-label="系统播放器下一首" disabled={!system.active} onClick={() => system.control('next')}><ChevronRight size={18}/></button>
      {system.active && <button type="button" className="turntable-collect" title="在曲库中搜索这张专辑并收藏到唱片架" onClick={() => window.dispatchEvent(new CustomEvent('album-quick-search', { detail: { query: `${system.albumArtist || system.artist} ${system.album || system.title}` } }))}><Plus size={16}/>收藏这张</button>}
    </div>}
    {!readOnly && item && provider !== 'system' && <PlayerControls item={item} items={items} provider={provider} spinning={spinning} trackIndex={trackIndex} track={track} toggle={toggle} eject={eject} playback={playback} player={player} setProvider={setProvider}/>}
    {!readOnly && !['visual', 'system'].includes(provider) && playback?.candidates.length > 0 && <div className="turntable-matches" aria-label="选择曲目版本">{playback.candidates.map((candidate) => <button type="button" key={candidate.id} onClick={() => playback.choose(candidate)}><strong>{candidate.title}</strong><span>{candidate.artist} · {candidate.album || '专辑未知'}</span></button>)}</div>}
    {!readOnly && provider !== 'system' && !item && <p className="turntable-hint">双击封面，或把唱片拖到这里。</p>}
      </div>
    </div>
  </aside>;
}
