import React from 'react';
import { useFocus } from './useFocus';
import { focusStats, levelInfo, UNLOCKS, unlockedIds } from './focus-model.mjs';

const hours = (minutes) => minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : `${minutes} 分钟`;
export default function FocusStats() {
  const focus = useFocus(), { sessions, rewards } = focus.state;
  const stats = focusStats(sessions, focus.now), peak = Math.max(30, ...stats.week.map((day) => day.minutes));
  const level = levelInfo(rewards.xp), unlocked = unlockedIds(rewards.xp);
  return <div className="focus-stats">
    <dl className="focus-stat-tiles">
      <div><dt>今日专注</dt><dd>{hours(stats.today)}</dd></div>
      <div><dt>连续天数</dt><dd>{stats.streak} 天</dd></div>
      <div><dt>累计</dt><dd>{hours(stats.totalMinutes)}</dd></div>
      <div><dt>完成轮数</dt><dd>{stats.sessions}</dd></div>
    </dl>
    <figure className="focus-week" aria-label="最近 7 天专注分钟">
      <div className="focus-week-bars">{stats.week.map((day) => <div key={day.key} className="focus-week-day" title={`${day.key} · ${day.minutes} 分钟`}>
        <span className="focus-week-value">{day.minutes || ''}</span>
        <span className="focus-week-bar" style={{ height: `${Math.max(day.minutes ? 6 : 2, day.minutes / peak * 100)}%` }}/>
        <small>{day.label}</small>
      </div>)}</div>
      <figcaption>最近 7 天 · 分钟</figcaption>
    </figure>
    <section className="focus-rewards" aria-label="小屋奖励">
      <header><strong>Lv.{level.level} 小屋主人</strong><span>🐟 {rewards.fish} 小鱼干</span></header>
      <div className="focus-xp" role="progressbar" aria-label="升级进度" aria-valuemin={0} aria-valuemax={level.need} aria-valuenow={level.into}><span style={{ width: `${level.into / level.need * 100}%` }}/></div>
      <small>再专注 {level.need - level.into} 分钟升级。每完成一轮专注获得 1 条小鱼干。</small>
      <div className="focus-unlocks">
        {['accessory', 'weather'].map((kind) => <fieldset key={kind}><legend>{kind === 'accessory' ? '小猫配饰' : '窗外天气'}</legend>
          {kind === 'accessory' && <button type="button" aria-pressed={!rewards.equipped.accessory} onClick={() => focus.equip('accessory', '')}>不戴</button>}
          {UNLOCKS.filter((item) => item.kind === kind).map((item) => <button type="button" key={item.id} disabled={!unlocked.has(item.id)} aria-pressed={rewards.equipped[kind] === item.id} title={unlocked.has(item.id) ? item.name : `Lv.${item.level} 解锁`} onClick={() => focus.equip(kind, item.id)}>{item.name}{!unlocked.has(item.id) && <small> · Lv.{item.level}</small>}</button>)}
        </fieldset>)}
      </div>
    </section>
  </div>;
}
