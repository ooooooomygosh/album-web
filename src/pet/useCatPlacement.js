import { useEffect, useLayoutEffect, useRef } from 'react';
import { BUBBLE_OBSTACLES, chooseBubbleOffset, chooseCatSpot } from './bubble-placement.mjs';

const visibleRect = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' ? el.getBoundingClientRect() : null;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.desktopReduceMotion === 'true';
const SHOW_DEBOUNCE = 600;

/** Moves the cat from where it is *seen* (before) to its new layout spot.
 * The animation's overall timing is linear; every keyframe carries its own steps()
 * so the motion stays pixel-stepped but passes through every pose:
 *  jump: [crouch if it still has ground] → takeoff stretch → parabolic arc (apex) →
 *        pre-land stretch → squash → settle;
 *  walk: stepped strides with a 3px bob; reduced motion: 160ms fade swap. */
export function animateCatMove(catEl, before, after, kind, { grounded = true } = {}) {
  const dx = before.left - after.left, dy = before.bottom - after.bottom;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
  catEl.dataset.moving = kind;
  let frames, duration;
  if (kind === 'fade') {
    frames = [{ opacity: 0, easing: 'steps(2, end)' }, { opacity: 1 }]; duration = 160;
  } else if (kind === 'walk') {
    duration = Math.max(320, Math.min(900, Math.abs(dx) * 3.2));
    const strides = Math.max(3, Math.round(duration / 110));
    frames = Array.from({ length: strides + 1 }, (_, i) => ({ translate: `${dx * (1 - i / strides)}px ${i % 2 ? -3 : 0}px`, offset: i / strides, easing: 'steps(2, end)' }));
  } else {
    duration = grounded ? 560 : 480;
    // Without ground under its feet (perch moved/vanished) the cat takes off at once: no hover.
    const lift = grounded ? .16 : 0, land = .8, arc = Math.max(32, Math.abs(dy) * .3 + 22);
    const at = (t) => `${dx * (1 - t)}px ${dy * (1 - t) - arc * 4 * t * (1 - t)}px`;
    const stretch = (t) => t < .25 || t > .75 ? '.9 1.12' : '1 1';
    frames = [
      { translate: at(0), scale: '1 1', offset: 0, easing: 'steps(2, end)' },
      ...(grounded ? [{ translate: at(0), scale: '1.14 .82', offset: lift * .75, easing: 'steps(1, end)' }] : []), // crouch
      ...(grounded ? [0] : []).concat([.15, .3, .45, .5, .55, .7, .85]).map((t) => ({ translate: at(t), scale: t === 0 ? '.88 1.16' : stretch(t), offset: lift + (land - lift) * t, easing: 'steps(3, end)' })), // takeoff → apex (t=.5) → pre-land
      { translate: at(1), scale: '1.18 .8', offset: land, easing: 'steps(2, end)' },        // touch down: squash
      { translate: at(1), scale: '.96 1.05', offset: .92, easing: 'steps(1, end)' },        // rebound
      { translate: at(1), scale: '1 1', offset: 1 }
    ];
    if (!grounded) frames[0] = { ...frames[0], scale: '.88 1.16' };
  }
  const animation = catEl.animate(frames, { duration, easing: 'linear' });
  catEl.__catMove = animation;
  animation.onfinish = animation.oncancel = () => { if (catEl.__catMove === animation) { delete catEl.dataset.moving; catEl.__catMove = null; } };
  return animation;
}

/** Keeps the room cat and its speech bubble off record cells and panels, always on a
 * supporting surface (floor baseline or the console top). Runs after every RoomCat render
 * (2 Hz clock), synchronously when the console resizes (ResizeObserver runs before paint,
 * so a perch that grows never leaves the cat hovering), and when immersive mode starts
 * hiding the console (the cat leaves while it fades, not after). */
export function useCatPlacement(catRef, bubbleRef, enabled = true) {
  const placeRef = useRef(null), moveRef = useRef(null), consoleShownAt = useRef(0);
  useLayoutEffect(() => {
    const place = () => {
      const catEl = catRef.current; if (!catEl || !enabled) return;
      const stage = catEl.closest('.room-scene') || catEl.offsetParent; if (!stage) return;
      const view = stage.getBoundingClientRect(), w = catEl.offsetWidth, h = catEl.offsetHeight;
      const perched = catEl.dataset.perch === 'console';
      const left = view.left + catEl.offsetLeft, top = view.top + catEl.offsetTop;
      const floorBottom = parseFloat(getComputedStyle(catEl).getPropertyValue('--cat-floor')) || 118;
      const floorTop = view.bottom - floorBottom - h;
      const now = { left, right: left + w, top, bottom: top + h };
      const root = document.documentElement, consoleEl = document.querySelector('.room-turntable');
      // The console counts only while it is (and will stay) shown: immersive without hover → gone
      // from the first fade frame; reappearing → only after SHOW_DEBOUNCE.
      const consoleAway = (root.classList.contains('room-zen') && root.dataset.consoleNear !== 'true') || performance.now() - consoleShownAt.current < SHOW_DEBOUNCE;
      const consoleRect = consoleAway ? null : visibleRect(consoleEl);
      const obstacles = [...document.querySelectorAll(BUBBLE_OBSTACLES)].filter((o) => !catEl.contains(o) && !(consoleAway && o === consoleEl)).map(visibleRect).filter(Boolean);
      const bubbleEl = bubbleRef.current;
      let bubble = null;
      if (bubbleEl) { const bw = bubbleEl.offsetWidth, bh = bubbleEl.offsetHeight, cx = (now.left + now.right) / 2; bubble = { left: cx - bw / 2, right: cx + bw / 2, top: now.top - 4 - bh, bottom: now.top - 4 }; }
      const spot = chooseCatSpot({ cat: { ...now, perch: perched }, floorTop, bubble, obstacles, consoleRect, view, home: view.left + view.width * .25 });
      const nextX = Math.round(spot.left - view.left), nextBottom = spot.perch ? Math.round(view.bottom - (spot.top + h)) : null;
      const sameSpot = String(nextX) === catEl.dataset.spotX && spot.perch === perched && (!spot.perch || catEl.style.getPropertyValue('--cat-bottom') === `${nextBottom}px`);
      if (!sameSpot && (Math.abs(spot.left - now.left) > 1 || Math.abs(spot.top - now.top) > 1 || spot.perch !== perched || catEl.dataset.spotX === undefined)) {
        const before = catEl.getBoundingClientRect(), first = catEl.dataset.spotX === undefined;
        // Is there still ground under the cat where it is seen? (floor, or a console top it stands on)
        const liveConsole = visibleRect(consoleEl);
        const grounded = Math.abs(before.bottom - (view.bottom - floorBottom)) <= 2 || Boolean(!consoleAway && liveConsole && Math.abs(before.bottom - liveConsole.top) <= 2);
        moveRef.current?.cancel();
        catEl.dataset.spotX = String(nextX);
        catEl.style.setProperty('--cat-x', `${nextX}px`);
        if (spot.perch) { catEl.dataset.perch = 'console'; catEl.style.setProperty('--cat-bottom', `${nextBottom}px`); }
        else { delete catEl.dataset.perch; catEl.style.removeProperty('--cat-bottom'); }
        if (!first) {
          const after = catEl.getBoundingClientRect(), sameSurface = spot.perch === perched && grounded && Math.abs(after.bottom - before.bottom) < 2;
          moveRef.current = animateCatMove(catEl, before, after, reducedMotion() ? 'fade' : sameSurface ? 'walk' : 'jump', { grounded });
        }
      }
      if (bubbleEl && spot.bubble) { bubbleEl.style.setProperty('--bubble-dx', `${spot.bubble.dx}px`); bubbleEl.style.setProperty('--bubble-dy', `${spot.bubble.dy}px`); bubbleEl.dataset.side = spot.bubble.side; }
    };
    placeRef.current = place; place();
  });
  useEffect(() => {
    let timer = 0, consoleShown = null;
    const later = (ms) => { clearTimeout(timer); timer = setTimeout(() => placeRef.current?.(), ms); };
    const soon = () => later(280); // after the 240ms stepped stage re-fit
    const room = catRef.current?.closest('.cabin-room') || document.body;
    const sizes = new ResizeObserver((entries) => {
      // Console grew/shrank: decide now (this callback runs after layout, before paint).
      if (entries.some((entry) => entry.target.classList.contains('room-turntable'))) { clearTimeout(timer); placeRef.current?.(); }
      else soon();
    });
    const mounts = new MutationObserver(() => { soon(); watch(); });
    const watch = () => room.querySelectorAll('.room-turntable, .room-now-playing, .focus-dock, .room-scene').forEach((element) => sizes.observe(element));
    const modes = new MutationObserver(() => {
      const root = document.documentElement, shown = !root.classList.contains('room-zen') || root.dataset.consoleNear === 'true';
      if (shown === consoleShown) return;
      const initial = consoleShown === null; consoleShown = shown;
      if (shown && !root.classList.contains('room-zen')) { consoleShownAt.current = 0; clearTimeout(timer); placeRef.current?.(); } // left immersive: console is back for good
      else if (shown) { if (!initial) consoleShownAt.current = performance.now(); later(SHOW_DEBOUNCE + 20); } // hover reveal: only return if it stays
      else { clearTimeout(timer); placeRef.current?.(); } // leave as the fade starts
    });
    watch(); mounts.observe(room, { childList: true }); window.addEventListener('resize', soon);
    modes.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-console-near'] });
    return () => { clearTimeout(timer); sizes.disconnect(); mounts.disconnect(); modes.disconnect(); window.removeEventListener('resize', soon); };
  }, []);
}
export { chooseBubbleOffset };
