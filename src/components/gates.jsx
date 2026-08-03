import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Disc3,
  DoorOpen,
  Library,
  LockKeyhole,
  MessageCircle,
  Plus,
  Share2,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import { avatarOptions } from '../lib/utils.js';
import { useAppStore } from '../store/useAppStore.js';

/* ============================================================
   AuthGate — 登录 / 注册
   ============================================================ */
export function AuthGate() {
  const session = useAppStore((s) => s.session);
  const login = useAppStore((s) => s.login);
  const signup = useAppStore((s) => s.signup);
  const storeStatus = useAppStore((s) => s.authStatus);

  const [authMode, setAuthMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', avatar: 'M' });
  const [status, setStatus] = useState('');

  useEffect(() => setStatus(storeStatus), [storeStatus]);

  const submit = async () => {
    setStatus('');
    try {
      const action = authMode === 'signup' ? signup : login;
      await action({ ...form });
    } catch {
      // store 已设置 authStatus；status 会同步
    }
  };

  if (session?.token) return null;

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-ink-950 px-4 py-12 text-paper">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-1/4 h-[45vmax] w-[45vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-sky/20 blur-[120px] animate-drift" />
        <div className="absolute bottom-1/4 right-1/4 h-[40vmax] w-[40vmax] translate-x-1/3 translate-y-1/3 rounded-full bg-accent-gold/15 blur-[110px] animate-drift [animation-delay:-6s]" />
      </div>

      <section className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.08] p-6 shadow-card backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent-sky to-accent-gold text-ink-900">
            <Disc3 size={22} />
          </div>
          <div>
            <strong className="block text-base font-semibold">Album Circle</strong>
            <span className="text-sm text-paper-dim">为朋友创建一个共同听歌房间</span>
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-paper-dim">
            <LockKeyhole size={14} /> account
          </p>
          <h1 className="mb-3 text-3xl font-semibold leading-tight sm:text-4xl">登录后创建房间，收藏歌曲和专辑。</h1>
          <p className="text-sm text-paper-dim">你的评论、添加记录和房间成员身份会同步保存。</p>
        </div>

        <div className="mb-6 flex gap-2 rounded-full border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              authMode === 'login' ? 'bg-paper text-ink-900 shadow-soft' : 'text-paper-dim hover:text-paper'
            }`}
            onClick={() => setAuthMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              authMode === 'signup' ? 'bg-paper text-ink-900 shadow-soft' : 'text-paper-dim hover:text-paper'
            }`}
            onClick={() => setAuthMode('signup')}
          >
            注册
          </button>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {authMode === 'signup' && (
            <label className="flex flex-col gap-1.5 text-sm">
              昵称
              <input
                value={form.name}
                onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                placeholder="Ming"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-paper-faint focus:border-accent-sky focus:outline-none"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            邮箱
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-paper-faint focus:border-accent-sky focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            密码
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
              placeholder="至少 6 位"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-paper-faint focus:border-accent-sky focus:outline-none"
            />
          </label>

          {authMode === 'signup' && (
            <div aria-label="头像选择" className="flex flex-wrap gap-2">
              {avatarOptions.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => setForm((value) => ({ ...value, avatar }))}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg transition-all ${
                    form.avatar === avatar
                      ? 'border-accent-sky bg-accent-sky/20 text-paper'
                      : 'border-white/10 bg-white/5 text-paper-dim hover:border-white/20 hover:text-paper'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-paper py-2.5 text-sm font-semibold text-ink-900 transition-all hover:scale-[1.02] hover:shadow-glow active:scale-[0.98]"
          >
            <UserRound size={16} />
            {authMode === 'signup' ? '创建账户' : '登录'}
          </button>
        </form>

        {status && (
          <p className="mt-4 text-center text-sm text-accent-pink">{status}</p>
        )}
      </section>
    </main>
  );
}

/* ============================================================
   RoomGate — 选择 / 加入 / 创建房间
   ============================================================ */
export function RoomGate() {
  const session = useAppStore((s) => s.session);
  const room = useAppStore((s) => s.room);
  const knownRooms = useAppStore((s) => s.knownRooms);
  const discoverRooms = useAppStore((s) => s.discoverRooms);
  const roomStatus = useAppStore((s) => s.roomStatus);
  const createRoom = useAppStore((s) => s.createRoom);
  const enterRoom = useAppStore((s) => s.enterRoom);
  const refreshRooms = useAppStore((s) => s.refreshRooms);

  const [name, setName] = useState('周五听歌房');
  const [joinId, setJoinId] = useState(new URLSearchParams(window.location.search).get('room') || '');
  const [joinPassword, setJoinPassword] = useState('');
  const autoOpenRef = useRef(false);

  useEffect(() => {
    if (!session?.token || room) return;
    refreshRooms();
  }, [room, session?.token, refreshRooms]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('room') || '';
    if (!session?.token || room || autoOpenRef.current || !requested) return;
    autoOpenRef.current = true;
    enterRoom(requested);
  }, [room, session?.token, enterRoom]);

  const joinRoom = async (id = joinId) => {
    const raw = String(id || '').trim();
    let parsed = raw;
    if (raw.includes('room=')) {
      try {
        parsed = new URL(raw, window.location.origin).searchParams.get('room') || raw;
      } catch {
        parsed = raw.replace(/^.*room=/, '').split('&')[0];
      }
    }
    parsed = String(parsed || '').trim();
    if (!parsed) return;
    try {
      // 加入房间复用 enterRoom；若后端需要密码，可后续扩展
      await enterRoom(parsed);
    } catch {
      // store 已设置 roomStatus
    }
  };

  if (!session?.token || room) return null;

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center overflow-x-hidden bg-ink-950 px-4 py-8 text-paper sm:py-12 lg:justify-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-1/4 h-[45vmax] w-[45vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-sky/18 blur-[120px] animate-drift" />
        <div className="absolute bottom-1/4 right-1/4 h-[40vmax] w-[40vmax] translate-x-1/3 translate-y-1/3 rounded-full bg-accent-gold/12 blur-[110px] animate-drift [animation-delay:-6s]" />
      </div>

      <section className="relative grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_1.4fr]">
        <aside className="flex flex-col justify-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent-sky to-accent-gold text-ink-900">
              <Disc3 size={22} />
            </div>
            <div>
              <strong className="block text-base font-semibold">{session.user.name || 'Album Circle'}</strong>
              <span className="text-sm text-paper-dim">选择一个房间继续听</span>
            </div>
          </div>

          <div className="max-w-md">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-paper-dim">
              <Library size={14} /> room lobby
            </p>
            <h1 className="mb-3 text-3xl font-semibold leading-tight sm:text-4xl">进入你的听歌房间。</h1>
            <p className="text-sm text-paper-dim">从已加入的房间继续听，或用邀请码进入新的展柜。评论、评分和成员设置都会留在对应房间里。</p>
          </div>

          <div aria-label="房间功能摘要" className="flex flex-wrap gap-3 text-sm text-paper-dim">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Users size={14} />成员同步
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <MessageCircle size={14} />评论留存
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Star size={14} />独立评分
            </span>
          </div>
        </aside>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.08] p-5 shadow-card backdrop-blur-xl sm:p-6">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-paper-dim">
                <DoorOpen size={14} /> your rooms
              </p>
              <h2 className="text-lg font-semibold">已加入的房间</h2>
              <p className="text-sm text-paper-dim">选择一个房间继续浏览展柜、评论和评分。</p>
            </div>
            {knownRooms.length > 0 ? (
              <div className="flex flex-col gap-2">
                {knownRooms.map((knownRoom) => (
                  <button
                    key={knownRoom.id}
                    type="button"
                    onClick={() => enterRoom(knownRoom.id)}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-all hover:border-accent-sky/40 hover:bg-white/[0.08]"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-medium">{knownRoom.name}</strong>
                      <small className="text-xs text-paper-dim">
                        {knownRoom.itemCount || 0} 条目 · {knownRoom.commentCount || 0} 评论
                      </small>
                    </span>
                    <ChevronRight size={17} className="shrink-0 text-paper-dim transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.03] py-8 text-center text-sm text-paper-dim">
                <Disc3 size={30} className="mb-1 text-paper-faint" />
                <strong className="text-paper">还没有加入任何房间</strong>
                <span>用右侧邀请码加入一个房间，或先创建自己的听歌房间。</span>
              </div>
            )}
          </article>

          <article className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.08] p-5 shadow-card backdrop-blur-xl sm:p-6">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-paper-dim">
                <Share2 size={14} /> invite
              </p>
              <h2 className="text-lg font-semibold">加入新的房间</h2>
              <p className="text-sm text-paper-dim">粘贴邀请链接或 room ID；如果房间设置了密码，在下面填写。</p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              邀请码或房间 ID
              <input
                value={joinId}
                onChange={(event) => setJoinId(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && joinRoom()}
                placeholder="邀请链接里的 room"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-paper-faint focus:border-accent-sky focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              房间密码
              <input
                type="password"
                value={joinPassword}
                onChange={(event) => setJoinPassword(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && joinRoom()}
                placeholder="公开房间可留空"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-paper-faint focus:border-accent-sky focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => joinRoom()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-paper py-2.5 text-sm font-semibold text-ink-900 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Users size={16} />加入房间
            </button>
            {discoverRooms.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                <strong className="text-xs font-medium uppercase tracking-wider text-paper-dim">公开房间</strong>
                {discoverRooms.map((knownRoom) => (
                  <button
                    key={knownRoom.id}
                    type="button"
                    onClick={() => { setJoinId(knownRoom.id); joinRoom(knownRoom.id); }}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:border-white/20"
                  >
                    <span className="truncate">{knownRoom.name}</span>
                    <small className="shrink-0 text-xs text-paper-dim">
                      {knownRoom.itemCount} 条目 · {knownRoom.joinMode === 'password' ? '需要密码' : '可加入'}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.08] p-5 shadow-card backdrop-blur-xl sm:p-6">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-paper-dim">
                <Plus size={14} /> create room
              </p>
              <h2 className="text-lg font-semibold">创建新的听歌房间</h2>
              <p className="text-sm text-paper-dim">适合给一轮主题、朋友聚会或长期歌单开一个展柜。</p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              房间名称
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-paper-faint focus:border-accent-sky focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => createRoom(name)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-paper py-2.5 text-sm font-semibold text-ink-900 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <DoorOpen size={16} />创建房间
            </button>
          </article>

          {roomStatus && (
            <article className="flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.08] p-5 text-center text-sm text-paper-dim shadow-card backdrop-blur-xl">
              {roomStatus}
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
