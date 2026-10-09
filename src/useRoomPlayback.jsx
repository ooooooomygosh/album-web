import { useEffect, useRef, useState } from 'react';
import { findPlayableSource, musicRequest } from './room-playback.mjs';
import { trackNames } from './room-model.mjs';

export default function useRoomPlayback(record, trackIndex, provider, onNext) {
  const audio = useRef(null), sequence = useRef(0), remote = useRef(false), next = useRef(onNext), resolveRef = useRef(null), controlling = useRef(false);
  next.current = onNext;
  const [state, setState] = useState({ status: 'idle', playing: false, candidates: [], position: 0, duration: 0, error: '', trial: false });
  const [volume, setVolume] = useState(.65);
  const [accountEpoch, setAccountEpoch] = useState(0);
  const update = (value) => setState((old) => ({ ...old, ...value }));
  const resetAudio = (element = audio.current) => { if (element) { element.pause(); element.removeAttribute('src'); element.load(); } };
  useEffect(() => {
    const current = ++sequence.current, controller = new AbortController(), element = audio.current; resetAudio(element);
    update({ status: 'idle', playing: false, candidates: [], position: 0, duration: 0, error: '', trial: false, actualTrack: '', remote: false, quality: '' });
    const active = () => sequence.current === current && !controller.signal.aborted;
    let resolution = 0;
    const request = (path, value) => musicRequest(path, value, controller.signal);
    async function play(candidate, result) {
      if (!active()) return;
      if (result.remote) { remote.current = true; update({ status: 'loading', remote: true, resolvedProvider: candidate.provider }); }
      else {
        remote.current = false;
        update({ playing: false, status: 'loading', error: '', trial: result.trial, quality: result.quality, remote: false, resolvedProvider: candidate.provider, actualTrack: candidate.title });
        element.src = result.audioPath; element.load();
        let timer;
        try { await Promise.race([element.play(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('音频连接超时。')), 10000); })]); }
        catch (error) { if (active()) resetAudio(element); throw error; }
        finally { clearTimeout(timer); }
      }
    }
    async function resolve(candidate) {
      if (!active()) return;
      const request = ++resolution;
      const latest = () => active() && request === resolution;
      resetAudio(element); update({ status: 'loading', candidates: [], error: '' });
      try {
        const result = await musicRequest('/resolve', candidate, controller.signal); if (!latest()) return;
        await play(candidate, result);
      } catch (error) { if (latest()) update({ status: 'error', playing: false, error: error.name === 'NotAllowedError' ? '请点击播放按钮开始播放。' : error.message }); }
    }
    resolveRef.current = resolve;
    (async () => {
      if (remote.current) { remote.current = false; await musicRequest('/ma/control', { action: 'stop' }).catch(() => {}); }
      if (!record || provider === 'visual' || provider === 'system' || !active()) return;
      const name = trackNames(record)[trackIndex]; if (!name) { update({ status: 'error', error: '原始资料没有曲目，无法定位音频。' }); return; }
      update({ status: 'searching' });
      try {
        const result = await findPlayableSource({ record, index: trackIndex, provider, request, play, isCurrent: active });
        if (active() && result?.error) update({ status: 'error', playing: false, candidates: result.candidates, error: result.error });
      }
      catch (error) { if (active()) update({ status: 'error', playing: false, error: error.name === 'NotAllowedError' ? '请点击播放按钮开始播放。' : error.message }); }
    })();
    return () => { controller.abort(); sequence.current++; resetAudio(element); };
  }, [record?.id, trackIndex, provider, accountEpoch]);
  useEffect(() => { const changed = () => setAccountEpoch((value) => value + 1); window.addEventListener('album-music-account', changed); window.addEventListener('album-music-settings', changed); return () => { window.removeEventListener('album-music-account', changed); window.removeEventListener('album-music-settings', changed); }; }, []);
  useEffect(() => {
    if (provider !== 'ma' || !record) return;
    let disposed = false, busy = false;
    const current = sequence.current;
    const poll = async () => {
      if (!remote.current || busy) return; busy = true;
      try { const result = await musicRequest('/ma/state'); if (!disposed && sequence.current === current) update({ playing: result.state === 'playing', status: result.state === 'playing' ? 'playing' : result.state === 'paused' ? 'paused' : 'waiting', position: result.elapsed, duration: result.duration, actualTrack: result.title }); }
      catch (error) { if (!disposed && sequence.current === current) update({ status: 'error', error: error.message, playing: false }); }
      finally { busy = false; }
    };
    const timer = setInterval(poll, 1500); return () => { disposed = true; clearInterval(timer); };
  }, [provider, record?.id, trackIndex, accountEpoch]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  useEffect(() => () => { if (remote.current) musicRequest('/ma/control', { action: 'stop' }).catch(() => {}); }, []);
  const toggle = async () => {
    if (controlling.current || provider === 'system' || provider === 'visual') return;
    controlling.current = true;
    const current = sequence.current;
    try {
      if (remote.current) { await musicRequest('/ma/control', { action: state.playing ? 'pause' : 'play' }); return; }
      if (audio.current?.getAttribute('src')) { if (audio.current.paused) await audio.current.play(); else audio.current.pause(); }
      else setAccountEpoch((value) => value + 1);
    } catch (error) { if (sequence.current === current) update({ status: 'error', error: error.message }); }
    finally { controlling.current = false; }
  };
  const events = {
    onPlay: () => { if (audio.current?.getAttribute('src')) update({ playing: false, status: 'loading', error: '' }); },
    onPlaying: () => { if (audio.current?.getAttribute('src')) update({ playing: true, status: 'playing', error: '' }); },
    onWaiting: () => { if (audio.current?.getAttribute('src') && !audio.current.paused) update({ playing: false, status: 'buffering' }); },
    onPause: () => { if (audio.current?.getAttribute('src')) update({ playing: false, status: 'paused' }); },
    onTimeUpdate: () => update({ position: audio.current.currentTime }), onDurationChange: () => update({ duration: Number.isFinite(audio.current.duration) ? audio.current.duration : 0 }),
    onEnded: () => { update({ playing: false, status: 'ended' }); next.current?.(); },
    onError: () => { if (audio.current?.getAttribute('src')) update({ playing: false, status: 'error', error: '音频加载失败。请重新播放，或检查平台权限与网络。' }); }
  };
  const statusText = state.error || ({ idle: '待播放', loading: '正在连接音源…', buffering: '正在缓冲音频…', searching: '正在匹配原始曲目…', choose: '请选择对应的曲目版本', playing: `${provider === 'ma' ? '服务器播放器正在播放' : provider === 'local' ? '正在播放本地文件' : '正在播放'}${state.trial ? ' · 试听片段' : ''}`, paused: '播放已暂停', ended: '本曲播放结束', waiting: '等待服务器播放器' }[state.status] || '待播放');
  return { ...state, statusText, audio, events, toggle, choose: (candidate) => resolveRef.current?.(candidate), seek: (value) => { if (audio.current && !remote.current && Number.isFinite(value) && Number.isFinite(audio.current.duration)) audio.current.currentTime = Math.max(0, Math.min(value, audio.current.duration)); }, volume, setVolume };
}
