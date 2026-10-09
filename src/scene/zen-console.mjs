/** Immersive mode hides the turntable console completely; bring it back while
 * the pointer is within REACH px of where it sits (html[data-console-near]). */
const REACH = 72;
export function installZenConsoleReveal(win = window) {
  const doc = win.document, root = doc.documentElement;
  let frame = 0, x = -1, y = -1;
  const check = () => {
    frame = 0;
    const panel = root.classList.contains('room-zen') && doc.querySelector('.room-turntable');
    let near = false;
    if (panel) { const r = panel.getBoundingClientRect(); near = x >= r.left - REACH && x <= r.right + REACH && y >= r.top - REACH && y <= r.bottom + REACH; }
    if ((root.dataset.consoleNear === 'true') !== near) { if (near) root.dataset.consoleNear = 'true'; else delete root.dataset.consoleNear; }
  };
  const move = (event) => { x = event.clientX; y = event.clientY; if (!frame) frame = win.requestAnimationFrame(check); };
  const leave = () => { x = y = -1; if (!frame) frame = win.requestAnimationFrame(check); };
  win.addEventListener('pointermove', move, { passive: true }); doc.addEventListener('pointerleave', leave);
  return () => { win.removeEventListener('pointermove', move); doc.removeEventListener('pointerleave', leave); if (frame) win.cancelAnimationFrame(frame); };
}
