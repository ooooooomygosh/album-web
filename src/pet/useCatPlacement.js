import { useEffect, useLayoutEffect, useRef } from 'react';
import { BUBBLE_OBSTACLES, chooseBubbleOffset, chooseCatSpot } from './bubble-placement.mjs';

const visibleRect = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' ? el.getBoundingClientRect() : null;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.desktopReduceMotion === 'true';
const STEPS = 'steps(2, end)';

/** Moves the cat from where it is *seen* (before) to its new layout spot with a
 * pixel hop (crouch → arc with stretch → squash on landing), a stepped walk on
 * the same surface, or a quick fade swap under reduced motion. */
export function animateCatMove(catEl, before, after, kind) {
  const dx = before.left - after.left, dy = before.bottom - after.bottom;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
  catEl.dataset.moving = kind;
  let animation;
  if (kind === 'fade') {
    animation = catEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: STEPS });
  } else if (kind === 'walk') {
    const distance = Math.abs(dx), duration = Math.max(320, Math.min(900, distance * 3.2)), hops = Math.max(2, Math.round(duration / 120));
    const frames = Array.from({ length: hops + 1 }, (_, i) => ({ translate: `${dx * (1 - i / hops)}px ${i % 2 ? -3 : 0}px`, offset: i / hops }));
    animation = catEl.animate(frames, { duration, easing: `steps(${Math.max(2, Math.round(duration / 80 / hops))}, end)` });
  } else {
    const arc = Math.max(28, Math.abs(dy) * .35 + 18);
    animation = catEl.animate([
      { translate: `${dx}px ${dy}px`, scale: '1 1', offset: 0 },
      { translate: `${dx}px ${dy}px`, scale: '1.14 .82', offset: .2 },            // crouch (anticipation)
      { translate: `${dx * .5}px ${dy * .5 - arc}px`, scale: '.88 1.14', offset: .55 }, // arc, stretched
      { translate: '0px 0px', scale: '1.16 .84', offset: .82 },                   // land, squash
      { translate: '0px 0px', scale: '1 1', offset: 1 }
    ], { duration: 520, easing: STEPS });
  }
  catEl.__catMove = animation;
  animation.onfinish = animation.oncancel = () => { if (catEl.__catMove === animation) { delete catEl.dataset.moving; catEl.__catMove = null; } };
  return animation;
}

/** Keeps the room cat and its speech bubble off record cells and panels, always on a
 * supporting surface (floor baseline or the console top). Runs after every RoomCat render
 * (2 Hz clock) and when layout/visibility changes. */
export function useCatPlacement(catRef, bubbleRef, enabled = true) {
  const placeRef = useRef(null), moveRef = useRef(null);
  useLayoutEffect(() => {
    const place = () => {
      const catEl = catRef.current; if (!catEl || !enabled) return;
      const stage = catEl.closest('.room-scene') || catEl.offsetParent; if (!stage) return;
      const view = stage.getBoundingClientRect(), w = catEl.offsetWidth, h = catEl.offsetHeight;
      // Target spot from layout values (not the animated frame): left from --cat-x, feet from bottom.
      const perched = catEl.dataset.perch === 'console';
      const left = view.left + catEl.offsetLeft, top = view.top + catEl.offsetTop;
      const floorBottom = parseFloat(getComputedStyle(catEl).getPropertyValue('--cat-floor')) || 118;
      const floorTop = view.bottom - floorBottom - h;
      const now = { left, right: left + w, top, bottom: top + h };
      const obstacles = [...document.querySelectorAll(BUBBLE_OBSTACLES)].filter((o) => !catEl.contains(o)).map(visibleRect).filter(Boolean);
      const consoleRect = visibleRect(document.querySelector('.room-turntable'));
      const bubbleEl = bubbleRef.current;
      let bubble = null;
      if (bubbleEl) { const bw = bubbleEl.offsetWidth, bh = bubbleEl.offsetHeight, cx = (now.left + now.right) / 2; bubble = { left: cx - bw / 2, right: cx + bw / 2, top: now.top - 4 - bh, bottom: now.top - 4 }; }
      const spot = chooseCatSpot({ cat: { ...now, perch: perched }, floorTop, bubble, obstacles, consoleRect, view, home: view.left + view.width * .25 });
      // Compare rounded targets (offsetLeft/Top are integers, the stage rect is fractional).
      const nextX = Math.round(spot.left - view.left), nextBottom = spot.perch ? Math.round(view.bottom - (spot.top + h)) : null;
      const sameSpot = String(nextX) === catEl.dataset.spotX && spot.perch === perched && (!spot.perch || catEl.style.getPropertyValue('--cat-bottom') === `${nextBottom}px`);
      if (!sameSpot && (Math.abs(spot.left - now.left) > 1 || Math.abs(spot.top - now.top) > 1 || spot.perch !== perched || catEl.dataset.spotX === undefined)) {
        const before = catEl.getBoundingClientRect(), first = catEl.dataset.spotX === undefined;
        moveRef.current?.cancel();
        catEl.dataset.spotX = String(Math.round(spot.left - view.left));
        catEl.style.setProperty('--cat-x', `${Math.round(spot.left - view.left)}px`);
        if (spot.perch) { catEl.dataset.perch = 'console'; catEl.style.setProperty('--cat-bottom', `${Math.round(view.bottom - (spot.top + h))}px`); }
        else { delete catEl.dataset.perch; catEl.style.removeProperty('--cat-bottom'); }
        if (!first) {
          const after = catEl.getBoundingClientRect(), sameSurface = spot.perch === perched && Math.abs(after.bottom - before.bottom) < 2;
          moveRef.current = animateCatMove(catEl, before, after, reducedMotion() ? 'fade' : sameSurface ? 'walk' : 'jump');
        }
      }
      if (bubbleEl && spot.bubble) { bubbleEl.style.setProperty('--bubble-dx', `${spot.bubble.dx}px`); bubbleEl.style.setProperty('--bubble-dy', `${spot.bubble.dy}px`); bubbleEl.dataset.side = spot.bubble.side; }
    };
    placeRef.current = place; place();
  });
  // Layout can change without a RoomCat render (console grows when a record loads, focus panel
  // mounts and the stage re-fits, immersive mode hides the console): re-check then. A console
  // that reappears (immersive hover) must stay visible ~600ms before the cat reconsiders it.
  useEffect(() => {
    let timer = 0, consoleShown = null;
    const later = (ms) => { clearTimeout(timer); timer = setTimeout(() => placeRef.current?.(), ms); };
    const soon = () => later(280);
    const room = catRef.current?.closest('.cabin-room') || document.body;
    const sizes = new ResizeObserver(soon), mounts = new MutationObserver(() => { soon(); watch(); });
    const watch = () => room.querySelectorAll('.room-turntable, .room-now-playing, .focus-dock, .room-scene').forEach((element) => sizes.observe(element));
    const modes = new MutationObserver(() => {
      const root = document.documentElement, shown = !root.classList.contains('room-zen') || root.dataset.consoleNear === 'true';
      if (shown === consoleShown) return; consoleShown = shown;
      later(shown ? 600 : 380); // hide: after the stepped fade has finished; show: debounce hover flicker
    });
    watch(); mounts.observe(room, { childList: true }); window.addEventListener('resize', soon);
    modes.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-console-near'] });
    return () => { clearTimeout(timer); sizes.disconnect(); mounts.disconnect(); modes.disconnect(); window.removeEventListener('resize', soon); };
  }, []);
}
export { chooseBubbleOffset };
