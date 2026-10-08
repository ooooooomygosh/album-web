import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from './icons';

// Shared modal frame in the cabin style. Escape and the close button both
// call `close`; focus returns to whatever opened the dialog.
export default function Dialog({ title, icon, close, className = '', children, wide = false, label }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement; dialog.current.showModal();
    return () => previous?.focus?.({ preventScroll: true });
  }, []);
  return createPortal(<dialog ref={dialog} className={`cabin-dialog ${wide ? 'is-wide' : ''} ${className}`} aria-label={label || title} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === dialog.current) close(); }}>
    <header className="cabin-dialog-header"><h2>{icon}{title}</h2><button type="button" className="cabin-dialog-close" aria-label={`关闭${title}`} onClick={close}><X/></button></header>
    <div className="cabin-dialog-body">{children}</div>
  </dialog>, document.body);
}
