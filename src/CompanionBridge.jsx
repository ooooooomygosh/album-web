import { useEffect, useRef } from 'react';
import { useFocus } from './focus/useFocus';
import { useSoundscape } from './audio/useSoundscape';
import { focusSnapshot } from './focus/focus-model.mjs';

// Read by the desktop shell for the wallpaper and the desktop pet. It holds
// display data only: no session, platform cookies or audio URLs.
export default function CompanionBridge() {
  const focus = useFocus(), sound = useSoundscape(), latest = useRef({});
  latest.current = { focus, sound };
  useEffect(() => {
    const getter = () => {
      const { focus: f, sound: s } = latest.current, room = window.albumRoomSnapshot?.() || null;
      return {
        room,
        petId: room?.petId || 'cat',
        focus: f ? focusSnapshot(f.state, Date.now()) : null,
        sound: s ? { enabled: s.enabled, lofi: s.lofiState === 'playing' } : null,
        playing: Boolean(room?.grooving || (s?.lofiState === 'playing')),
        track: room?.track || ''
      };
    };
    window.albumCompanionSnapshot = getter;
    return () => { if (window.albumCompanionSnapshot === getter) delete window.albumCompanionSnapshot; };
  }, []);
  return null;
}
