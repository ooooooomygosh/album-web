import React, { useEffect, useRef, useState } from 'react';
import Dialog from './Dialog';
import PixelCat from './pet/PixelCat';
import { PETS } from './pet/pet-catalog.mjs';
import { ROOM_SCENES, getRoomScene } from './scene-catalog.mjs';
import { BookOpen, Check, ChevronRight, Clock, FolderOpen, Music2 } from './icons';
import './cabin-welcome.css';

export const WELCOME_KEY = 'flow-cabin-welcome-v1';
export function isNewCabin(storage) {
  try {
    return !storage.getItem(WELCOME_KEY) && !Object.keys(storage).some(key => key.startsWith('album-circle-'));
  } catch { return false; }
}

// The guide changes only explicitly selected room preferences. Its exit actions
// open existing tools; they never start audio, timers, login or native windows.
export default function CabinWelcome({ look, petId, onChange, close, finish, reduceMotion, error }) {
  const [step, setStep] = useState(0);
  const heading = useRef(null), previousStep = useRef(0);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus({ preventScroll: true });
    previousStep.current = step;
  }, [step]);
  const scene = getRoomScene(look), pet = PETS.find(pet => pet.id === petId) || PETS[0];
  const steps = ['找个角落', '放一张唱片', '留一点时间'];
  return <Dialog title="欢迎来到心流小屋" icon={<BookOpen size={19}/>} close={close} className="cabin-welcome" wide>
    <ol className="welcome-progress" aria-label="入门步骤">{steps.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined}><span>{index < step ? <Check size={13}/> : index + 1}</span>{title}</li>)}</ol>
    <div className="welcome-layout">
      <div className="welcome-scene" style={{ '--welcome-accent': scene.style.accent }}>
        <img src={scene.art} alt={scene.alt} width="1448" height="1086"/>
        <div className="welcome-scene-caption"><span>YOUR LITTLE CORNER</span><strong>{scene.label}</strong><small>{scene.description}</small></div>
        <PixelCat petId={petId} pose={step === 2 ? 'focus' : 'idle'} reduceMotion={reduceMotion} label={`${pet.name}陪着你`}/>
      </div>
      <section className="welcome-step" key={step} aria-labelledby="welcome-heading">
        <small className="welcome-eyebrow">慢慢来，从这里开始</small>
        <h3 id="welcome-heading" ref={heading} tabIndex={-1}>{['今天，想在哪里待着？', '让喜欢的音乐住进来。', '这一轮，安心做一件事。'][step]}</h3>
        {step === 0 ? <>
          <p>选一个角落，再找一位伙伴。以后随时可以在「布置小屋」里更换。</p>
          <div className="welcome-scene-options" role="group" aria-label="入门场景">{ROOM_SCENES.map(scene => <button type="button" key={scene.id} onClick={() => onChange({ look: scene.id })} aria-label={`入门选择 ${scene.label}`} aria-pressed={look === scene.id} title={scene.label}><img src={scene.art} alt=""/><span>{scene.label}</span></button>)}</div>
          <div className="welcome-pet-options" role="group" aria-label="入门伙伴">{PETS.map(pet => <button type="button" key={pet.id} aria-label={`入门选择 ${pet.name}`} aria-pressed={petId === pet.id} onClick={() => onChange({ petId: pet.id })}><PixelCat petId={pet.id} pose="idle" reduceMotion={reduceMotion}/><span>{pet.name}</span></button>)}</div>
          {error && <p className="record-error" role="alert">选择未保存：{error}</p>}
          <small className="welcome-footnote">无需解锁，也没有喂养负担。</small>
        </> : step === 1 ? <>
          <p>添加专辑，把封面放上唱片架。双击封面，或拖到唱机，就能放盘。</p>
          <div className="welcome-note"><Music2 size={21}/><div><strong>收藏封面和播放音乐，是两步。</strong><p>唱机默认只展示旋转。听歌前，在「音源设置」连接音乐，再选择唱机的音源。</p></div></div>
          <ul className="welcome-music-paths"><li><FolderOpen size={18}/><span><strong>电脑里有音乐</strong><small>选择本地文件夹，文件留在原处。</small></span></li><li><Music2 size={18}/><span><strong>使用音乐平台</strong><small>QQ / 网易云需另行登录，受会员与版权限制。</small></span></li></ul>
          <small className="welcome-footnote">也支持系统正在播放和 Music Assistant。现在不连接也没关系。</small>
        </> : <>
          <p>在「专注」里选待办或自由专注，按「开始专注」才会计时。不必先添加专辑。</p>
          <div className="welcome-timer"><Clock size={23}/><strong>25<span>分钟，留给眼前的事</span></strong></div>
          <p className="welcome-shortcuts"><kbd>Z</kbd> 收起界面，进入沉浸<br/><kbd>Esc</kbd> 回到小屋</p>
          <small className="welcome-footnote">时长可调整；雨声、壁炉与随手记也在专注面板里。收藏与专注数据保存在本机。</small>
          <div className="welcome-start-actions"><button type="button" className="pixel-button is-primary" onClick={() => finish('focus')}>打开专注工具 <ChevronRight size={16}/></button><button type="button" className="pixel-button is-quiet" onClick={() => finish('album')}>添加我的第一张专辑</button><button type="button" className="welcome-text-button" onClick={() => finish('music')}>先连接音源</button></div>
        </>}
      </section>
    </div>
    <footer className="welcome-footer"><button type="button" className="welcome-text-button" onClick={close}>先逛逛小屋</button><span>以后可从右上角「入门指南」再看。</span><div>{step > 0 && <button type="button" className="pixel-button is-quiet" onClick={() => setStep(step - 1)}>上一步</button>}{step < 2 ? <button type="button" className="pixel-button is-primary" onClick={() => setStep(step + 1)}>下一步 <ChevronRight size={16}/></button> : <button type="button" className="pixel-button is-quiet" onClick={close}>准备好了</button>}</div></footer>
  </Dialog>;
}
