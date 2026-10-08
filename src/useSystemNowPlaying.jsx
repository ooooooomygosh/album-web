import { useEffect, useRef, useState } from 'react';
import { musicRequest } from './room-playback.mjs';

// Mirrors the operating system's current media session (Spotify, NetEase
// Cloud Music, Apple Music…) onto the turntable. Audio stays in that player.
export default function useSystemNowPlaying(active) {
  const [state, setState] = useState({ available: true, active: false }), [error, setError] = useState('');
  const busy = useRef(false);
  const refresh = async () => {
    if (busy.current) return; busy.current = true;
    try { const value = await musicRequest('/now-playing'); setState(value); setError(value.error || ''); }
    catch (cause) { setError(cause.message); }
    finally { busy.current = false; }
  };
  useEffect(() => {
    if (!active) return;
    refresh(); const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, [active]);
  const control = async (action) => {
    try { await musicRequest('/now-playing/control', { action }); setTimeout(refresh, 350); }
    catch (cause) { setError(cause.message); }
  };
  const item = state.active ? { id: `system:${state.artist}:${state.album || state.title}`, type: 'album', title: state.album || state.title, artist: state.albumArtist || state.artist, cover: state.artwork || '', tracks: [state.title] } : null;
  const statusText = error || (!state.available ? '这台电脑暂不支持读取系统播放器。' : !state.active ? '打开 Spotify、网易云音乐等播放器开始播放，唱机会自动同步。' : `${state.app} · ${state.playing ? '正在播放' : '已暂停'}`);
  return { ...state, item, error, statusText, control, refresh };
}
