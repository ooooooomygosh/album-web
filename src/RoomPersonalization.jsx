import React from 'react';
import Dialog from './Dialog';
import PixelCat from './pet/PixelCat';
import { PETS } from './pet/pet-catalog.mjs';
import { ROOM_SCENES } from './scene-catalog.mjs';
import './room-personalization.css';

export default function RoomPersonalization({ look, petId, onChange, close, reduceMotion = false, error }) {
  return <Dialog title="布置小屋" close={close} className="room-personalization" wide>
    <p className="personalization-intro">选一个今天想待着的地方，再找一位安静的伙伴。换装不会打断音乐和专注。</p>
    <section aria-labelledby="scene-picker-title"><div className="personalization-heading"><h3 id="scene-picker-title">你的休憩角落</h3><span>所有场景 · 随时切换</span></div>
      <div className="scene-options">{ROOM_SCENES.map((scene) => <button type="button" className="scene-choice" key={scene.id} aria-pressed={look === scene.id} onClick={() => onChange({ look: scene.id })} aria-label={`选择场景 ${scene.label}`}>
        <img src={scene.view} alt="" width="240" height="180" loading="lazy"/><span className="choice-copy"><strong>{scene.label}</strong><small>{scene.description}</small></span><span className="choice-mark" aria-hidden="true">{look === scene.id ? '✓' : ''}</span>
      </button>)}</div>
    </section>
    <section aria-labelledby="pet-picker-title"><div className="personalization-heading"><h3 id="pet-picker-title">陪你的小伙伴</h3><span>同步到桌宠与动态桌面</span></div>
      <div className="pet-options">{PETS.map((pet) => <button type="button" key={pet.id} className="pet-choice" aria-pressed={petId === pet.id} onClick={() => onChange({ petId: pet.id })} aria-label={`选择桌宠 ${pet.name || pet.label}`}>
        <PixelCat petId={pet.id} pose={petId === pet.id ? 'groove' : 'idle'} reduceMotion={reduceMotion}/><strong>{pet.name || pet.label}</strong><small>{pet.description || pet.personality || ''}</small><span className="choice-mark" aria-hidden="true">{petId === pet.id ? '✓' : ''}</span>
      </button>)}</div>
    </section>
    {error && <p role="alert" className="record-error">{error}</p>}
    <footer className="personalization-footer"><small>选择只保存在本机，无需解锁，也没有喂养负担。</small><button type="button" className="record-primary" onClick={close}>回到小屋</button></footer>
  </Dialog>;
}
