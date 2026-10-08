import React, { useEffect, useRef } from 'react';
import { catFrame, drawFrame, SIZE } from './cat-sprites.mjs';
import { useCatMotion } from './useCatMotion';
import { frameAt } from './pet-model.mjs';

const cache = new Map();
export function cachedFrame(pose, index, accessory) {
  const key = `${pose}:${index}:${accessory}`;
  if (!cache.has(key)) cache.set(key, catFrame(pose, index, accessory));
  return cache.get(key);
}
// True when the sprite pixel under a point (0..1 relative) is painted.
export function opaqueAt(pose, index, accessory, rx, ry) {
  const x = Math.floor(rx * SIZE), y = Math.floor(ry * SIZE);
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE && Boolean(cachedFrame(pose, index, accessory)[y][x]);
}

export default function PixelCat({ pose = 'idle', accessory = '', skin = 'orange', reduceMotion = false, className = '', label = '像素小猫', onFrame, ...props }) {
  const motion = useCatMotion(reduceMotion);
  const canvas = useRef(null), state = useRef({ pose, accessory, frame: -1 });
  state.current.pose = pose; state.current.accessory = accessory;
  useEffect(() => {
    if (!motion.visible) return;
    const context = canvas.current.getContext('2d'); context.imageSmoothingEnabled = false;
    let raf, last = '';
    const draw = (time) => {
      const { pose: p, accessory: a } = state.current, index = motion.reduced ? 0 : frameAt(p, time), key = `${p}:${index}:${a}`;
      if (key !== last) { drawFrame(context, cachedFrame(p, index, a), 1, skin); last = key; state.current.frame = index; onFrame?.(index); }
      if (!motion.reduced && motion.visible) raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [motion.reduced, motion.visible, pose, accessory, skin]);
  return <canvas ref={canvas} className={`pixel-cat ${className}`} width={SIZE} height={SIZE} role="img" aria-label={label} data-reduced-motion={motion.reduced} data-skin={skin} data-pose={pose} data-accessory={accessory} {...props}/>;
}
