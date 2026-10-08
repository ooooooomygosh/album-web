import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createAmbience, normalizeMix, SOUND_KEY } from './ambience.mjs';

const SoundContext = createContext(null);
const readMix = () => { try { return normalizeMix(JSON.parse(localStorage.getItem(SOUND_KEY) || '{}')); } catch { return normalizeMix(); } };

// Ambience and the generated lo-fi stream live above the room, so they keep
// playing while the user browses other pages. Nothing starts without a click.
export function SoundscapeProvider({ children }) {
  const [mix, setMix] = useState(readMix);
  const [enabled, setEnabled] = useState(false);
  const [section, setSection] = useState(null), [lofiState, setLofiState] = useState('off'), [error, setError] = useState('');
  const [ducked, setDucked] = useState(false);
  const engine = useRef({ context: null, ambience: null, lofi: null, lofiLoading: null });
  const save = (next) => { const value = normalizeMix(next); setMix(value); try { localStorage.setItem(SOUND_KEY, JSON.stringify(value)); } catch {} return value; };
  const ensureContext = async () => {
    const current = engine.current;
    if (!current.context) {
      current.context = new (window.AudioContext || window.webkitAudioContext)();
      current.ambience = createAmbience(current.context);
    }
    if (current.context.state === 'suspended') await current.context.resume().catch(() => {});
    return current;
  };
  const startLofi = async () => {
    const current = engine.current;
    if (current.lofi || current.lofiLoading) return;
    setLofiState('loading'); setError('');
    current.lofiLoading = import('./lofi-engine.mjs').then(({ createLofiPlayer }) => createLofiPlayer({ onSection: setSection }))
      .then((player) => { current.lofi = player; player.setVolume(mix.lofi * mix.master); player.setDuck(ducked); player.start(); setLofiState('playing'); })
      .catch(() => { setError('Lofi 生成器无法启动，请检查系统音频。'); setLofiState('off'); })
      .finally(() => { current.lofiLoading = null; });
  };
  const stopLofi = () => { engine.current.lofi?.dispose(); engine.current.lofi = null; setLofiState('off'); setSection(null); };
  useEffect(() => {
    const { ambience } = engine.current;
    if (!ambience) return;
    for (const [id, volume] of Object.entries(mix.tracks)) ambience.set(id, enabled ? volume : 0);
    ambience.setMaster(mix.master);
  }, [mix, enabled]);
  useEffect(() => {
    if (!enabled || !mix.lofiOn) { if (engine.current.lofi || engine.current.lofiLoading) stopLofi(); return; }
    if (engine.current.lofi) engine.current.lofi.setVolume(mix.lofi * mix.master); else startLofi();
  }, [enabled, mix.lofiOn, mix.lofi, mix.master]);
  useEffect(() => { engine.current.lofi?.setDuck(ducked); }, [ducked]);
  useEffect(() => () => { const current = engine.current; current.lofi?.dispose(); current.ambience?.stop(); current.context?.close().catch(() => {}); }, []);
  useEffect(() => {
    // Commands from the desktop pet, and automatic start with a focus round.
    const command = (event) => { if (event.detail?.command === 'sound-toggle') toggle(); };
    const phase = (event) => { if (event.detail?.autoSound && event.detail.phase === 'focus') turnOn(); };
    window.addEventListener('album-companion-command', command); window.addEventListener('album-focus-start', phase);
    return () => { window.removeEventListener('album-companion-command', command); window.removeEventListener('album-focus-start', phase); };
  });
  const turnOn = async () => { await ensureContext(); setEnabled(true); };
  const toggle = async () => { if (enabled) setEnabled(false); else await turnOn(); };
  const value = {
    mix, enabled, section, lofiState, error, ducked,
    toggle, turnOn, setDucked,
    setTrack: async (id, volume) => { const next = save({ ...mix, tracks: { ...mix.tracks, [id]: volume } }); if (volume > 0 && !enabled) await turnOn(); return next; },
    setMaster: (volume) => save({ ...mix, master: volume }),
    setLofi: async (on) => { save({ ...mix, lofiOn: on }); if (on && !enabled) await turnOn(); },
    setLofiVolume: (volume) => save({ ...mix, lofi: volume }),
    skipSection: () => { stopLofi(); setTimeout(startLofi, 450); }
  };
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
export function useSoundscape() { return useContext(SoundContext); }
