import React, { useState } from 'react';
import { Clock, ListBullet, ChartBar, SpeakerWave, SpeakerOff, Play, Pause, Forward, Loading, X, Settings, Shuffle } from '../icons';
import { useFocus } from './useFocus';
import { useSoundscape } from '../audio/useSoundscape';
import { AMBIENCE_TRACKS } from '../audio/ambience.mjs';
import { formatClock, PHASE_LABELS, phaseDuration } from './focus-model.mjs';
import PixelClock from './PixelClock';
import TaskList from './TaskList';
import FocusStats from './FocusStats';
import './focus.css';

const TABS = [['timer', '番茄钟', Clock], ['tasks', '待办', ListBullet], ['stats', '统计', ChartBar], ['sound', '声音', SpeakerWave]];

export function FocusTimer() {
  const focus = useFocus(), { timer, settings, tasks } = focus.state, [editing, setEditing] = useState(false);
  const idle = timer.phase === 'idle', remaining = idle ? phaseDuration(settings, 'focus') : focus.remaining;
  const total = idle ? remaining : phaseDuration(settings, timer.phase), progress = total ? 1 - remaining / total : 0;
  const task = tasks.find((item) => item.id === timer.taskId);
  const number = (key, label, max) => <label>{label}<input type="number" min="1" max={max} value={settings[key]} onChange={(event) => focus.settings({ [key]: event.target.value })}/></label>;
  const check = (key, label) => <label className="focus-check"><input type="checkbox" checked={settings[key]} onChange={(event) => focus.settings({ [key]: event.target.checked })}/>{label}</label>;
  return <div className={`focus-timer phase-${timer.phase} ${timer.paused ? 'is-paused' : ''}`}>
    <p className="focus-phase" role="status">{PHASE_LABELS[timer.phase]}{timer.paused ? ' · 已暂停' : ''}</p>
    <PixelClock text={formatClock(remaining)} label={`剩余 ${formatClock(remaining)}`}/>
    <div className="focus-progress" aria-hidden="true"><span style={{ width: `${progress * 100}%` }}/></div>
    <div className="focus-rounds" aria-label={`本组第 ${timer.round % settings.longEvery + (timer.phase === 'focus' ? 1 : 0)} 轮`}>{Array.from({ length: settings.longEvery }, (_, index) => <span key={index} className={index < timer.round % settings.longEvery ? 'is-done' : index === timer.round % settings.longEvery && timer.phase === 'focus' ? 'is-active' : ''}/>)}</div>
    <label className="focus-current-task">当前任务<select aria-label="当前专注任务" value={timer.taskId} onChange={(event) => focus.selectTask(event.target.value || timer.taskId)}><option value="">自由专注</option>{tasks.filter((item) => !item.done || item.id === timer.taskId).map((item) => <option key={item.id} value={item.id}>{item.text}</option>)}</select></label>
    {task && <p className="focus-task-now" title={task.text}>正在：{task.text}</p>}
    <div className="focus-controls">
      <button type="button" className="focus-primary" onClick={focus.toggle}>{idle ? <><Play size={18}/>开始专注</> : timer.paused ? <><Play size={18}/>继续</> : <><Pause size={18}/>暂停</>}</button>
      {!idle && <button type="button" aria-label={timer.phase === 'focus' ? '提前结束本轮专注' : '跳过休息'} title={timer.phase === 'focus' ? '提前结束本轮（不计奖励）' : '跳过休息'} onClick={focus.skip}><Forward size={18}/></button>}
      {!idle && <button type="button" aria-label="重置计时" title="重置计时" onClick={focus.reset}><Loading size={18}/></button>}
      {idle && <button type="button" onClick={() => focus.start('shortBreak')}>休息一下</button>}
      <button type="button" aria-label="计时设置" aria-expanded={editing} onClick={() => setEditing(!editing)}><Settings size={18}/></button>
    </div>
    {editing && <div className="focus-settings">
      <div className="focus-settings-grid">{number('focusMin', '专注（分）', 180)}{number('shortMin', '短休（分）', 60)}{number('longMin', '长休（分）', 90)}{number('longEvery', '几轮长休', 8)}</div>
      {check('autoBreak', '专注结束自动开始休息')}{check('autoFocus', '休息结束自动开始专注')}{check('notify', '系统通知')}{check('chime', '提示音')}{check('autoSound', '开始专注时打开声音')}
    </div>}
    {focus.error && <p className="record-error" role="alert">{focus.error}</p>}
  </div>;
}

export function SoundMixer() {
  const sound = useSoundscape(), { mix } = sound;
  const slider = (label, value, change, name) => <label className="sound-slider"><span>{label}</span><input type="range" min="0" max="1" step=".01" aria-label={name || `${label}音量`} value={value} onChange={(event) => change(Number(event.target.value))}/></label>;
  return <div className="sound-mixer">
    <button type="button" className={`sound-power ${sound.enabled ? 'is-on' : ''}`} aria-pressed={sound.enabled} onClick={sound.toggle}>{sound.enabled ? <><SpeakerWave size={18}/>声音已开启</> : <><SpeakerOff size={18}/>开启小屋声音</>}</button>
    <section className="sound-lofi">
      <header><label className="focus-check"><input type="checkbox" checked={mix.lofiOn} onChange={(event) => sound.setLofi(event.target.checked)}/>Lofi 电台 · 实时生成</label>{sound.lofiState === 'playing' && <button type="button" aria-label="换一段 Lofi" title="换一段" onClick={sound.skipSection}><Shuffle size={16}/></button>}</header>
      <p className="sound-section" role="status">{sound.lofiState === 'loading' ? '正在调音…' : sound.section ? `${sound.section.key} 调 · ${sound.section.bpm} BPM · ${sound.section.chords.map((chord) => chord.name).join(' → ')}` : mix.lofiOn && !sound.enabled ? '开启声音后开始播放' : '离线生成的 Lo-fi，每 16 小节换一段'}</p>
      {sound.ducked && sound.lofiState === 'playing' && <small>唱机播放中，Lofi 已自动调低</small>}
      {slider('音量', mix.lofi, sound.setLofiVolume, 'Lofi 音量')}
    </section>
    <section className="sound-ambience" aria-label="环境音">
      {AMBIENCE_TRACKS.map((track) => <div key={track.id}>{slider(track.name, mix.tracks[track.id], (value) => sound.setTrack(track.id, value))}</div>)}
    </section>
    {slider('总音量', mix.master, sound.setMaster)}
    {sound.error && <p className="record-error" role="alert">{sound.error}</p>}
    <small className="sound-note">环境音由程序合成，不使用录音素材，离线也能用。</small>
  </div>;
}

export function FocusBadge({ onClick }) {
  const focus = useFocus(), { timer } = focus.state;
  if (timer.phase === 'idle') return <button type="button" className="focus-badge" onClick={onClick}><Clock size={17}/>专注</button>;
  return <button type="button" className={`focus-badge is-running phase-${timer.phase}`} onClick={onClick} aria-label={`${PHASE_LABELS[timer.phase]}，剩余 ${formatClock(focus.remaining)}`}><Clock size={17}/>{formatClock(focus.remaining)}{timer.paused ? ' ⏸' : ''}</button>;
}

export default function FocusDock({ open, close, tab, setTab }) {
  if (!open) return null;
  return <aside className="focus-dock" aria-label="专注工具">
    <header className="focus-dock-header">
      <nav role="tablist" aria-label="专注工具">{TABS.map(([id, label, Icon]) => <button type="button" role="tab" key={id} aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={16}/><span>{label}</span></button>)}</nav>
      <button type="button" className="focus-dock-close" aria-label="收起专注工具" onClick={close}><X size={18}/></button>
    </header>
    <div className="focus-dock-body" role="tabpanel">
      {tab === 'timer' && <FocusTimer/>}{tab === 'tasks' && <TaskList/>}{tab === 'stats' && <FocusStats/>}{tab === 'sound' && <SoundMixer/>}
    </div>
  </aside>;
}
