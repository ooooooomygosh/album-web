import React, { useState } from 'react';
import { Plus, Trash2, Check } from '../icons';
import { useFocus } from './useFocus';

export default function TaskList() {
  const focus = useFocus(), [draft, setDraft] = useState(''), [dragging, setDragging] = useState('');
  const { tasks, timer } = focus.state, open = tasks.filter((task) => !task.done).length;
  const submit = (event) => { event.preventDefault(); if (!draft.trim() || tasks.length >= 200) return; focus.addTask(draft); setDraft(''); };
  return <div className="focus-tasks">
    <form className="focus-task-form" onSubmit={submit}>
      <input aria-label="新的待办" placeholder="接下来要做什么？" maxLength={120} value={draft} onChange={(event) => setDraft(event.target.value)}/>
      <button type="submit" aria-label="添加待办" disabled={!draft.trim() || tasks.length >= 200}><Plus size={18}/></button>
    </form>
    {tasks.length >= 200 && <p role="status" className="focus-empty">已达 200 项上限，请先清理已完成的待办。</p>}
    {!tasks.length && <p className="focus-empty">把今天的小目标写下来，选中一项后开始专注。</p>}
    <ul className="focus-task-list" aria-label="待办清单">
      {tasks.map((task, index) => <li key={task.id} className={`${task.done ? 'is-done' : ''} ${timer.taskId === task.id ? 'is-current' : ''} ${dragging === task.id ? 'is-dragging' : ''}`} draggable
        onDragStart={(event) => { setDragging(task.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id); }}
        onDragEnd={() => setDragging('')} onDragOver={(event) => { if (dragging) event.preventDefault(); }}
        onDrop={(event) => { event.preventDefault(); if (dragging && dragging !== task.id) focus.moveTask(dragging, index); setDragging(''); }}>
        <button type="button" className="focus-task-check" role="checkbox" aria-checked={task.done} aria-label={`${task.done ? '标记为未完成' : '完成'}：${task.text}`} onClick={() => focus.updateTask(task.id, { done: !task.done })}>{task.done && <Check size={14}/>}</button>
        <button type="button" className="focus-task-text" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" onKeyDown={(event) => {
          if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault(); focus.moveTask(task.id, index + (event.key === 'ArrowUp' ? -1 : 1));
        }} aria-pressed={timer.taskId === task.id} title={timer.taskId === task.id ? '取消作为当前专注任务' : '设为当前专注任务'} onClick={() => focus.selectTask(task.id, true)}>
          <span>{task.text}</span>{task.pomodoros > 0 && <small aria-label={`已专注 ${task.pomodoros} 轮`}>{'🍅'.repeat(Math.min(task.pomodoros, 4))}{task.pomodoros > 4 ? `×${task.pomodoros}` : ''}</small>}
        </button>
        <button type="button" className="focus-task-remove" aria-label={`删除待办：${task.text}`} onClick={() => focus.removeTask(task.id)}><Trash2 size={15}/></button>
      </li>)}
    </ul>
    {tasks.length > 1 && <p className="focus-empty">拖动排序，或选中任务后按 Alt + ↑ / ↓ 调整顺序。</p>}
    {tasks.length > 0 && <footer className="focus-task-footer"><span>{open} 项待完成</span>{tasks.length > open && <button type="button" onClick={focus.clearDone}>清除已完成</button>}</footer>}
  </div>;
}
