import { useEffect, useState } from 'react';

// The OS preference applies even when the app preference is disabled.
export function useCatMotion(reduceMotion = false, hidden = false) {
  const [visible, setVisible] = useState(() => !document.hidden);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let focused = true;
    const visibility = (event) => {
      if (event?.type === 'blur') focused = false;
      if (event?.type === 'focus') focused = true;
      setVisible(!document.hidden && (Boolean(window.albumWallpaper || window.albumPet) || focused));
    }, motion = () => setSystemReduced(media.matches);
    window.addEventListener('blur', visibility); window.addEventListener('focus', visibility);
    document.addEventListener('visibilitychange', visibility); media.addEventListener('change', motion);
    return () => { window.removeEventListener('blur', visibility); window.removeEventListener('focus', visibility); document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion); };
  }, []);
  return { visible: visible && !hidden, reduced: reduceMotion || systemReduced };
}
