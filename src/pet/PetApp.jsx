import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PixelCat, { opaqueAt } from './PixelCat';
import { useCatBehaviour } from './RoomCat';
import './pet.css';

// The desktop pet: a transparent always-on-top window. Clicks pass through
// everywhere except the painted cat pixels and the speech bubble.
function PetApp() {
  const api = window.albumPet, [snapshot, setSnapshot] = useState(null), [size, setSize] = useState(192);
  const cat = useCatBehaviour({ focus: snapshot?.focus || {}, playing: Boolean(snapshot?.playing), track: snapshot?.track || '', lastActivity: 0, reduceMotion: Boolean(snapshot?.reduceMotion) });
  const box = useRef(null), frame = useRef(0), hit = useRef(false), drag = useRef(null), [dragging, setDragging] = useState(false);
  useEffect(() => {
    let alive = true;
    api?.getSnapshot().then((value) => { if (alive && value) { setSnapshot(value.companion); setSize(value.size); } });
    const off = api?.onSnapshot((value) => { if (value.companion) setSnapshot(value.companion); if (value.size) setSize(value.size); });
    return () => { alive = false; off?.(); };
  }, []);
  useEffect(() => { document.documentElement.style.setProperty('--pet-size', size + 'px'); }, [size]);
  const pose = cat.pose, accessory = snapshot?.focus?.accessory || '';
  const overCat = (event) => {
    const rect = box.current?.getBoundingClientRect(); if (!rect) return false;
    return opaqueAt(pose, frame.current, accessory, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  };
  useEffect(() => {
    const move = (event) => {
      if (drag.current) return;
      const next = overCat(event) || Boolean(event.target.closest?.('.pet-bubble'));
      if (next !== hit.current) { hit.current = next; api?.setHit(next); }
    };
    const leave = () => { if (hit.current && !drag.current) { hit.current = false; api?.setHit(false); } };
    document.addEventListener('pointermove', move); document.addEventListener('pointerleave', leave);
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); };
  }, [pose, accessory]);
  const down = (event) => {
    if (event.button !== 0 || !overCat(event)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.screenX, y: event.screenY, moved: 0 };
  };
  const moveDrag = (event) => {
    const current = drag.current; if (!current) return;
    const dx = event.screenX - current.x, dy = event.screenY - current.y; if (!dx && !dy) return;
    current.x = event.screenX; current.y = event.screenY; current.moved += Math.abs(dx) + Math.abs(dy);
    if (current.moved > 3) { if (!dragging) setDragging(true); api?.moveBy(dx, dy); }
  };
  const up = () => {
    const current = drag.current; drag.current = null; setDragging(false);
    if (!current) return;
    if (current.moved > 3) api?.dragEnd(); else cat.poke();
  };
  return <div className="pet-stage" onContextMenu={(event) => { event.preventDefault(); api?.menu(); }}>
    {cat.bubble && <div className="pet-bubble" role="status" onClick={() => api?.open()}>{cat.bubble}</div>}
    <div ref={box} style={{ transform: `translateX(${dragging ? 0 : cat.x}px)` }} className={`pet-cat ${dragging ? 'is-dragging' : ''}`} onPointerDown={down} onPointerMove={moveDrag} onPointerUp={up} onPointerCancel={up} onDoubleClick={(event) => { if (overCat(event)) api?.open(); }}>
      <PixelCat pose={pose} accessory={accessory} skin={snapshot?.focus?.catSkin} reduceMotion={cat.reduced} onFrame={(index) => { frame.current = index; }}/>
    </div>
  </div>;
}
createRoot(document.getElementById('root')).render(<PetApp/>);
