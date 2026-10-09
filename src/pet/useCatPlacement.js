import { useEffect, useLayoutEffect, useRef } from 'react';
import { BUBBLE_OBSTACLES, chooseBubbleOffset, chooseCatSpot } from './bubble-placement.mjs';

/** Keeps the room cat and its speech bubble off record cells and panels.
 * Runs after every RoomCat render (2 Hz clock) and on resize; cheap rect reads. */
export function useCatPlacement(catRef, bubbleRef, enabled = true) {
  const placeRef = useRef(null);
  useLayoutEffect(() => {
    const place = () => {
      const catEl = catRef.current; if (!catEl || !enabled) return;
      const stage = catEl.closest('.room-scene') || catEl.offsetParent; if (!stage) return;
      const view = stage.getBoundingClientRect(), measured = catEl.getBoundingClientRect(), w = catEl.offsetWidth, h = catEl.offsetHeight;
      // Evaluate the *target* spot, not a mid-transition frame (left steps over 320 ms).
      const perched = catEl.dataset.perch === 'console';
      if (!perched) catEl.dataset.floorTop = String(measured.top - view.top);
      const targetX = catEl.dataset.spotX !== undefined ? view.left + Number(catEl.dataset.spotX) : measured.left;
      const floorTop = view.top + Number(catEl.dataset.floorTop ?? measured.top - view.top);
      const now = { left: targetX, right: targetX + w, top: measured.top, bottom: measured.top + h };
      const obstacles = [...document.querySelectorAll(BUBBLE_OBSTACLES)].filter((o) => !catEl.contains(o) && o.getClientRects().length && getComputedStyle(o).visibility !== 'hidden').map((o) => o.getBoundingClientRect());
      const consoleEl = document.querySelector('.room-turntable'), consoleRect = consoleEl && consoleEl.getClientRects().length && getComputedStyle(consoleEl).visibility !== 'hidden' ? consoleEl.getBoundingClientRect() : null;
      const bubbleEl = bubbleRef.current;
      let bubble = null;
      // Default spot computed from layout sizes (offsetWidth ignores translate/scale animations):
      // centred above the cat's target rect, 4px gap (see .room-cat-bubble translate).
      if (bubbleEl) { const bw = bubbleEl.offsetWidth, bh = bubbleEl.offsetHeight, cx = (now.left + now.right) / 2; bubble = { left: cx - bw / 2, right: cx + bw / 2, top: now.top - 4 - bh, bottom: now.top - 4 }; }
      const spot = chooseCatSpot({ cat: { left: now.left, right: now.right, top: now.top, bottom: now.bottom, perch: perched }, floorTop, bubble, obstacles, consoleRect, view, home: view.left + view.width * .25 });
      if (Math.abs(spot.left - now.left) > .5 || Math.abs(spot.top - now.top) > .5 || spot.perch !== perched) {
        catEl.dataset.spotX = String(Math.round(spot.left - view.left));
        catEl.style.setProperty('--cat-x', `${Math.round(spot.left - view.left)}px`);
        if (spot.perch) { catEl.dataset.perch = 'console'; catEl.style.setProperty('--cat-bottom', `${Math.round(view.bottom - (spot.top + h))}px`); }
        else { delete catEl.dataset.perch; catEl.style.removeProperty('--cat-bottom'); }
      }
      if (bubbleEl && spot.bubble) { bubbleEl.style.setProperty('--bubble-dx', `${spot.bubble.dx}px`); bubbleEl.style.setProperty('--bubble-dy', `${spot.bubble.dy}px`); bubbleEl.dataset.side = spot.bubble.side; }
    };
    placeRef.current = place; place();
  });
  // Layout can change without a RoomCat render (console grows when a record loads, focus panel
  // mounts and the stage re-fits, window resizes): re-check then, after the 240ms stage step.
  useEffect(() => {
    let timer = 0;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => placeRef.current?.(), 280); };
    const room = catRef.current?.closest('.cabin-room') || document.body;
    const sizes = new ResizeObserver(soon), mounts = new MutationObserver(() => { soon(); watch(); });
    const watch = () => room.querySelectorAll('.room-turntable, .room-now-playing, .focus-dock, .room-scene').forEach((element) => sizes.observe(element));
    watch(); mounts.observe(room, { childList: true }); window.addEventListener('resize', soon);
    return () => { clearTimeout(timer); sizes.disconnect(); mounts.disconnect(); window.removeEventListener('resize', soon); };
  }, []);
}
export { chooseBubbleOffset };
