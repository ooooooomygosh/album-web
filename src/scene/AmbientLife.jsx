import React from 'react';
import './ambient-life.css';

// Deterministic layout so screenshots and the wallpaper are stable.
const MOTES = Array.from({ length: 14 }, (_, i) => {
  const r = (n) => ((Math.sin((i + 1) * 12.9898 * n) * 43758.5453) % 1 + 1) % 1;
  return { left: 8 + r(1) * 84, top: 18 + r(2) * 60, delay: -r(3) * 14, duration: 10 + r(4) * 8, size: r(5) > .7 ? 2 : 1 };
});

/** Quiet room life layered over the artwork: drifting dust in the lamp light
 *  and a slow window light shaft that follows the time of day. CSS-only
 *  animation (transform/opacity, stepped), nothing runs per frame in JS. */
export default function AmbientLife() {
  return <div className="ambient-life" aria-hidden="true">
    <span className="ambient-shaft"/>
    {MOTES.map((m, i) => <i key={i} className={`ambient-mote size-${m.size}`} style={{ left: `${m.left}%`, top: `${m.top}%`, animationDelay: `${m.delay}s`, animationDuration: `${m.duration}s` }}/>)}
  </div>;
}
