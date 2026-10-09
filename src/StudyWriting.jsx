import React, { useEffect, useRef, useState } from 'react';
import { useDesktopAppearance } from './desktop-client';

// Authored finger poses, not transforms of a rectangle from the background.
// Write for a while, lift, thumb-around, catch, then put the tip back on paper.
export const WRITING_TIMELINE = [
  ...Array.from({ length: 5 }, () => [0, 1, 2, 3, 4, 5].map((frame) => [frame, 150])).flat(),
  [6, 420], [7, 160], [8, 120], [9, 120], [10, 120], [11, 170],
  [12, 200], [13, 180], [14, 180], [15, 350]
];
export default function StudyWriting() {
  const { reduceMotion } = useDesktopAppearance();
  const hand = useRef(null), [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const images = ['/room-scenes/night-study-clean-pixel.png', '/room-scenes/night-study-hands-pixel.png'].map((src) => {
      const image = new Image(); image.src = src; return image.decode();
    });
    Promise.all(images).then(() => { if (alive) setReady(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!ready || reduceMotion) return;
    let raf, start, previous = -1;
    const total = WRITING_TIMELINE.reduce((sum, [, duration]) => sum + duration, 0);
    const paint = (now) => {
      start ??= now;
      let elapsed = (now - start) % total, frame = 0;
      for (const [pose, duration] of WRITING_TIMELINE) { frame = pose; if (elapsed < duration) break; elapsed -= duration; }
      if (frame !== previous && hand.current) {
        previous = frame; hand.current.style.backgroundPosition = `${frame % 4 / 3 * 100}% ${Math.floor(frame / 4) / 3 * 100}%`;
        hand.current.dataset.pose = String(frame);
      }
      raf = requestAnimationFrame(paint);
    };
    const visibility = () => { cancelAnimationFrame(raf); if (!document.hidden) { start = undefined; raf = requestAnimationFrame(paint); } };
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visibility); };
  }, [ready, reduceMotion]);
  // Original supplied artwork remains visible if either generated asset is missing.
  return ready ? <div className="study-writing" aria-hidden="true" data-animation={reduceMotion ? 'still' : 'writing-and-spin'}>
    <img className="study-clean-plate" src="/room-scenes/night-study-clean-pixel.png" alt="" draggable="false"/>
    <span ref={hand} className="study-writing-hand" data-pose="0" style={reduceMotion ? { backgroundPosition: '0% 0%' } : undefined}/>
  </div> : null;
}
