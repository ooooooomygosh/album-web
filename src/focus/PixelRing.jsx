import React from 'react';

// A ring of square "pixels" that light up clockwise as the phase advances.
// Squares stay axis-aligned so the ring reads like a sprite, not a vector arc.
const SEGMENTS = 36, RADIUS = 44, SIZE = 6;
const POINTS = Array.from({ length: SEGMENTS }, (_, index) => {
  const angle = (index / SEGMENTS) * Math.PI * 2 - Math.PI / 2;
  return [Math.round((50 + Math.cos(angle) * RADIUS - SIZE / 2) * 2) / 2, Math.round((50 + Math.sin(angle) * RADIUS - SIZE / 2) * 2) / 2];
});

export default function PixelRing({ progress = 0, running = false, children }) {
  const lit = Math.round(Math.max(0, Math.min(1, progress)) * SEGMENTS);
  return <div className={`focus-ring ${running ? 'is-running' : ''}`}>
    <svg className="focus-ring-track" viewBox="0 0 100 100" aria-hidden="true" shapeRendering="crispEdges">
      {POINTS.map(([x, y], index) => <rect key={index} x={x} y={y} width={SIZE} height={SIZE} className={index < lit ? 'is-lit' : index === lit && running ? 'is-head' : ''}/>)}
    </svg>
    <div className="focus-ring-face">{children}</div>
  </div>;
}
