import React, { useEffect, useId, useState } from 'react';
import { PURCHASE_STORAGE_KEY, purchaseAlbumKey, readPurchases, validPurchase } from './purchase-records.mjs';
import { useDesktopAppearance } from './desktop-client';

function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export default function PurchaseRecord({ item }) {
  const key = purchaseAlbumKey(item), dateId = useId(), formatId = useId();
  const appearance = useDesktopAppearance();
  const enabled = !appearance.client || appearance.showPurchases;
  const [record, setRecord] = useState(() => readPurchases(localStorage)[key] || null);
  const [editing, setEditing] = useState(false), [date, setDate] = useState(record?.date || today()), [format, setFormat] = useState(record?.format || 'cd'), [error, setError] = useState('');
  useEffect(() => {
    const update = () => { setRecord(readPurchases(localStorage)[key] || null); setEditing(false); };
    update(); window.addEventListener('album-purchases-updated', update); window.addEventListener('storage', update);
    return () => { window.removeEventListener('album-purchases-updated', update); window.removeEventListener('storage', update); };
  }, [key]);
  useEffect(() => {
    if (!enabled) setEditing(false);
  }, [enabled]);
  if (!enabled || item.type !== 'album') return null;
  const write = (next) => {
    try {
      const records = readPurchases(localStorage); if (next) records[key] = next; else delete records[key];
      const data = JSON.stringify(records); if (data.length > 512000) throw new Error('购买记录空间已满。');
      localStorage.setItem(PURCHASE_STORAGE_KEY, data); setError(''); window.dispatchEvent(new Event('album-purchases-updated'));
    } catch { setError('无法保存到本机，请检查可用存储空间后重试。'); }
  };
  const edit = () => { setDate(record?.date || today()); setFormat(record?.format || 'cd'); setError(''); setEditing(true); };
  return <div className="purchase-record" data-purchase-key={key} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    {!editing ? <div className="purchase-summary">{record && <span className="purchase-badge">已购 · {record.format === 'cd' ? 'CD' : '黑胶'} · <time dateTime={record.date}>{record.date}</time></span>}<button type="button" className="purchase-edit" onClick={edit}>{record ? '编辑购买记录' : '记录购买'}</button></div> :
      <form className="purchase-form" onSubmit={(event) => { event.preventDefault(); const next = { date, format }; if (validPurchase(next)) write(next); else setError('请选择有效的购买日期和形式。'); }}>
        <label htmlFor={dateId}>购买日期<input id={dateId} aria-label="购买日期" type="date" value={date} required onChange={(event) => setDate(event.target.value)} /></label>
        <label htmlFor={formatId}>购买形式<select id={formatId} aria-label="购买形式" value={format} onChange={(event) => setFormat(event.target.value)}><option value="cd">CD</option><option value="vinyl">黑胶</option></select></label>
        <div className="purchase-form-actions"><button type="submit">保存购买记录</button><button type="button" onClick={() => setEditing(false)}>取消</button>{record && <button type="button" className="purchase-remove" onClick={() => write(null)}>删除记录</button>}</div>
      </form>}
    {error && <p className="purchase-error" role="alert">{error}</p>}
  </div>;
}
