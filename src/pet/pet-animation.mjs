import { FPS, frameAt } from './pet-model.mjs';

// Wake at sprite boundaries, rather than on every display refresh. This keeps
// a 1–6 fps pixel animation cheap even when the picker shows all five pets.
// The caller supplies lifecycle state; this scheduler stays independent of the DOM.
export function startPetAnimation({
  pose = 'idle', reduceMotion = false, enabled = true, onFrame,
  now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  if (!enabled) return () => {};
  const safePose = Object.hasOwn(FPS, pose) ? pose : 'idle', fps = FPS[safePose];
  let timer, stopped = false, last = -1;
  const draw = () => {
    if (stopped) return;
    const time = now(), index = reduceMotion ? 0 : frameAt(safePose, time);
    if (index !== last) { last = index; onFrame(index); }
    if (!reduceMotion && !stopped) {
      // Recompute against the clock each time: delayed background timers skip
      // missed frames rather than queueing a burst or accumulating drift.
      const current = now(), nextBoundary = (Math.floor(current / 1000 * fps) + 1) * 1000 / fps;
      timer = setTimer(draw, Math.max(1, Math.ceil(nextBoundary - current)));
    }
  };
  draw();
  return () => { stopped = true; clearTimer(timer); };
}
