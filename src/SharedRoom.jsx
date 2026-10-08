import { useEffect, useState } from 'react';
import { RecordLibraryProvider } from './RecordLibrary';
import CabinRoom from './CabinRoom';
import CoverflowShowroom from './CoverflowShowroom';
import ImmersiveDetail from './ImmersiveDetail';
export default function SharedRoom({ id }) {
  const [snapshot, setSnapshot] = useState(null), [error, setError] = useState(''), [detail, setDetail] = useState(null), [style, setStyle] = useState('original');
  useEffect(() => { const controller = new AbortController(); fetch('/api/shared?id=' + encodeURIComponent(id), { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setSnapshot(data.snapshot); setStyle(data.snapshot.appearance.showroom); }).catch((error) => { if (error.name !== 'AbortError') setError(error.message); }); return () => controller.abort(); }, [id]);
  if (!snapshot) return <main className="shared-loading"><h1>Album Circle</h1><p>{error || '正在打开朋友的音乐展柜…'}</p><a href="/">打开 Album Circle</a></main>;
  const openItem = (id) => setDetail(snapshot.items.find((item) => item.id === id));
  return <RecordLibraryProvider userId="shared-viewer" roomId="shared" initialData={snapshot.library} readOnly><main className={`app shared-app ${snapshot.appearance.reduceMotion ? 'reduce-motion' : ''}`}>
    <header className="topbar glass-panel"><strong>{snapshot.name}</strong><span>朋友分享的展柜 · 只读</span><label className="web-showroom-picker">展柜风格<select aria-label="展柜风格" value={style} onChange={(event) => setStyle(event.target.value)}><option value="original">原始展柜</option><option value="room">温馨木屋</option><option value="coverflow">Coverflow</option></select></label><a href="https://github.com/ooooooomygosh/album-web/releases/latest">下载客户端</a></header>
    <section className={'panel-content cabinet-page showroom-' + style}>
      {style === 'room' ? <CabinRoom items={snapshot.items} roomName={snapshot.name} openItemDetail={openItem} setMode={() => {}} loading={false}/> : style === 'coverflow' ? <CoverflowShowroom items={snapshot.items} openItemDetail={openItem} setMode={() => {}} loading={false} reduceMotion={snapshot.appearance.reduceMotion}/> : <div className="shared-album-grid">{snapshot.items.map((item) => <button key={item.id} onClick={() => openItem(item.id)}>{item.cover && <img src={item.cover} alt={item.title}/>}<strong>{item.title}</strong><span>{item.artist}</span></button>)}</div>}
    </section>{detail && <ImmersiveDetail item={detail} profile={detail.aiProfile} onClose={() => setDetail(null)}/>}
  </main></RecordLibraryProvider>;
}
