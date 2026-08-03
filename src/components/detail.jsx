import React from 'react';
import { useState } from 'react';
import { Album, ArrowUpRight, BookOpen, Bot, ChevronRight, CirclePlus, Disc3, Grid3X3, MessageCircle, Music2, Radio, Send, Star, Trash2 } from 'lucide-react';
import { AuthorChip, AlbumArt, RatingPanel } from './common.jsx';
import ImmersiveDetail from '../ImmersiveDetail.jsx';
import { trackTitle, trackArtist, sameAlbum, trackMatchesTitle, providerLabel, listeningLinksFor } from '../lib/utils.js';

/* ---------------------------------- 局部原子 ---------------------------------- */

function SectionTitle({ icon: Icon, children, actions }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="ac-section-title">
        {Icon ? <Icon size={17} className="text-accent-sky" aria-hidden="true" /> : null}
        <h3 className="text-[0.95rem] font-bold tracking-tight text-paper">{children}</h3>
      </div>
      {actions}
    </div>
  );
}

function CommentCard({ comment, author, canDelete, onDelete, onOpenMember }) {
  return (
    <article
      className={[
        'ac-card group/comment relative p-4 transition-all duration-300 ease-soft',
        'hover:border-white/15 hover:bg-white/[0.05]',
        comment.pending ? 'animate-pulse opacity-70' : 'animate-fade-in'
      ].join(' ')}
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <AuthorChip
          profile={author}
          fallbackName={comment.author}
          fallbackAvatar={comment.avatar}
          onOpen={onOpenMember}
        />
        {comment.mood ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-gold/25 bg-accent-gold/10 px-2.5 py-1 text-[0.7rem] font-semibold text-accent-gold">
            <Star size={12} aria-hidden="true" /> {comment.mood}
          </span>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-[0.9rem] leading-relaxed text-paper-dim">{comment.text}</p>
      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.72rem] font-medium text-paper-faint opacity-0 transition hover:bg-accent-red/12 hover:text-accent-red focus-visible:opacity-100 group-hover/comment:opacity-100 md:text-[0.72rem]"
        >
          <Trash2 size={13} aria-hidden="true" />
          删除评论
        </button>
      ) : null}
    </article>
  );
}

function CommentSkeletons({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="ac-card space-y-3 p-4" aria-hidden="true">
          <div className="flex items-center gap-2">
            <div className="ac-skeleton h-8 w-8 rounded-full" />
            <div className="ac-skeleton h-3 w-24 rounded-full" />
          </div>
          <div className="ac-skeleton h-3 w-full rounded-full" />
          <div className="ac-skeleton h-3 w-4/5 rounded-full" />
        </div>
      ))}
    </>
  );
}

/* --------------------------------- 详情主页面 --------------------------------- */

export function AlbumDetailPage({
  items, activeItem, activeComments, draft, setDraft, submitComment, commentStatus, commentAiStatus,
  setActiveId, setMode, openCabinet, openItemDetail, askAi, itemStatus, session, deleteItem, deleteComment,
  memberProfilesById, openMember, ratingSummary, submitRating, loading, ratingStatus
}) {
  const [immersive, setImmersive] = useState(false);

  const selectItem = (id) => {
    setActiveId(id);
    openItemDetail(id);
  };

  const parentAlbum = activeItem?.type === 'song'
    ? items.find((item) => item.type === 'album' && sameAlbum(item, activeItem))
    : null;
  const relatedSongs = activeItem
    ? items.filter((item) => item.type === 'song' && item.id !== activeItem.id && sameAlbum(item, activeItem))
    : [];
  const siblingSongs = activeItem
    ? items.filter((item) => item.type === 'song' && sameAlbum(item, activeItem))
    : [];
  const albumContextItem = activeItem?.type === 'song' ? (parentAlbum || activeItem) : activeItem;
  const tracks = albumContextItem?.tracks?.length ? albumContextItem.tracks : activeItem ? [activeItem.title] : [];
  const activeTrackIndex = activeItem?.type === 'song'
    ? tracks.findIndex((track) => trackMatchesTitle(track, activeItem.title))
    : -1;
  const profile = activeItem?.aiProfile || {};
  const genreTags = profile.genre?.length ? profile.genre : activeItem?.tags || [];
  const guide = profile.listeningGuide?.length
    ? profile.listeningGuide
    : tracks.slice(0, 5).map((track, index) => `${index + 1}. ${trackTitle(track) || `Track ${index + 1}`}`);
  const prompts = profile.discussionPrompts?.length
    ? profile.discussionPrompts
    : ['你最先被哪一个段落吸引？', '这首歌适合推荐给谁？', '你会从同专辑继续听哪一首？'];
  const listeningLinks = listeningLinksFor(activeItem);
  const canDeleteActive = activeItem && (activeItem.addedById === session?.user?.id || session?.user?.role === 'admin');
  const activeAdder = activeItem?.addedById ? memberProfilesById?.[activeItem.addedById] : null;

  const aiNotes = [
    ['专辑位置', profile.albumContext],
    ['创作语境', profile.creativeBackground],
    ['旋律动机', profile.melodyMotif],
    ['歌词视角', profile.lyricPerspective],
    ['编曲层次', profile.arrangement],
    ['发行状态', profile.releaseState]
  ].filter(([, value]) => value);

  if (!items.length) {
    return (
      <div className="ac-page items-center justify-center py-20 text-center">
        <div className="ac-empty animate-scale-in max-w-md">
          <Disc3 size={46} className="mx-auto mb-4 animate-slow-spin text-accent-sky/60" aria-hidden="true" />
          <h2 className="ac-h2 mb-2">展柜还没有内容</h2>
          <p className="ac-body mb-6">从歌曲或专辑开始，把朋友的推荐放进这个房间。</p>
          <button type="button" className="ac-btn ac-btn-primary mx-auto" onClick={() => setMode('add')}>
            <CirclePlus size={16} aria-hidden="true" />
            添加第一条
          </button>
        </div>
      </div>
    );
  }

  if (!activeItem) {
    return (
      <div className="ac-page items-center justify-center py-20 text-center">
        <div className="ac-empty max-w-md">
          <Album size={40} className="mx-auto mb-4 text-paper-faint" aria-hidden="true" />
          <p className="ac-body">先在展柜里选择一张专辑或一首歌。</p>
          <button type="button" className="ac-btn ac-btn-ghost mx-auto mt-5" onClick={openCabinet}>
            <Grid3X3 size={16} aria-hidden="true" />
            返回展柜
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page animate-fade-in">
      {/* 顶部：封面 + 主要信息 */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* 封面栈 */}
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={openCabinet}
            className="ac-btn ac-btn-ghost w-fit text-[0.78rem]"
          >
            <Grid3X3 size={15} aria-hidden="true" />
            返回展柜
          </button>

          <div className="group relative">
            <div
              className="pointer-events-none absolute -inset-6 -z-10 rounded-full opacity-45 blur-3xl transition-opacity duration-700 group-hover:opacity-70"
              style={{ background: 'radial-gradient(circle at 50% 45%, var(--cover-a, #38bdf8), transparent 68%)' }}
              aria-hidden="true"
            />
            <AlbumArt
              item={activeItem}
              size="large"
              className="w-full rounded-xl shadow-card ring-1 ring-white/10 transition-transform duration-500 ease-soft group-hover:-translate-y-1 group-hover:scale-[1.015]"
            />
            <div
              className="pointer-events-none absolute inset-x-6 -bottom-3 h-8 rounded-[50%] bg-ink-950/70 blur-xl"
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            className="ac-btn ac-btn-ghost w-full justify-center lg:hidden"
            onClick={() => setImmersive(true)}
          >
            <BookOpen size={16} aria-hidden="true" />
            沉浸阅读
          </button>
        </div>

        {/* 主信息 */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="space-y-2.5">
            <p className="ac-eyebrow">
              <Album size={13} aria-hidden="true" />
              {activeItem.type === 'album' ? 'album' : 'song'} in showroom
            </p>
            <h2 className="ac-h1 break-words">{activeItem.title}</h2>
            <p className="text-[0.95rem] font-medium text-paper-dim">
              {activeItem.artist}
              {(activeItem.albumTitle || activeItem.year) ? ` · ${activeItem.albumTitle || activeItem.year}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              `${tracks.length} 首曲目`,
              `${siblingSongs.length || relatedSongs.length} 首已收录歌曲`,
              `${activeComments.length} 条评论`
            ].map((stat) => (
              <span
                key={stat}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.74rem] font-semibold text-paper-dim"
              >
                {stat}
              </span>
            ))}
          </div>

          {(profile.overview || activeItem.background || activeItem.context) ? (
            <p className="ac-body max-w-[62ch]">{profile.overview || activeItem.background || activeItem.context}</p>
          ) : null}

          {genreTags.length > 0 ? (
            <div className="ac-tag-row">
              {genreTags.slice(0, 6).map((tag) => <span key={tag} className="ac-tag">{tag}</span>)}
            </div>
          ) : null}

          {/* 操作区 */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              className="ac-btn ac-btn-primary group/imm hidden lg:inline-flex"
              onClick={() => setImmersive(true)}
            >
              <BookOpen size={16} aria-hidden="true" />
              <span>沉浸阅读</span>
              <ArrowUpRight
                size={14}
                aria-hidden="true"
                className="transition-transform duration-300 ease-spring group-hover/imm:translate-x-0.5 group-hover/imm:-translate-y-0.5"
              />
            </button>
            <button type="button" className="ac-btn ac-btn-ghost" onClick={askAi}>
              <Bot size={15} aria-hidden="true" />
              请求 AI 推荐
            </button>
            <button type="button" className="ac-btn ac-btn-ghost" onClick={() => setMode('add')}>
              <CirclePlus size={15} aria-hidden="true" />
              继续添加
            </button>
            {canDeleteActive ? (
              <button type="button" className="ac-btn ac-btn-danger" onClick={() => deleteItem(activeItem)}>
                <Trash2 size={15} aria-hidden="true" />
                删除条目
              </button>
            ) : null}
          </div>

          <RatingPanel ratingSummary={ratingSummary} submitRating={submitRating} ratingStatus={ratingStatus} />

          {listeningLinks.length > 0 ? (
            <div className="ac-card p-4">
              <div className="ac-section-title mb-3">
                <Radio size={15} className="text-accent-green" aria-hidden="true" />
                <strong className="text-[0.85rem] font-bold text-paper">聆听入口</strong>
              </div>
              <div className="flex flex-wrap gap-2">
                {listeningLinks.map((link, index) => (
                  <a
                    key={`${link.provider}-${link.type || index}-${link.url}-${index}`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group/link inline-flex flex-col rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-accent-sky/35 hover:bg-accent-sky/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
                  >
                    <span className="text-[0.8rem] font-semibold text-paper group-hover/link:text-accent-sky">
                      {providerLabel(link.provider)}
                    </span>
                    <span className="text-[0.68rem] text-paper-faint">
                      {link.confidence === 'exact' ? '精确链接' : link.source === 'user' ? '用户提供' : '搜索匹配'}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-paper-faint">添加者 / 来源</span>
            <div className="flex flex-wrap items-center gap-3">
              <AuthorChip
                profile={activeAdder}
                fallbackName={activeItem.addedBy}
                fallbackAvatar={activeItem.addedByAvatar}
                onOpen={openMember}
              />
              {activeItem.source ? (
                <strong className="text-[0.78rem] font-semibold text-paper-dim">{activeItem.source}</strong>
              ) : null}
            </div>
          </div>

          {itemStatus ? (
            <p className="ac-status" aria-live="polite">
              {itemStatus === 'cloud' ? '已同步到房间展柜。' : itemStatus}
            </p>
          ) : null}
        </div>
      </section>

      {/* 曲目 + AI 档案 */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* 曲目列表 */}
        <section className="ac-card p-5">
          <SectionTitle icon={Music2}>{activeItem.type === 'album' ? '专辑曲目' : '所属专辑'}</SectionTitle>

          {activeItem.type === 'song' ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-sky/18 bg-accent-sky/[0.07] p-4">
              <div className="min-w-0 space-y-1">
                <span className="ac-eyebrow">收录于</span>
                <strong className="block truncate text-[0.95rem] font-bold text-paper">
                  {activeItem.albumTitle || parentAlbum?.title || '未知专辑'}
                </strong>
                <p className="ac-muted max-w-[46ch]">
                  {parentAlbum
                    ? `${parentAlbum.tracks?.length || tracks.length} 首曲目已同步，可从这里回到整张专辑。`
                    : '这首歌已带入专辑名；加入同名专辑后会自动合并到完整曲目上下文。'}
                </p>
              </div>
              {parentAlbum ? (
                <button type="button" className="ac-btn ac-btn-ghost shrink-0" onClick={() => selectItem(parentAlbum.id)}>
                  查看专辑
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}

          <ol className="ac-scroll max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {tracks.map((track, index) => {
              const title = trackTitle(track) || `Track ${index + 1}`;
              const isCurrent = activeTrackIndex === index;
              return (
                <li key={`${title}-${index}`}>
                  <div
                    className={[
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200',
                      isCurrent
                        ? 'border border-accent-sky/30 bg-accent-sky/12'
                        : 'border border-transparent hover:bg-white/[0.04]'
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'w-6 shrink-0 text-[0.72rem] font-bold tabular-nums',
                        isCurrent ? 'text-accent-sky' : 'text-paper-faint'
                      ].join(' ')}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <strong className={['min-w-0 flex-1 truncate text-[0.85rem] font-semibold', isCurrent ? 'text-paper' : 'text-paper-dim'].join(' ')}>
                      {title}
                    </strong>
                    <small className={['shrink-0 text-[0.7rem]', isCurrent ? 'font-semibold text-accent-sky' : 'text-paper-faint'].join(' ')}>
                      {isCurrent ? '当前歌曲' : trackArtist(track, albumContextItem?.artist)}
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>

          {activeItem.type === 'album' ? (
            <div className="mt-5 border-t border-white/[0.07] pt-4">
              <strong className="mb-3 block text-[0.78rem] font-bold uppercase tracking-[0.12em] text-paper-faint">
                房间已收录歌曲
              </strong>
              {relatedSongs.length ? (
                <div className="space-y-1.5">
                  {relatedSongs.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => selectItem(song.id)}
                      className="group/song flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-all duration-200 ease-soft hover:border-white/10 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
                    >
                      <AlbumArt item={song} size="thumb" className="h-10 w-10 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[0.85rem] font-semibold text-paper">{song.title}</b>
                        <small className="block truncate text-[0.7rem] text-paper-faint">{song.artist} · 来自这张专辑</small>
                      </span>
                      <ChevronRight
                        size={15}
                        aria-hidden="true"
                        className="shrink-0 text-paper-faint transition-transform duration-200 group-hover/song:translate-x-0.5 group-hover/song:text-accent-sky"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="ac-muted">这张专辑还没有单独收录的歌曲。添加其中一首歌后，它会自动出现在这里。</p>
              )}
            </div>
          ) : null}

          {guide.length > 0 ? (
            <div className="mt-5 border-t border-white/[0.07] pt-4">
              <strong className="mb-2.5 block text-[0.78rem] font-bold uppercase tracking-[0.12em] text-paper-faint">
                初听导览
              </strong>
              <div className="space-y-1.5">
                {guide.slice(0, 6).map((line, index) => (
                  <p key={`${line}-${index}`} className="text-[0.82rem] leading-relaxed text-paper-dim">{line}</p>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* AI 档案 */}
        <section className="ac-card p-5">
          <SectionTitle icon={Bot}>AI 推荐导览</SectionTitle>
          {aiNotes.length ? (
            <div className="space-y-2">
              {aiNotes.map(([title, value], index) => (
                <details
                  key={title}
                  className="group/note overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03] transition-colors hover:border-white/15"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60">
                    <span className="text-[0.7rem] font-bold tabular-nums text-accent-sky/70">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <strong className="flex-1 text-[0.85rem] font-semibold text-paper">{title}</strong>
                    <ChevronRight
                      size={15}
                      aria-hidden="true"
                      className="shrink-0 text-paper-faint transition-transform duration-300 ease-spring group-open/note:rotate-90"
                    />
                  </summary>
                  <p className="px-3.5 pb-3.5 text-[0.83rem] leading-relaxed text-paper-dim">{value}</p>
                </details>
              ))}
            </div>
          ) : (
            <p className="ac-muted">还没有 AI 档案。点击「请求 AI 推荐」生成这张作品的深度导览。</p>
          )}

          {profile.sources?.length > 0 ? (
            <div className="mt-5 border-t border-white/[0.07] pt-4">
              <strong className="mb-2.5 block text-[0.78rem] font-bold uppercase tracking-[0.12em] text-paper-faint">
                联网来源
              </strong>
              <div className="flex flex-wrap gap-2">
                {profile.sources.slice(0, 4).map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="max-w-full truncate rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.72rem] text-paper-dim transition-colors hover:border-accent-sky/35 hover:text-accent-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
                  >
                    {source.title}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* 评论 */}
      <section className="ac-card p-5">
        <SectionTitle icon={MessageCircle}>
          评论
          <span className="ml-2 text-[0.75rem] font-semibold text-paper-faint">{activeComments.length}</span>
        </SectionTitle>

        <div className="mb-3 flex flex-wrap gap-2">
          {prompts.slice(0, 3).map((prompt) => (
            <button key={prompt} type="button" className="ac-pill" onClick={() => setDraft(prompt)}>
              {prompt}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="detail-comment-draft">评论内容</label>
        <textarea
          id="detail-comment-draft"
          className="ac-textarea"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`写下你推荐《${activeItem.title}》的原因`}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="ac-btn ac-btn-primary"
            onClick={submitComment}
            disabled={!draft.trim() || commentStatus === 'sending'}
          >
            <Send size={15} aria-hidden="true" />
            {commentStatus === 'sending' ? '发送中…' : '发布到展柜'}
          </button>
          {commentStatus ? (
            <p className="ac-status" aria-live="polite">
              {commentStatus === 'cloud' ? '评论已同步。' : commentStatus}
            </p>
          ) : null}
        </div>

        {commentAiStatus === 'thinking' ? (
          <div className="mt-3 inline-flex animate-fade-in items-center gap-2 rounded-lg border border-accent-purple/22 bg-accent-purple/10 px-3.5 py-2.5 text-[0.8rem] text-paper-dim">
            <Bot size={15} className="animate-pulse text-accent-purple" aria-hidden="true" />
            AI 正在阅读你的评论，并准备一个可以继续聊下去的问题。
          </div>
        ) : null}
        {commentAiStatus && !['idle', 'thinking', 'done'].includes(commentAiStatus) ? (
          <p className="ac-status ac-status-error mt-3">{commentAiStatus}</p>
        ) : null}

        <div className="mt-5 space-y-3" aria-busy={loading ? 'true' : undefined}>
          {loading && !activeComments.length ? (
            <CommentSkeletons />
          ) : activeComments.length ? (
            activeComments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                author={comment.userId ? memberProfilesById?.[comment.userId] : null}
                canDelete={(comment.userId === session?.user?.id || session?.user?.role === 'admin') && !comment.isAi}
                onDelete={() => deleteComment(comment)}
                onOpenMember={openMember}
              />
            ))
          ) : (
            <p className="ac-empty text-[0.85rem]">还没有评论。成为第一个留下想法的人。</p>
          )}
        </div>
      </section>

      {immersive ? (
        <ImmersiveDetail
          item={activeItem}
          profile={profile}
          comments={activeComments}
          ratingSummary={ratingSummary}
          onClose={() => setImmersive(false)}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------- 评论页 ---------------------------------- */

export function Review({
  selected, comments, draft, setDraft, submitComment, commentStatus, commentAiStatus,
  session, deleteComment, memberProfilesById, openMember, loading
}) {
  if (!selected) {
    return (
      <div className="ac-page items-center justify-center py-20">
        <p className="ac-empty max-w-sm text-center">先在展柜中添加或选择一条音乐。</p>
      </div>
    );
  }

  return (
    <div className="ac-page animate-fade-in">
      <section className="ac-card p-5">
        <p className="ac-eyebrow mb-2">
          <MessageCircle size={13} aria-hidden="true" /> comments
        </p>
        <h2 className="ac-h2 mb-4 break-words">评论 {selected.title}</h2>

        <label className="sr-only" htmlFor="review-comment-draft">评论内容</label>
        <textarea
          id="review-comment-draft"
          className="ac-textarea"
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="写下你推荐它的原因"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="ac-btn ac-btn-primary"
            onClick={submitComment}
            disabled={!draft.trim() || commentStatus === 'sending'}
          >
            <Send size={16} aria-hidden="true" />
            {commentStatus === 'sending' ? '发送中…' : '发布评论'}
          </button>
          {commentStatus ? (
            <p className="ac-status" aria-live="polite">
              {commentStatus === 'cloud' ? '评论已同步。' : commentStatus}
            </p>
          ) : null}
        </div>

        {commentAiStatus === 'thinking' ? (
          <div className="mt-3 inline-flex animate-fade-in items-center gap-2 rounded-lg border border-accent-purple/22 bg-accent-purple/10 px-3.5 py-2.5 text-[0.8rem] text-paper-dim">
            <Bot size={15} className="animate-pulse text-accent-purple" aria-hidden="true" />
            AI 正在阅读你的评论，并准备一个可以继续聊下去的问题。
          </div>
        ) : null}
      </section>

      <div className="space-y-3" aria-busy={loading ? 'true' : undefined}>
        {loading && !comments.length ? (
          <CommentSkeletons />
        ) : comments.length ? (
          comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              author={comment.userId ? memberProfilesById?.[comment.userId] : null}
              canDelete={(comment.userId === session?.user?.id || session?.user?.role === 'admin') && !comment.isAi}
              onDelete={() => deleteComment(comment)}
              onOpenMember={openMember}
            />
          ))
        ) : (
          <p className="ac-empty text-[0.85rem]">还没有评论。</p>
        )}
      </div>
    </div>
  );
}
