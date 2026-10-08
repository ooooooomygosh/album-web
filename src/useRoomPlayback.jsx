import { useEffect, useRef, useState } from 'react';
import { exactTrack, musicRequest } from './room-playback.mjs';
import { trackNames } from './room-model.mjs';

export default function useRoomPlayback(record, trackIndex, provider, onNext) {
  const audio = useRef(null), sequence = useRef(0), remote = useRef(false), next = useRef(onNext), resolveRef = useRef(null);
  next.current = onNext;
  const [state, setState] = useState({ status: 'idle', playing: false, candidates: [], position: 0, duration: 0, error: '', trial: false });
  const [volume, setVolume] = useState(.65);
  const [accountEpoch, setAccountEpoch] = useState(0);
  const update = (value) => setState((old) => ({ ...old, ...value }));
  const resetAudio = (element = audio.current) => { if (element) { element.pause(); element.removeAttribute('src'); element.load(); } };
  useEffect(() => {
    const current = ++sequence.current, controller = new AbortController(), element = audio.current; resetAudio(element);
    update({ status: 'idle', playing: false, candidates: [], position: 0, duration: 0, error: '', trial: false, actualTrack: '' });
    const active = () => sequence.current === current && !controller.signal.aborted;
    async function resolve(candidate) {
      if (!active()) return; update({ status: 'loading', candidates: [], error: '' });
      try {
        const result = await musicRequest('/resolve', candidate, controller.signal); if (!active()) return;
        if (result.remote) { remote.current = true; update({ status: 'loading', remote: true }); }
        else {
          remote.current = false; update({ trial: result.trial, quality: result.quality, remote: false });
          audio.current.src = result.audioPath; audio.current.load();
          await audio.current.play(); // onPlay, not a successful URL, confirms playback.
        }
      } catch (error) { if (active()) update({ status: 'error', playing: false, error: error.name === 'NotAllowedError' ? '请点击播放按钮开始播放。' : error.message }); }
    }
    resolveRef.current = resolve;
    (async () => {
      if (remote.current) { remote.current = false; await musicRequest('/ma/control', { action: 'stop' }).catch(() => {}); }
      if (!record || provider === 'visual' || !active()) return;
      const name = trackNames(record)[trackIndex]; if (!name) { update({ status: 'error', error: '原始资料没有曲目，无法定位音频。' }); return; }
      const exact = exactTrack(record, trackIndex, provider); if (exact) { await resolve(exact); return; }
      update({ status: 'searching' });
      try { const result = await musicRequest(`/search?provider=${provider}&query=${encodeURIComponent(`${record.artist} ${name}`)}`, undefined, controller.signal); if (active()) update({ status: result.candidates.length ? 'choose' : 'error', candidates: result.candidates, error: result.candidates.length ? '' : '未找到可匹配音源，请切换平台或使用动画展示。' }); }
      catch (error) { if (active()) update({ status: 'error', error: error.message }); }
    })();
    return () => { controller.abort(); sequence.current++; resetAudio(element); };
  }, [record?.id, trackIndex, provider, accountEpoch]);
  useEffect(() => { const changed = () => setAccountEpoch((value) => value + 1); window.addEventListener('album-music-account', changed); window.addEventListener('album-music-settings', changed); return () => { window.removeEventListener('album-music-account', changed); window.removeEventListener('album-music-settings', changed); }; }, []);
  useEffect(() => {
    if (provider !== 'ma' || !record) return;
    let disposed = false, busy = false;
    const poll = async () => {
      if (!remote.current || busy) return; busy = true;
      try { const result = await musicRequest('/ma/state'); if (!disposed) update({ playing: result.state === 'playing', status: result.state === 'playing' ? 'playing' : result.state === 'paused' ? 'paused' : 'waiting', position: result.elapsed, duration: result.duration, actualTrack: result.title }); }
      catch (error) { if (!disposed) update({ status: 'error', error: error.message, playing: false }); }
      finally { busy = false; }
    };
    const timer = setInterval(poll, 1500); return () => { disposed = true; clearInterval(timer); };
  }, [provider, record?.id, trackIndex]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  useEffect(() => () => { if (remote.current) musicRequest('/ma/control', { action: 'stop' }).catch(() => {}); }, []);
  const toggle = async () => {
    try {
      if (remote.current) { await musicRequest('/ma/control', { action: state.playing ? 'pause' : 'play' }); return; }
      if (audio.current?.getAttribute('src')) { if (audio.current.paused) await audio.current.play(); else audio.current.pause(); }
      else { const exact = exactTrack(record, trackIndex, provider); if (exact) resolveRef.current?.(exact); }
    } catch (error) { update({ status: 'error', error: error.message }); }
  };
  const events = {
    onPlay: () => { if (audio.current?.getAttribute('src')) update({ playing: true, status: 'playing', error: '' }); }, onPause: () => { if (audio.current?.getAttribute('src')) update({ playing: false, status: 'paused' }); },
    onTimeUpdate: () => update({ position: audio.current.currentTime }), onDurationChange: () => update({ duration: Number.isFinite(audio.current.duration) ? audio.current.duration : 0 }),
    onEnded: () => { update({ playing: false, status: 'ended' }); next.current?.(); },
    onError: () => { if (audio.current?.getAttribute('src')) update({ playing: false, status: 'error', error: '音频加载失败。请重新播放，或检查平台权限与网络。' }); }
  };
  const statusText = state.error || ({ idle: '待播放', loading: '正在连接音源…', searching: '正在匹配原始曲目…', choose: '请选择对应的曲目版本', playing: `${provider === 'ma' ? '服务器播放器正在播放' : '正在播放'}${state.trial ? ' · 试听片段' : ''}`, paused: '播放已暂停', ended: '本曲播放结束', waiting: '等待服务器播放器' }[state.status] || '待播放');
  return { ...state, statusText, audio, events, toggle, choose: (candidate) => resolveRef.current?.(candidate), seek: (value) => { if (audio.current && !remote.current) audio.current.currentTime = value; }, volume, setVolume };
}
