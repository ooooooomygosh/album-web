import React, { useEffect, useRef, useState } from 'react';
import { Disc3, Play, Trash2, External, Check } from './icons';
import Dialog from './Dialog';
import DiscogsLink from './DiscogsLink';
import { RecordTools, VinylDisc, useRecordLibrary } from './RecordLibrary';
import { ShowroomArtwork } from './RoomArtwork';
import { genresFor } from './record-library.mjs';
import { trackNames } from './room-model.mjs';
import { updateItem } from './collection-api.mjs';

const duration = (ms) => ms > 0 ? `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, '0')}` : '';
// One album: cover and vinyl, track list that plays on the deck, personal notes.
export default function RecordCard({ item, close, onChanged, onRemove }) {
  const library = useRecordLibrary(), names = trackNames(item), genres = library ? genresFor(item, library.data) : [];
  const [notes, setNotes] = useState(item.notes || ''), [saved, setSaved] = useState('saved'), [confirm, setConfirm] = useState(false);
  const timer = useRef(null), latest = useRef(notes);
  latest.current = notes;
  const saveNotes = async () => {
    clearTimeout(timer.current); if (latest.current === (item.notes || '')) { setSaved('saved'); return; }
    setSaved('saving');
    try { const result = await updateItem(item.id, { notes: latest.current }); onChanged(result.item); setSaved('saved'); } catch { setSaved('error'); }
  };
  useEffect(() => () => { clearTimeout(timer.current); if (latest.current !== (item.notes || '')) updateItem(item.id, { notes: latest.current }).then((result) => onChanged(result.item)).catch(() => {}); }, [item.id]);
  const play = (track = 0) => { window.dispatchEvent(new CustomEvent('cabin-play', { detail: { id: item.id, track } })); close(); };
  const links = [item.collectionViewUrl && ['Apple Music', item.collectionViewUrl], item.externalIds?.qqAlbumMid && ['QQ 音乐', `https://y.qq.com/n/ryqq/albumDetail/${encodeURIComponent(item.externalIds.qqAlbumMid)}`]].filter(Boolean);
  return <Dialog title="唱片卡片" icon={<Disc3 size={20}/>} close={close} wide className="record-card-dialog" label={`唱片卡片：${item.title}`}>
    <div className="record-card">
      <div className="record-card-art">
        <div className="record-card-sleeve"><VinylDisc item={item} className="record-card-vinyl"/><ShowroomArtwork item={item} className="record-card-cover"/></div>
        <div className="record-card-tools"><button type="button" className="pixel-button is-primary" onClick={() => play(0)}><Play size={16}/>放上唱机</button><RecordTools item={item}/><DiscogsLink item={item}/></div>
      </div>
      <div className="record-card-copy">
        <small className="record-card-kicker">{item.type === 'song' ? 'SINGLE · 单曲' : 'ALBUM · 专辑'}{item.source === 'local-music' ? ' · 本地文件' : ''}</small>
        <h3>{item.title}</h3>
        <p className="record-card-artist">{item.artist}</p>
        <dl className="record-card-facts">
          {item.year && <div><dt>发行</dt><dd>{item.year}</dd></div>}
          {(item.label || item.genre) && <div><dt>{item.label ? '厂牌' : '流派'}</dt><dd>{item.label || item.genre}</dd></div>}
          {genres.length > 0 && <div><dt>标签</dt><dd>{genres.join(' · ')}</dd></div>}
          <div><dt>放上唱片架</dt><dd>{item.addedAt ? new Date(item.addedAt).toLocaleDateString('zh-CN') : '—'}</dd></div>
        </dl>
        {names.length > 0 ? <ol className="record-card-tracks" aria-label="曲目">{names.map((name, index) => <li key={index}><button type="button" onClick={() => play(index)} title="从这一首开始播放"><span>{String(index + 1).padStart(2, '0')}</span><strong>{name}</strong><small>{duration(item.trackDetails?.[index]?.lengthMillis)}</small></button></li>)}</ol> : <p className="record-card-empty">还没有曲目资料。</p>}
        <label className="record-card-notes">我的笔记<textarea value={notes} maxLength={4000} rows={4} placeholder="第一次听的场景、最喜欢的一首、想记住的一句歌词…" onChange={(event) => { setNotes(event.target.value); setSaved('dirty'); clearTimeout(timer.current); timer.current = setTimeout(saveNotes, 900); }} onBlur={saveNotes}/></label>
        <small className="record-card-saved" role="status">{{ saving: '正在保存…', error: '保存失败，请稍后再试。', dirty: '', saved: notes ? <><Check size={13}/>已保存在这台电脑</> : '' }[saved]}</small>
        <footer className="record-card-footer">
          {links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer"><External size={15}/>{label}</a>)}
          <span className="record-card-spacer"/>
          {confirm ? <><span>从唱片架移除这张唱片？</span><button type="button" className="pixel-button" onClick={() => setConfirm(false)}>取消</button><button type="button" className="pixel-button is-danger" onClick={() => onRemove(item)}>确认移除</button></> : <button type="button" className="pixel-button is-quiet" onClick={() => setConfirm(true)}><Trash2 size={15}/>移除</button>}
        </footer>
      </div>
    </div>
  </Dialog>;
}
