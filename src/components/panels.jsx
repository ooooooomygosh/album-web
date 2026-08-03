import React from 'react';
import { useState, useEffect } from 'react';
import { Bot, DoorOpen, Library, LockKeyhole, Music2, Plus, Search, Share2, Sparkles, Trash2, UserRound, Users, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { emptyProfile, mergeUserSettings, editableHeroConfig } from '../lib/utils.js';
import { UserAvatar, PersonaGenerationLoader, EditableList } from './common.jsx';
import { PersonaReport, PersonaChatBox } from './persona.jsx';

/* --------------------------------- 局部原子 --------------------------------- */

function CardTitle({ icon: Icon, children, tone = 'sky' }) {
  const toneClass = {
    sky: 'text-accent-sky',
    purple: 'text-accent-purple',
    gold: 'text-accent-gold',
    green: 'text-accent-green'
  }[tone] || 'text-accent-sky';
  return (
    <div className="ac-section-title mb-4">
      {Icon ? <Icon size={17} className={toneClass} aria-hidden="true" /> : null}
      <h3 className="text-[0.95rem] font-bold tracking-tight text-paper">{children}</h3>
    </div>
  );
}

/* ---------------------------------- 个人页 ---------------------------------- */

export function ProfilePanel({
  session, profileDraft, setProfileDraft, saveProfile, uploadAvatar, profileStats, profileStatus,
  loadProfileStats, fillProfileFromHistory, personaTone, setPersonaTone, personaHistoryMode,
  setPersonaHistoryMode, personaSelectedIds, togglePersonaItem, generatePersona, personaStatus,
  personaReport, addPublicTag, personaQuestion, setPersonaQuestion, askPersona, personaChat, personaChatStatus,
  startRitual, openShareCard
}) {
  const profile = profileDraft.profile || emptyProfile;
  const setProfileField = (key, value) => setProfileDraft((current) => ({
    ...current,
    profile: { ...(current.profile || emptyProfile), [key]: value }
  }));
  const setPublicTags = (value) => setProfileDraft((current) => ({ ...current, publicTags: value }));
  const avatarUser = { ...session.user, ...profileDraft };
  const recentAdds = profileStats?.recentAdds || [];
  const selectedCount = personaSelectedIds.length;

  return (
    <div className="ac-page animate-fade-in">
      {/* Hero */}
      <section className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-xl border border-white/[0.09] bg-gradient-to-br from-accent-sky/10 via-white/[0.03] to-transparent p-6">
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-accent-sky/25 opacity-40 blur-3xl" aria-hidden="true" />
        <div className="relative shrink-0 [&>*]:h-16 [&>*]:w-16 [&>*]:text-lg">
          <UserAvatar user={avatarUser} />
        </div>
        <div className="relative min-w-[220px] flex-1 space-y-2">
          <p className="ac-eyebrow"><UserRound size={13} aria-hidden="true" /> my music identity</p>
          <h2 className="ac-h1">我的音乐档案</h2>
          <p className="ac-body max-w-[60ch]">资料都可以留空。填得越多，AI 对你的房间历史、偏好和公开标签理解得越细。</p>
          {(profileDraft.publicTags || []).length ? (
            <div className="ac-tag-row pt-1">
              {(profileDraft.publicTags || []).map((tag) => <span key={tag} className="ac-tag">{tag}</span>)}
            </div>
          ) : null}
        </div>
        <button type="button" className="ac-btn ac-btn-ghost relative shrink-0" onClick={loadProfileStats}>
          <Search size={15} aria-hidden="true" />刷新统计
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* 账户资料 */}
        <article className="ac-card space-y-3 p-5">
          <CardTitle icon={UserRound}>账户资料</CardTitle>
          <label className="ac-field">
            <span>昵称</span>
            <input className="ac-input" value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="ac-field">
            <span>头像字母</span>
            <input className="ac-input" value={profileDraft.avatar} maxLength={2} onChange={(event) => setProfileDraft((current) => ({ ...current, avatar: event.target.value }))} />
          </label>
          <label className="ac-field">
            <span>上传头像</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => uploadAvatar(event.target.files?.[0])}
              className="w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] text-[0.78rem] text-paper-dim file:mr-3 file:cursor-pointer file:border-0 file:bg-accent-sky/18 file:px-3.5 file:py-2 file:text-[0.75rem] file:font-semibold file:text-accent-sky hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
            />
          </label>
          <label className="ac-field">
            <span>公开简介</span>
            <textarea className="ac-textarea" rows={3} value={profile.bio} onChange={(event) => setProfileField('bio', event.target.value)} placeholder="一句话写下你的听歌方式。" />
          </label>
          <EditableList label="公开 tags" value={profileDraft.publicTags} onChange={setPublicTags} placeholder="专辑补完者、深夜人声控" />
          <button type="button" className="ac-btn ac-btn-primary w-full justify-center" onClick={() => saveProfile()}>
            <Wand2 size={15} aria-hidden="true" />保存资料
          </button>
          {profileStatus ? <p className="ac-status" aria-live="polite">{profileStatus}</p> : null}
        </article>

        {/* 偏好线索 */}
        <article className="ac-card space-y-3 p-5">
          <CardTitle icon={Music2} tone="purple">偏好线索</CardTitle>
          <label className="ac-field">
            <span>所在地</span>
            <input className="ac-input" value={profile.location} onChange={(event) => setProfileField('location', event.target.value)} placeholder="城市或地区，可留空" />
          </label>
          <EditableList label="喜欢的风格" value={profile.favoriteGenres} onChange={(value) => setProfileField('favoriteGenres', value)} placeholder="R&B、华语流行、Dream Pop" />
          <EditableList label="喜欢的歌手" value={profile.favoriteArtists} onChange={(value) => setProfileField('favoriteArtists', value)} placeholder="王菲、Frank Ocean" />
          <EditableList label="喜欢的乐队" value={profile.favoriteBands} onChange={(value) => setProfileField('favoriteBands', value)} placeholder="Radiohead、The xx" />
          <EditableList label="喜欢的专辑" value={profile.favoriteAlbums} onChange={(value) => setProfileField('favoriteAlbums', value)} placeholder="唱游、Blonde" />
          <EditableList label="喜欢的歌曲" value={profile.favoriteSongs} onChange={(value) => setProfileField('favoriteSongs', value)} placeholder="我爱你 - 李荣浩、暗涌 - 王菲" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['性别', 'gender'],
              ['出生年份', 'birthYear'],
              ['MBTI', 'mbti'],
              ['专业', 'major']
            ].map(([label, key]) => (
              <label key={key} className="ac-field">
                <span>{label}</span>
                <input className="ac-input" value={profile[key]} onChange={(event) => setProfileField(key, event.target.value)} placeholder="可留空" />
              </label>
            ))}
          </div>
        </article>

        {/* 添加历史 */}
        <article className="ac-card space-y-4 p-5">
          <CardTitle icon={Library} tone="green">添加历史</CardTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              [profileStats?.itemsAdded || 0, '自己添加'],
              [profileStats?.roomsJoined || 0, '加入房间'],
              [profileStats?.albumsAdded || 0, '专辑'],
              [profileStats?.songsAdded || 0, '歌曲']
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-center">
                <strong className="block text-lg font-black tabular-nums text-paper">{value}</strong>
                <span className="text-[0.7rem] text-paper-faint">{label}</span>
              </div>
            ))}
          </div>
          <button type="button" className="ac-btn ac-btn-ghost w-full justify-center" onClick={fillProfileFromHistory}>
            用历史记录填充偏好草稿
          </button>
          {(profileStats?.topArtists || []).length ? (
            <div className="ac-tag-row">
              {(profileStats?.topArtists || []).slice(0, 10).map((item) => (
                <span key={item.name} className="ac-tag gap-1.5">
                  {item.name}
                  <small className="font-bold text-accent-sky/80">{item.count}</small>
                </span>
              ))}
            </div>
          ) : null}
          {(profileStats?.recentAdds || []).length ? (
            <div className="space-y-1.5">
              {(profileStats?.recentAdds || []).slice(0, 5).map((item) => (
                <div key={`${item.roomId}-${item.id}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <strong className="block truncate text-[0.82rem] font-semibold text-paper">{item.title}</strong>
                  <small className="block truncate text-[0.7rem] text-paper-faint">{item.artist} · {item.roomName}</small>
                </div>
              ))}
            </div>
          ) : null}
        </article>

        {/* 灵魂侧写 */}
        <article className="ac-card space-y-4 p-5">
          <CardTitle icon={Sparkles} tone="gold">音乐灵魂侧写</CardTitle>
          <p className="ac-body">先选几首真正代表你的歌或专辑。AI 会结合个人资料、评论片段和所选音乐，分析偏好之间的关联，并推荐新的歌手、歌曲和专辑。</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ac-field">
              <span>语气</span>
              <select className="ac-select" value={personaTone} onChange={(event) => setPersonaTone(event.target.value)}>
                <option value="warm">温暖</option>
                <option value="mystic">神秘</option>
                <option value="critic">乐评</option>
                <option value="playful">好玩</option>
              </select>
            </label>
            <label className="ac-field">
              <span>分析范围</span>
              <select className="ac-select" value={personaHistoryMode} onChange={(event) => setPersonaHistoryMode(event.target.value)}>
                <option value="selected">只分析我勾选的</option>
                <option value="mine">我添加的全部音乐</option>
                <option value="room">所在房间全部音乐</option>
                <option value="none">只使用填写资料</option>
              </select>
            </label>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <strong className="text-[0.8rem] font-bold text-paper">代表性音乐</strong>
            <span className="text-[0.72rem] text-paper-faint">
              {selectedCount ? `已选择 ${selectedCount} 条` : '可从最近添加中点选'}
            </span>
          </div>

          <div className="ac-scroll grid max-h-[280px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {recentAdds.slice(0, 12).map((item) => {
              const selected = personaSelectedIds.includes(item.id);
              return (
                <button
                  key={`${item.roomId}-${item.id}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => togglePersonaItem(item)}
                  className={[
                    'flex items-center gap-2.5 rounded-lg border p-2 text-left transition-all duration-200 ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60',
                    selected
                      ? 'border-accent-gold/45 bg-accent-gold/12'
                      : 'border-white/[0.07] hover:border-white/15 hover:bg-white/[0.05]'
                  ].join(' ')}
                >
                  {item.cover ? (
                    <img src={item.cover} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" loading="lazy" />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-md bg-white/[0.06]" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[0.78rem] font-semibold text-paper">{item.title}</strong>
                    <small className="block truncate text-[0.68rem] text-paper-faint">{item.artist} · {item.roomName}</small>
                  </span>
                </button>
              );
            })}
            {!recentAdds.length ? (
              <p className="ac-empty col-span-full py-8 text-[0.82rem]">刷新统计后会显示你添加过的歌曲和专辑。</p>
            ) : null}
          </div>

          {/* 主入口：全屏灵魂仪式 */}
          <button
            type="button"
            onClick={startRitual}
            disabled={personaStatus === 'thinking'}
            className="group relative w-full overflow-hidden rounded-xl border border-accent-purple/35 bg-gradient-to-br from-accent-purple/20 via-accent-sky/10 to-transparent p-5 text-left transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-accent-purple/60 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-purple/45 opacity-45 blur-3xl transition-opacity duration-500 group-hover:opacity-80"
              aria-hidden="true"
            />
            <span className="relative flex items-center gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-lg text-accent-purple transition-transform duration-500 ease-spring group-hover:rotate-[18deg]" aria-hidden="true">
                ☾
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[0.95rem] font-black text-paper">开始灵魂仪式</strong>
                <small className="mt-0.5 block text-[0.76rem] leading-relaxed text-paper-dim">
                  抽 4 张现场生成的牌，答完再翻面。侧写会比直接生成锋利得多。
                </small>
              </span>
              <Sparkles size={17} className="shrink-0 text-accent-gold transition-transform duration-300 group-hover:scale-125" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            className="ac-btn w-full justify-center"
            onClick={() => generatePersona()}
            disabled={personaStatus === 'thinking'}
          >
            {personaStatus === 'thinking' ? '正在抽音乐人格牌' : '跳过仪式，直接生成'}
          </button>

          {personaStatus === 'thinking' ? (
            <PersonaGenerationLoader tone={personaTone} selectedCount={selectedCount} profileStats={profileStats} user={avatarUser} />
          ) : null}
          {personaStatus === 'fallback' ? <p className="ac-status">AI 暂时不可用，已生成本地临时侧写。</p> : null}
          {String(personaStatus).startsWith('error-') ? (
            <p className="ac-status ac-status-error">{String(personaStatus).replace('error-', '')}</p>
          ) : null}
        </article>
      </section>

      <PersonaReport report={personaReport} addPublicTag={addPublicTag} openShareCard={openShareCard} userName={session.user.name} />
      <PersonaChatBox
        report={personaReport}
        personaQuestion={personaQuestion}
        setPersonaQuestion={setPersonaQuestion}
        askPersona={askPersona}
        personaChat={personaChat}
        personaChatStatus={personaChatStatus}
      />
    </div>
  );
}

/* ---------------------------------- 管理台 ---------------------------------- */

export function AdminPanel({
  adminData, adminStatus, loadAdmin, deleteRoom, deleteUser, aiPromptDraft, setAiPromptDraft,
  personaPromptDraft, setPersonaPromptDraft, aiMaxTokens, setAiMaxTokens, personaMaxTokens,
  setPersonaMaxTokens, personaChatMaxTokens, setPersonaChatMaxTokens, aiTemperature, setAiTemperature,
  personaTemperature, setPersonaTemperature, saveAiConfig
}) {
  const numberFields = [
    ['Max Tokens', aiMaxTokens, setAiMaxTokens, { min: 700, max: 3200, step: 1 }],
    ['Persona Tokens', personaMaxTokens, setPersonaMaxTokens, { min: 1200, max: 16000, step: 1 }],
    ['Chat Tokens', personaChatMaxTokens, setPersonaChatMaxTokens, { min: 900, max: 8000, step: 1 }],
    ['Temperature', aiTemperature, setAiTemperature, { min: 0, max: 1, step: 0.05 }],
    ['Persona Temp', personaTemperature, setPersonaTemperature, { min: 0, max: 1, step: 0.05 }]
  ];

  return (
    <div className="ac-page animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="ac-eyebrow"><LockKeyhole size={13} aria-hidden="true" /> admin console</p>
          <h2 className="ac-h1">管理后台</h2>
          <p className="ac-body max-w-[62ch]">管理房间、用户和 AI 生成策略。保存后的 prompt 会用于之后新加入的歌曲和专辑。</p>
        </div>
        <button type="button" className="ac-btn ac-btn-ghost" onClick={loadAdmin}>
          <Search size={15} aria-hidden="true" />刷新
        </button>
      </header>

      {adminStatus ? <p className="ac-status" aria-live="polite">{adminStatus}</p> : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="ac-card space-y-3 p-5 xl:col-span-2">
          <CardTitle icon={Bot} tone="purple">AI Prompt 配置</CardTitle>
          <label className="ac-field">
            <span>歌曲 / 专辑导览 Prompt</span>
            <textarea
              className="ac-textarea min-h-[120px]"
              rows={5}
              value={aiPromptDraft}
              onChange={(event) => setAiPromptDraft(event.target.value)}
              placeholder="用于添加歌曲或专辑时生成导览。可写风格、字数、禁用表达等。"
            />
          </label>
          <label className="ac-field">
            <span>音乐侧写 Prompt</span>
            <textarea
              className="ac-textarea min-h-[120px]"
              rows={5}
              value={personaPromptDraft}
              onChange={(event) => setPersonaPromptDraft(event.target.value)}
              placeholder="用于个人页音乐侧写和继续对话。建议简洁写：更像朋友、更自然、根据用户资料、评论和所选歌曲分析并推荐新音乐。"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {numberFields.map(([label, value, setter, attrs]) => (
              <label key={label} className="ac-field">
                <span>{label}</span>
                <input
                  className="ac-input"
                  type="number"
                  min={attrs.min}
                  max={attrs.max}
                  step={attrs.step}
                  value={value}
                  onChange={(event) => setter(Number(event.target.value))}
                />
              </label>
            ))}
          </div>
          <button type="button" className="ac-btn ac-btn-primary" onClick={saveAiConfig}>
            <Wand2 size={15} aria-hidden="true" />保存 AI 配置
          </button>
        </article>

        <article className="ac-card p-5">
          <CardTitle icon={DoorOpen}>房间</CardTitle>
          <div className="ac-scroll max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
            {(adminData?.rooms || []).length ? (adminData?.rooms || []).map((room) => (
              <div key={room.id} className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[0.85rem] font-semibold text-paper">{room.name}</strong>
                  <span className="block truncate text-[0.7rem] text-paper-faint">
                    {room.id} · {room.itemCount} 条目 · {room.commentCount} 评论 · {room.members} 成员
                  </span>
                </div>
                <button type="button" className="ac-btn ac-btn-danger shrink-0 px-2.5 py-1.5 text-[0.72rem]" onClick={() => deleteRoom(room.id)}>
                  <Trash2 size={13} aria-hidden="true" />删除
                </button>
              </div>
            )) : <p className="ac-empty text-[0.82rem]">还没有房间数据，点击「刷新」加载。</p>}
          </div>
        </article>

        <article className="ac-card p-5">
          <CardTitle icon={Users} tone="green">用户</CardTitle>
          <div className="ac-scroll max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
            {(adminData?.users || []).length ? (adminData?.users || []).map((user) => (
              <div key={user.id} className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[0.85rem] font-semibold text-paper">{user.name}</strong>
                  <span className="block truncate text-[0.7rem] text-paper-faint">{user.email} · {user.role}</span>
                </div>
                {user.role !== 'admin' ? (
                  <button type="button" className="ac-btn ac-btn-danger shrink-0 px-2.5 py-1.5 text-[0.72rem]" onClick={() => deleteUser(user.id)}>
                    <Trash2 size={13} aria-hidden="true" />删除
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full border border-accent-gold/25 bg-accent-gold/10 px-2.5 py-1 text-[0.68rem] font-semibold text-accent-gold">
                    admin
                  </span>
                )}
              </div>
            )) : <p className="ac-empty text-[0.82rem]">还没有用户数据，点击「刷新」加载。</p>}
          </div>
        </article>
      </section>
    </div>
  );
}

/* ---------------------------------- 房间页 ---------------------------------- */

export function RoomPanel({
  room, roomUrl, session, comments, items, knownRooms, discoverRooms, switchRoom, roomDraft, setRoomDraft,
  createAnotherRoom, inviteDraft, setInviteDraft, invitePassword, setInvitePassword, joinAnotherRoom,
  roomStatus, roomSettingsDraft, setRoomSettingsDraft, saveRoomSettings, userSettings, saveUserSettings
}) {
  const canEditRoom = room.ownerId === session.user.id || session.user.role === 'admin';
  const heroDraft = editableHeroConfig(roomSettingsDraft.heroConfig, room);
  const updateHeroDraft = (patch) => {
    setRoomSettingsDraft((current) => ({
      ...current,
      heroConfig: editableHeroConfig({ ...(current.heroConfig || {}), ...patch }, room)
    }));
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard?.writeText(roomUrl);
      toast.success('邀请链接已复制');
    } catch {
      toast.error('复制失败，请手动选择链接');
    }
  };

  return (
    <div className="ac-page animate-fade-in">
      <header className="space-y-2">
        <p className="ac-eyebrow"><Users size={13} aria-hidden="true" /> room</p>
        <h2 className="ac-h1">{room.name}</h2>
        <p className="ac-body max-w-[64ch]">
          登录为 {session.user.name}。你可以公开浏览朋友的展柜，输入密码加入房间后再评论、复制和添加音乐。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <code className="ac-scroll min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-white/[0.08] bg-ink-950/50 px-3.5 py-2.5 font-mono text-[0.75rem] text-paper-dim">
          {roomUrl}
        </code>
        <button type="button" className="ac-btn ac-btn-primary shrink-0" onClick={copyInvite}>
          <Share2 size={15} aria-hidden="true" />复制邀请链接
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          [items.length, '展柜条目'],
          [comments.length, '房间评论'],
          [Object.keys(room.memberProfiles || {}).length, '成员']
        ].map(([value, label]) => (
          <article key={label} className="ac-card px-4 py-4 text-center">
            <strong className="block text-2xl font-black tabular-nums text-paper">{value}</strong>
            <p className="mt-0.5 text-[0.72rem] text-paper-faint">{label}</p>
          </article>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="ac-card p-5">
          <CardTitle icon={DoorOpen}>切换房间</CardTitle>
          <div className="ac-scroll max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
            {knownRooms.map((knownRoom) => {
              const active = knownRoom.id === room.id;
              return (
                <button
                  key={knownRoom.id}
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => switchRoom(knownRoom.id)}
                  className={[
                    'flex w-full flex-col gap-0.5 rounded-lg border px-3.5 py-2.5 text-left transition-all duration-200 ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60',
                    active
                      ? 'border-accent-sky/40 bg-accent-sky/12'
                      : 'border-white/[0.07] hover:border-white/15 hover:bg-white/[0.05]'
                  ].join(' ')}
                >
                  <strong className={['truncate text-[0.85rem] font-semibold', active ? 'text-accent-sky' : 'text-paper'].join(' ')}>
                    {knownRoom.name}
                  </strong>
                  <span className="text-[0.7rem] text-paper-faint">{Object.keys(knownRoom.memberProfiles || {}).length} 位成员</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="ac-card p-5">
          <CardTitle icon={Search} tone="green">公开房间</CardTitle>
          <div className="ac-scroll max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
            {(discoverRooms || []).length ? (discoverRooms || []).map((knownRoom) => (
              <button
                key={knownRoom.id}
                type="button"
                onClick={() => switchRoom(knownRoom.id)}
                className="flex w-full flex-col gap-0.5 rounded-lg border border-white/[0.07] px-3.5 py-2.5 text-left transition-all duration-200 ease-soft hover:border-white/15 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
              >
                <strong className="truncate text-[0.85rem] font-semibold text-paper">{knownRoom.name}</strong>
                <span className="text-[0.7rem] text-paper-faint">
                  {knownRoom.itemCount} 条目 · {knownRoom.joinMode === 'password' ? '密码加入' : '开放加入'}
                </span>
              </button>
            )) : <p className="ac-empty py-8 text-[0.82rem]">还没有公开房间。</p>}
          </div>
        </article>

        <article className="ac-card space-y-3 p-5">
          <CardTitle icon={Plus} tone="gold">创建新房间</CardTitle>
          <label className="ac-field">
            <span>房间名称</span>
            <input className="ac-input" value={roomDraft} onChange={(event) => setRoomDraft(event.target.value)} />
          </label>
          <button type="button" className="ac-btn ac-btn-primary w-full justify-center" onClick={createAnotherRoom}>
            创建并切换
          </button>
        </article>

        <article className="ac-card space-y-3 p-5">
          <CardTitle icon={Share2} tone="purple">加入邀请</CardTitle>
          <label className="ac-field">
            <span>邀请链接或房间 ID</span>
            <input className="ac-input" value={inviteDraft} onChange={(event) => setInviteDraft(event.target.value)} placeholder="https://.../?room=..." />
          </label>
          <label className="ac-field">
            <span>房间密码</span>
            <input className="ac-input" type="password" value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} placeholder="公开房间可留空" />
          </label>
          <button type="button" className="ac-btn ac-btn-primary w-full justify-center" onClick={joinAnotherRoom}>
            加入并切换
          </button>
        </article>

        <article className="ac-card space-y-3 p-5">
          <CardTitle icon={LockKeyhole}>房间设置</CardTitle>
          {!canEditRoom ? (
            <p className="ac-status">只有房主或管理员可以修改这些设置。</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ac-field">
              <span>可见性</span>
              <select
                className="ac-select"
                disabled={!canEditRoom}
                value={roomSettingsDraft.visibility}
                onChange={(event) => setRoomSettingsDraft((current) => ({
                  ...current,
                  visibility: event.target.value,
                  discoverable: event.target.value === 'public' ? current.discoverable : false
                }))}
              >
                <option value="unlisted">不公开</option>
                <option value="public">公开浏览</option>
                <option value="private">私密</option>
              </select>
            </label>
            <label className="ac-field">
              <span>加入方式</span>
              <select
                className="ac-select"
                disabled={!canEditRoom}
                value={roomSettingsDraft.joinMode}
                onChange={(event) => setRoomSettingsDraft((current) => ({ ...current, joinMode: event.target.value }))}
              >
                <option value="open">开放加入</option>
                <option value="password">密码加入</option>
                <option value="ownerOnly">仅房主邀请</option>
              </select>
            </label>
          </div>
          <label className="ac-check-line">
            <input
              type="checkbox"
              className="ac-checkbox"
              disabled={!canEditRoom || roomSettingsDraft.visibility !== 'public'}
              checked={Boolean(roomSettingsDraft.discoverable)}
              onChange={(event) => setRoomSettingsDraft((current) => ({ ...current, discoverable: event.target.checked }))}
            />
            出现在公开房间列表
          </label>
          <label className="ac-field">
            <span>简介</span>
            <textarea
              className="ac-textarea"
              rows={3}
              disabled={!canEditRoom}
              value={roomSettingsDraft.description}
              onChange={(event) => setRoomSettingsDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="写一句这个房间的听歌主题。"
            />
          </label>
          <label className="ac-field">
            <span>新密码</span>
            <input
              className="ac-input"
              type="password"
              disabled={!canEditRoom || roomSettingsDraft.joinMode !== 'password'}
              value={roomSettingsDraft.password}
              onChange={(event) => setRoomSettingsDraft((current) => ({ ...current, password: event.target.value }))}
              placeholder="留空则沿用旧密码"
            />
          </label>

          <div className="space-y-3 border-t border-white/[0.07] pt-4">
            <div className="ac-section-title">
              <Sparkles size={16} className="text-accent-gold" aria-hidden="true" />
              <h4 className="text-[0.88rem] font-bold text-paper">首页主题</h4>
            </div>
            {[
              ['小标题', 'eyebrow', ''],
              ['主标题', 'title', '留空使用房间名'],
              ['副标题', 'titleSuffix', '']
            ].map(([label, key, placeholder]) => (
              <label key={key} className="ac-field">
                <span>{label}</span>
                <input
                  className="ac-input"
                  disabled={!canEditRoom}
                  value={heroDraft[key]}
                  onChange={(event) => updateHeroDraft({ [key]: event.target.value })}
                  placeholder={placeholder}
                />
              </label>
            ))}
            <label className="ac-field">
              <span>首页文案</span>
              <textarea
                className="ac-textarea"
                rows={3}
                disabled={!canEditRoom}
                value={heroDraft.description}
                onChange={(event) => updateHeroDraft({ description: event.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="ac-field">
                <span>视觉模式</span>
                <select className="ac-select" disabled={!canEditRoom} value={heroDraft.visualMode} onChange={(event) => updateHeroDraft({ visualMode: event.target.value })}>
                  <option value="observatory">观测室</option>
                  <option value="vinyl">黑胶舞台</option>
                  <option value="editorial">杂志大片</option>
                </select>
              </label>
              <label className="ac-field">
                <span>动效</span>
                <select className="ac-select" disabled={!canEditRoom} value={heroDraft.motionLevel} onChange={(event) => updateHeroDraft({ motionLevel: event.target.value })}>
                  <option value="ambient">轻动效</option>
                  <option value="cinematic">电影感</option>
                  <option value="still">静态</option>
                </select>
              </label>
            </div>
            <label className="ac-field">
              <span>主题名</span>
              <input className="ac-input" disabled={!canEditRoom} value={heroDraft.accentName} onChange={(event) => updateHeroDraft({ accentName: event.target.value })} />
            </label>
            <label className="ac-field">
              <span>背景图 URL</span>
              <input
                className="ac-input"
                disabled={!canEditRoom}
                value={heroDraft.backgroundUrl}
                onChange={(event) => updateHeroDraft({ backgroundUrl: event.target.value })}
                placeholder="可留空，默认跟随当前专辑封面"
              />
            </label>
          </div>

          <button type="button" className="ac-btn ac-btn-primary w-full justify-center" disabled={!canEditRoom} onClick={saveRoomSettings}>
            保存设置
          </button>
        </article>

        <UserSettingsCard userSettings={userSettings} saveUserSettings={saveUserSettings} />
      </section>

      {roomStatus ? <p className="ac-status" aria-live="polite">{roomStatus}</p> : null}
    </div>
  );
}

/* -------------------------------- 我的显示设置 -------------------------------- */

export function UserSettingsCard({ userSettings, saveUserSettings }) {
  const [draft, setDraft] = useState(() => mergeUserSettings(userSettings));
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(mergeUserSettings(userSettings));
  }, [userSettings]);

  const update = (group, patch) => setDraft((current) => mergeUserSettings({
    ...current,
    [group]: { ...(current[group] || {}), ...patch }
  }));

  const save = async () => {
    setSaving(true);
    setStatus('正在同步到账号');
    try {
      await saveUserSettings(draft);
      setStatus('设置已同步到账号');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="ac-card space-y-3 p-5">
      <CardTitle icon={Sparkles} tone="gold">我的显示设置</CardTitle>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="ac-field">
          <span>主题策略</span>
          <select className="ac-select" value={draft.appearance.themeStrategy} onChange={(event) => update('appearance', { themeStrategy: event.target.value })}>
            <option value="cover">跟随封面</option>
            <option value="room">跟随房间</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        <label className="ac-field">
          <span>自定义主题</span>
          <input
            type="color"
            value={draft.appearance.customTheme}
            onChange={(event) => update('appearance', { customTheme: event.target.value })}
            className="h-[38px] w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
          />
        </label>
      </div>

      <label className="ac-field">
        <span className="flex items-center justify-between">
          玻璃强度
          <b className="font-bold tabular-nums text-accent-sky">{draft.appearance.glass}</b>
        </span>
        <input
          type="range"
          className="ac-range"
          min="35"
          max="82"
          value={draft.appearance.glass}
          onChange={(event) => update('appearance', { glass: Number(event.target.value) })}
        />
      </label>

      <div className="space-y-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3.5">
        <label className="ac-check-line">
          <input type="checkbox" className="ac-checkbox" checked={draft.appearance.reduceMotion} onChange={(event) => update('appearance', { reduceMotion: event.target.checked })} />
          减少动效
        </label>
        <label className="ac-check-line">
          <input type="checkbox" className="ac-checkbox" checked={draft.appearance.rainbowStatus} onChange={(event) => update('appearance', { rainbowStatus: event.target.checked })} />
          搜索和 AI 生成时显示彩虹呼吸边缘
        </label>
        <label className="ac-check-line">
          <input type="checkbox" className="ac-checkbox" checked={draft.filters.mineOnly} onChange={(event) => update('filters', { mineOnly: event.target.checked })} />
          默认只看自己添加
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="ac-field">
          <span>AI 语气</span>
          <select className="ac-select" value={draft.persona.tone} onChange={(event) => update('persona', { tone: event.target.value })}>
            <option value="warm">温暖</option>
            <option value="mystic">神秘</option>
            <option value="critic">乐评</option>
            <option value="playful">好玩</option>
          </select>
        </label>
        <label className="ac-field">
          <span>分析范围</span>
          <select className="ac-select" value={draft.persona.historyMode} onChange={(event) => update('persona', { historyMode: event.target.value })}>
            <option value="selected">只分析勾选</option>
            <option value="mine">我添加的全部音乐</option>
            <option value="room">所在房间全部音乐</option>
            <option value="none">只使用填写资料</option>
          </select>
        </label>
      </div>

      <button type="button" className="ac-btn ac-btn-primary w-full justify-center" onClick={save} disabled={saving}>
        {saving ? '正在保存…' : '保存我的设置'}
      </button>
      {status ? <p className="ac-status" aria-live="polite">{status}</p> : null}
    </article>
  );
}
