import React, { useEffect, useRef, useState } from 'react';
import { onCabinPlayback } from '../scene/playback-listener.mjs';
import './pet-life.css';

/**
 * Wraps a PixelCat with the "alive" layer shared by the room cat, the
 * wallpaper and the desktop pet: breathing, hover perk, poke squish + hearts,
 * drag dangle, Zzz while sleeping, focus dots, celebration sparkles and a
 * music bop whose height/speed follow the player's `cabin:playback` energy.
 * Energy is written to a CSS variable (rAF-coalesced) — no re-render per tick.
 */
export default function PetLife({ pose = 'idle', pokedAt = 0, reduced = false, children }) {
  const root = useRef(null), [burst, setBurst] = useState(0), first = useRef(true);
  useEffect(() => onCabinPlayback(({ playing, energy }) => {
    root.current?.style.setProperty('--pet-energy', String(playing ? Math.max(.15, energy) : .5));
  }), []);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!pokedAt) return;
    setBurst(pokedAt);
    const timer = setTimeout(() => setBurst(0), 950);
    return () => clearTimeout(timer);
  }, [pokedAt]);
  const fx = burst ? ['fx-heart', 3] : pose === 'sleep' ? ['fx-z', 3] : pose === 'focus' ? ['fx-dot', 3] : pose === 'celebrate' ? ['fx-spark', 3] : null;
  return <span ref={root} className={`pet-life ${burst ? 'is-poked' : ''}`} data-pose={pose} data-reduced={String(Boolean(reduced))}>
    {children}
    {fx && <span className="pet-fx" aria-hidden="true" key={burst || pose}>{Array.from({ length: fx[1] }, (_, i) => <i key={i} className={fx[0]}/>)}</span>}
  </span>;
}
