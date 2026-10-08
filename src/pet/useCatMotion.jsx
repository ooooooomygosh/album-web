import { useEffect, useState } from 'react';

// The OS preference applies even when the app preference is disabled.
export function useCatMotion(reduceMotion = false, hidden = false) {
  const [visible, setVisible] = useState(() => !document.hidden);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const visibility = () => setVisible(!document.hidden), motion = () => setSystemReduced(media.matches);
    document.addEventListener('visibilitychange', visibility); media.addEventListener('change', motion);
    return () => { document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion); };
  }, []);
  return { visible: visible && !hidden, reduced: reduceMotion || systemReduced };
}
