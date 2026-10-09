// Desktop pet/wallpaper windows intentionally stay animated without keyboard
// focus. All surfaces still stop work while hidden or explicitly disabled.
export function petMotionState({ hidden = false, focused = true, desktop = false, reduced = false } = {}) {
  return { visible: !hidden && (desktop || focused), reduced: Boolean(reduced) };
}
export function readPetMotion(win = globalThis.window, doc = globalThis.document, media) {
  return petMotionState({
    hidden: Boolean(doc?.hidden), focused: doc?.hasFocus?.() ?? true,
    desktop: Boolean(win?.albumWallpaper || win?.albumPet), reduced: media?.matches,
  });
}
export function subscribePetMotion(apply, win = globalThis.window, doc = globalThis.document) {
  const media = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  let focused = doc?.hasFocus?.() ?? true;
  const update = (event) => {
    if (event?.type === 'blur') focused = false;
    if (event?.type === 'focus') focused = true;
    apply(petMotionState({ hidden: Boolean(doc?.hidden), focused,
      desktop: Boolean(win?.albumWallpaper || win?.albumPet), reduced: media?.matches }));
  };
  win?.addEventListener?.('blur', update); win?.addEventListener?.('focus', update);
  doc?.addEventListener?.('visibilitychange', update); media?.addEventListener?.('change', update);
  update();
  return () => {
    win?.removeEventListener?.('blur', update); win?.removeEventListener?.('focus', update);
    doc?.removeEventListener?.('visibilitychange', update); media?.removeEventListener?.('change', update);
  };
}
