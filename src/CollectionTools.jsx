import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRecordLibrary } from './RecordLibrary';
import { albumKey, normalizeLibrary } from './record-library.mjs';
import { desktopCommand, useDesktopAppearance } from './desktop-client';
import { downloadBlob } from './album-wall-canvas.mjs';
import { X, Share2, Library } from './icons';

export default function CollectionTools({ room, items, session, reload }) {
  const library = useRecordLibrary(), appearance = useDesktopAppearance();
  const [open, setOpen] = useState(false);
  if (!appearance.client) return null;
  return <><button type="button" className="album-wall-entry" onClick={() => setOpen(true)}><Share2 size={18}/><span>收藏与分享</span></button>{open && <CollectionDialog room={room} items={items} session={session} reload={reload} library={library} appearance={appearance} close={() => setOpen(false)}/>}</>;
}
function CollectionDialog({ room, items, session, reload, library, appearance, close }) {
  const dialog = useRef(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [title, setTitle] = useState(''), [artist, setArtist] = useState(''), [year, setYear] = useState(''), [cover, setCover] = useState(''), [tracks, setTracks] = useState('');
  const [share, setShare] = useState(() => { try { return JSON.parse(localStorage.getItem('album-circle-latest-share-' + session.user.id)) || null; } catch { return null; } });
  const local = appearance.connectionMode === 'local';
  useEffect(() => { const previous = document.activeElement; dialog.current.showModal(); return () => previous?.focus?.(); }, []);
  const snapshot = () => ({ version: 1, kind: 'AlbumCircleCollection', name: room.name, roomId: room.id, items, library: library.data, appearance: { showroom: appearance.showroom, theme: appearance.theme, reduceMotion: appearance.reduceMotion } });
  const request = async (path, body, token = session.token, method = 'POST') => { const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, ...(body ? { body: JSON.stringify(body) } : {}) }); const result = await response.json(); if (!response.ok) throw Object.assign(new Error(result.error || '操作失败。'), { status: response.status }); return result; };
  const run = async (action) => { setBusy(true); setNotice(''); try { await action(); } catch (error) { setNotice(error.message); } finally { setBusy(false); } };
  const cloudToken = () => { if (!local) return session.token; try { return JSON.parse(localStorage.getItem('album-circle-cloud-session-v1'))?.token || ''; } catch { return ''; } };
  const publish = () => run(async () => { const token = cloudToken(); if (!token) { setNotice('请先连接并登录云端账号，再返回本地模式分享。'); return; } const result = await request('/api/shared', { snapshot: snapshot() }, token); setShare(result); localStorage.setItem('album-circle-latest-share-' + session.user.id, JSON.stringify(result)); setNotice('只读链接已发布。收件人无需账号，任何获得链接的人都可浏览这份快照。'); });
  const revoke = () => run(async () => { const token = cloudToken(); if (!token) throw new Error('请先登录发布该分享的云端账号。'); await request('/api/shared?id=' + share.id, null, token, 'DELETE'); setShare(null); localStorage.removeItem('album-circle-latest-share-' + session.user.id); setNotice('分享链接已撤回。'); });
  const syncCloud = () => run(async () => {
    const token = cloudToken(); if (!token) throw new Error('请先连接并登录云端账号，再返回本地模式同步。');
    const cloudUser = await request('/desktop-cloud/api/auth', null, token, 'GET');
    const key = 'album-circle-sync-' + session.user.id + '-' + room.id + '-' + cloudUser.user.id;
    let target; try { target = JSON.parse(localStorage.getItem(key)); } catch {}
    if (!target) {
      const result = await request('/desktop-cloud/api/rooms', { name: room.name, visibility: 'private', joinMode: 'ownerOnly', slug: 'desktop-' + crypto.randomUUID(), description: '从 Album Circle 本地收藏同步' }, token);
      target = { roomId: result.room.id, itemIds: [], pendingIds: [] }; localStorage.setItem(key, JSON.stringify(target));
    }
    const previous = [...new Set([...(target.itemIds || []), ...(target.pendingIds || []), ...(target.cleanupIds || [])])];
    target.pendingIds = []; target.cleanupIds = previous; localStorage.setItem(key, JSON.stringify(target));
    for (const item of items) {
      const result = await request('/desktop-cloud/api/items?roomId=' + encodeURIComponent(target.roomId), { ...item, action: 'add', source: 'desktop-sync' }, token);
      target.pendingIds.push(result.item.id); localStorage.setItem(key, JSON.stringify(target));
    }
    const failed = [];
    for (const id of previous) { try { await request('/desktop-cloud/api/items?roomId=' + encodeURIComponent(target.roomId) + '&itemId=' + encodeURIComponent(id), null, token, 'DELETE'); } catch (error) { if (error.status !== 404) failed.push(id); } }
    target.itemIds = target.pendingIds; target.pendingIds = failed; target.cleanupIds = []; localStorage.setItem(key, JSON.stringify(target));
    setNotice(failed.length ? '收藏已上传，部分旧同步条目未清理；再次同步可重试。' : '当前收藏已同步到专用云端房间。本地数据保持保留，可切换云端模式查看。');
  });
  const importFile = async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; await run(async () => { if (file.size > 1024 * 1024) throw new Error('收藏文件最多 1 MB。'); const data = JSON.parse(await file.text()); if (data.kind !== 'AlbumCircleCollection' || !Array.isArray(data.items) || data.items.length > 80) throw new Error('请选择 Album Circle 导出的收藏文件，最多 80 条。'); const remap = new Map(); for (const item of data.items) { const result = await request('/api/items?roomId=' + encodeURIComponent(room.id), { ...item, action: 'add', source: 'import' }); remap.set(albumKey(item), albumKey(result.item)); } const source = normalizeLibrary(data.library); library.update((old) => ({ ...old, styles: { ...old.styles, ...Object.fromEntries(Object.entries(source.styles).map(([key, value]) => [remap.get(key) || key, value])) }, genres: { ...old.genres, ...Object.fromEntries(Object.entries(source.genres).map(([key, value]) => [remap.get(key) || key, value])) }, rooms: { ...old.rooms, [room.id]: { ...(source.rooms[data.roomId] || old.rooms[room.id] || {}), boxes: (source.rooms[data.roomId]?.boxes || []).map((box) => ({ ...box, keys: box.keys.map((key) => remap.get(key) || key) })) } } })); await reload(); setNotice('已将收藏加入当前本地房间。'); }); };
  return createPortal(<dialog className="record-dialog collection-dialog" ref={dialog} aria-label="收藏与分享" onCancel={(event) => { event.preventDefault(); close(); }}>
    <header><h2><Library size={20}/>收藏与分享</h2><button type="button" aria-label="关闭收藏与分享" onClick={close}><X/></button></header>
    <p>{local ? '本地收藏保存在这台电脑，无需账号或数据库。搜索音乐与播放平台音源需要联网。' : '当前为云端模式。你的在线房间和本地收藏分别保留。'}</p>
    {local && <form onSubmit={(event) => { event.preventDefault(); run(async () => { await request('/api/items?roomId=' + encodeURIComponent(room.id), { type: 'album', title, artist, year, cover, tracks: tracks.split('\n').map((value) => value.trim()).filter(Boolean), platforms: [], label: '', source: 'manual' }); await reload(); setTitle(''); setArtist(''); setTracks(''); setNotice('专辑已保存到本地。'); }); }}>
      <h3>离线添加专辑</h3><label>专辑名<input aria-label="本地专辑名" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>歌手<input aria-label="本地歌手" required maxLength={160} value={artist} onChange={(event) => setArtist(event.target.value)}/></label><label>发行年份<input maxLength={16} value={year} onChange={(event) => setYear(event.target.value)}/></label><label>封面链接 · 可选<input type="url" value={cover} onChange={(event) => setCover(event.target.value)}/></label><label>曲目 · 每行一首<textarea aria-label="本地曲目" value={tracks} onChange={(event) => setTracks(event.target.value)}/></label><button type="submit" disabled={busy}>保存到本地</button>
    </form>}
    <h3>备份与在线分享</h3><p>分享发布当前房间的专辑、黑胶外观和木屋风格。账号、平台登录、购买记录和其他房间不会包含在链接里；后续修改需重新发布。</p>
    <div className="collection-actions"><button type="button" disabled={busy} onClick={() => downloadBlob(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }), 'Album-Circle-Collection.json')}>导出收藏文件</button>{local && <label>导入收藏<input aria-label="导入收藏文件" type="file" accept=".json" disabled={busy} onChange={importFile}/></label>}<button type="button" disabled={busy} onClick={publish}>发布只读链接</button>{local && <><button type="button" disabled={busy} onClick={syncCloud}>同步到云端房间</button><button type="button" onClick={() => desktopCommand('cloud-connect')}>连接云端账号</button></>}</div>
    {share && <div><input className="collection-share-url" aria-label="展柜分享链接" readOnly value={share.url}/><div className="collection-actions"><button type="button" onClick={() => run(async () => { await navigator.clipboard.writeText(share.url); setNotice('链接已复制。'); })}>复制分享链接</button><a href={share.url} target="_blank" rel="noreferrer">浏览分享</a><button type="button" disabled={busy} onClick={revoke}>撤回分享</button></div></div>}
    {notice && <p role="status">{notice}</p>}<footer><button type="button" onClick={close}>完成</button></footer>
  </dialog>, document.body);
}
