import React from 'react';
import { MessageCircle, Music2, Plus, Send, Share2, Sparkles } from 'lucide-react';
import { recoTitle, recoReason, recoEntry } from '../lib/utils.js';
import { EmotionSpectrum, SoulCard, SoulStarMap } from './soulVisuals.jsx';

/* --------------------------------- 局部原子 --------------------------------- */

function Block({ title, kicker, children, className = '' }) {
  return (
    <section className={`ac-card p-5 ${className}`}>
      {(kicker || title) ? (
        <div className="mb-3">
          {kicker ? <span className="ac-eyebrow">{kicker}</span> : null}
          {title ? <strong className="mt-1 block text-[0.95rem] font-bold text-paper">{title}</strong> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function SourceStrip({ sources, label = '联网来源', compact = false }) {
  if (!sources?.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'border-t border-white/[0.07] pt-3'}`}>
      {label ? (
        <strong className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-paper-faint">{label}</strong>
      ) : null}
      {sources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="max-w-[240px] truncate rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.7rem] text-paper-dim transition-colors hover:border-accent-sky/35 hover:text-accent-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
        >
          {source.title}
        </a>
      ))}
    </div>
  );
}

/* --------------------------------- 侧写报告 --------------------------------- */

export function PersonaReport({ report, addPublicTag, openShareCard, userName = '' }) {
  if (!report) {
    return (
      <div className="ac-empty animate-fade-in" id="persona-report">
        <Sparkles size={28} className="text-accent-purple/70" aria-hidden="true" />
        <strong className="text-[0.95rem] font-bold text-paper">还没有生成音乐侧写</strong>
        <p className="ac-body max-w-md">保存资料、勾选几首代表作后，让 AI 分析偏好线索并推荐新的歌手、歌曲和专辑。</p>
      </div>
    );
  }

  const title = report.profileName || report.musicPersonality?.name || '音乐画像';
  const accent = /^#[0-9a-f]{6}$/i.test(report.ui_theme_hint?.primary_color || '')
    ? report.ui_theme_hint.primary_color
    : '';
  const recommendationGroups = [
    ['艺人', 'artist', report.recommendations?.artists],
    ['乐队', 'band', report.recommendations?.bands],
    ['专辑', 'album', report.recommendations?.albums],
    ['歌曲', 'song', report.recommendations?.songs]
  ].filter(([, , values]) => values?.length);
  const identityFields = Array.isArray(report.identitySignals?.fields)
    ? report.identitySignals.fields.filter((item) => item?.label && item?.value)
    : [];
  const dailyVibes = Array.isArray(report.dailyVibes) ? report.dailyVibes.filter((item) => item?.title && item?.text) : [];
  const oracleCards = Array.isArray(report.oracleCards) ? report.oracleCards.filter((item) => item?.title && item?.text) : [];
  const easterEggs = Array.isArray(report.easterEggs) ? report.easterEggs.filter(Boolean) : [];

  const spectrum = Array.isArray(report.emotionSpectrum) ? report.emotionSpectrum.filter((item) => item?.emotion) : [];

  return (
    <article
      id="persona-report"
      className="flex animate-fade-in flex-col gap-4 scroll-mt-24"
      style={accent ? { '--persona-accent': accent } : undefined}
    >
      {/* 标题 */}
      <header className="relative overflow-hidden rounded-xl border border-white/[0.09] bg-gradient-to-br from-accent-purple/12 via-white/[0.03] to-transparent p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
          style={{ background: accent || 'rgba(167,139,250,0.45)' }}
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <p className="ac-eyebrow">
            <Sparkles size={13} className="text-accent-purple" aria-hidden="true" /> music oracle
          </p>
          <div className="flex items-center gap-2">
            {report.ritualCompleted ? (
              <span className="rounded-full border border-accent-gold/30 bg-accent-gold/10 px-2.5 py-1 text-[0.68rem] font-bold text-accent-gold">
                ☾ 仪式版
              </span>
            ) : null}
            {report.soulCard && openShareCard ? (
              <button type="button" className="ac-btn ac-btn-ghost" onClick={openShareCard}>
                <Share2 size={14} aria-hidden="true" /> 分享卡
              </button>
            ) : null}
          </div>
        </div>
        <h3 className="ac-h1 relative mt-2 break-words">{report.archetype?.title || title}</h3>
        {(report.archetype?.summary || report.headline) ? (
          <p className="relative mt-3 max-w-[68ch] text-[0.95rem] font-medium leading-relaxed text-paper-dim">
            {report.archetype?.summary || report.headline}
          </p>
        ) : null}
        {report.summary ? (
          <p className="relative mt-2 max-w-[68ch] text-[0.85rem] leading-relaxed text-paper-faint">{report.summary}</p>
        ) : null}
      </header>

      {/* 灵魂卡 + 星图 */}
      {(report.soulCard || spectrum.length) ? (
        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {report.soulCard ? <SoulCard card={report.soulCard} userName={userName} /> : null}
          <div className="ac-card p-5">
            <div className="ac-section-title mb-3">
              <Sparkles size={16} className="text-accent-purple" aria-hidden="true" />
              <h3 className="text-[0.95rem] font-bold text-paper">灵魂坐标</h3>
            </div>
            <SoulStarMap report={report} />
          </div>
        </section>
      ) : null}

      {spectrum.length ? (
        <Block kicker="EMOTION SPECTRUM" title="你听歌时被点亮的六种情绪">
          <EmotionSpectrum items={spectrum} />
        </Block>
      ) : null}

      {report.the_roast ? (
        <div className="flex items-start gap-3 rounded-lg border border-accent-gold/22 bg-accent-gold/[0.08] p-4">
          <Sparkles size={17} className="mt-0.5 shrink-0 text-accent-gold" aria-hidden="true" />
          <p className="text-[0.88rem] leading-relaxed text-paper-dim">{report.the_roast}</p>
        </div>
      ) : null}

      {report.essay ? (
        <Block kicker="SOUL READING" title="完整灵魂侧写">
          <p className="whitespace-pre-wrap text-[0.88rem] leading-[1.85] text-paper-dim">{report.essay}</p>
        </Block>
      ) : null}

      {report.lifeReading ? (
        <Block kicker={report.lifeReading.vibe || '人格牌面'} title={report.lifeReading.title || '日常人格盲盒'}>
          {report.lifeReading.text ? (
            <p className="mb-4 text-[0.88rem] leading-relaxed text-paper-dim">{report.lifeReading.text}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['朋友局', report.lifeReading.socialStyle],
              ['做事方式', report.lifeReading.workStyle],
              ['亲密雷达', report.lifeReading.loveStyle]
            ].filter(([, value]) => value).map(([label, value]) => (
              <article key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3.5">
                <strong className="mb-1 block text-[0.8rem] font-bold text-accent-purple">{label}</strong>
                <span className="text-[0.8rem] leading-relaxed text-paper-dim">{value}</span>
              </article>
            ))}
          </div>
        </Block>
      ) : null}

      {oracleCards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {oracleCards.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className="ac-card ac-card-hover flex flex-col gap-2 p-4"
            >
              <span className="ac-eyebrow">{item.card || `牌 ${index + 1}`}</span>
              <strong className="text-[0.9rem] font-bold text-paper">{item.title}</strong>
              <p className="text-[0.8rem] leading-relaxed text-paper-dim">{item.text}</p>
            </article>
          ))}
        </div>
      ) : null}

      {(dailyVibes.length > 0 || report.musicAge?.listeningAge) ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.musicAge?.listeningAge ? (
            <article className="ac-card flex flex-col gap-2 border-accent-sky/22 bg-accent-sky/[0.07] p-4">
              <Sparkles size={17} className="text-accent-sky" aria-hidden="true" />
              <strong className="text-[0.9rem] font-bold text-paper">音乐年龄：{report.musicAge.listeningAge}</strong>
              {report.musicAge.realAgeHint ? (
                <small className="text-[0.74rem] text-paper-faint">现实年龄线索：{report.musicAge.realAgeHint}</small>
              ) : null}
              {report.musicAge.reason ? (
                <small className="text-[0.78rem] leading-relaxed text-paper-dim">{report.musicAge.reason}</small>
              ) : null}
            </article>
          ) : null}
          {dailyVibes.map((item) => (
            <article key={item.title} className="ac-card ac-card-hover flex flex-col gap-2 p-4">
              <strong className="text-[0.88rem] font-bold text-paper">{item.title}</strong>
              <p className="text-[0.8rem] leading-relaxed text-paper-dim">{item.text}</p>
            </article>
          ))}
        </div>
      ) : null}

      {report.personalitySketch ? (
        <Block title="一句话侧写">
          <p className="text-[0.9rem] leading-relaxed text-paper-dim">{report.personalitySketch.text}</p>
          {report.personalitySketch.softGuess ? (
            <small className="mt-2 block text-[0.75rem] text-paper-faint">{report.personalitySketch.softGuess}</small>
          ) : null}
        </Block>
      ) : null}

      {report.preferenceReading?.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {report.preferenceReading.map((item) => (
            <div key={item.signal} className="ac-card p-4">
              <strong className="mb-2 block text-[0.88rem] font-bold text-paper">{item.signal}</strong>
              {item.evidence?.length > 0 ? (
                <div className="ac-tag-row mb-2">
                  {item.evidence.slice(0, 5).map((value) => <span key={value} className="ac-tag">{value}</span>)}
                </div>
              ) : null}
              <p className="text-[0.82rem] leading-relaxed text-paper-dim">{item.reading}</p>
            </div>
          ))}
        </div>
      ) : null}

      {report.tasteDNA?.length > 0 ? (
        <Block title="口味 DNA">
          <div className="grid gap-4 sm:grid-cols-2">
            {report.tasteDNA.map((item) => (
              <div key={item.axis} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <strong className="text-[0.82rem] font-semibold text-paper">{item.axis}</strong>
                  <small className="text-[0.75rem] font-bold tabular-nums text-accent-purple">{item.value}</small>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <i
                    className="block h-full rounded-full bg-gradient-to-r from-accent-sky to-accent-purple transition-[width] duration-700 ease-soft"
                    style={{ width: `${Math.max(0, Math.min(100, Number(item.value) || 0))}%` }}
                  />
                </div>
                <p className="text-[0.76rem] text-paper-dim">{item.label}</p>
                {item.evidence?.length > 0 ? (
                  <em className="block text-[0.7rem] not-italic text-paper-faint">{item.evidence.join(' / ')}</em>
                ) : null}
              </div>
            ))}
          </div>
        </Block>
      ) : null}

      {report.evidenceCards?.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.evidenceCards.map((item) => (
            <div key={item.claim} className="ac-card p-4">
              <strong className="mb-1.5 block text-[0.85rem] font-bold text-paper">{item.claim}</strong>
              <p className="text-[0.78rem] leading-relaxed text-paper-dim">{(item.basedOn || []).join(' / ')}</p>
              <small className="mt-2 block text-[0.7rem] font-semibold text-accent-gold">
                {Math.round((item.confidence || 0.6) * 100)}% 玄学命中率
              </small>
            </div>
          ))}
        </div>
      ) : null}

      {recommendationGroups.length > 0 ? (
        <section className="ac-card p-5">
          <div className="ac-section-title mb-4">
            <Music2 size={17} className="text-accent-sky" aria-hidden="true" />
            <h3 className="text-[0.95rem] font-bold text-paper">给你的下一批歌</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recommendationGroups.map(([groupTitle, kind, values]) => (
              <div key={groupTitle} className="space-y-2">
                <strong className="block text-[0.75rem] font-bold uppercase tracking-[0.12em] text-paper-faint">
                  {groupTitle}
                </strong>
                {(values || []).map((value, index) => (
                  <article
                    key={`${groupTitle}-${recoTitle(value, kind)}-${index}`}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    <b className="block text-[0.82rem] font-bold text-paper">{recoTitle(value, kind)}</b>
                    {recoReason(value) ? (
                      <p className="mt-1 text-[0.76rem] leading-relaxed text-paper-dim">{recoReason(value)}</p>
                    ) : null}
                    {recoEntry(value) ? (
                      <small className="mt-1 block text-[0.7rem] text-paper-faint">{recoEntry(value)}</small>
                    ) : null}
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(report.recommendations?.hidden_gem_music || report.recommendations?.cross_domain) ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.recommendations?.hidden_gem_music ? (
            <div className="ac-card p-4">
              <strong className="mb-1.5 block text-[0.85rem] font-bold text-accent-gold">隐藏宝藏</strong>
              <p className="text-[0.8rem] leading-relaxed text-paper-dim">
                {report.recommendations.hidden_gem_music.title ? (
                  <b className="text-paper">{report.recommendations.hidden_gem_music.title}：</b>
                ) : null}
                {report.recommendations.hidden_gem_music.reason}
              </p>
            </div>
          ) : null}
          {report.recommendations?.cross_domain?.book_or_movie ? (
            <div className="ac-card p-4">
              <strong className="mb-1.5 block text-[0.85rem] font-bold text-accent-green">跨界补刀</strong>
              <p className="text-[0.8rem] leading-relaxed text-paper-dim">{report.recommendations.cross_domain.book_or_movie}</p>
            </div>
          ) : null}
          {report.recommendations?.cross_domain?.night_routine ? (
            <div className="ac-card p-4">
              <strong className="mb-1.5 block text-[0.85rem] font-bold text-accent-purple">深夜仪式</strong>
              <p className="text-[0.8rem] leading-relaxed text-paper-dim">{report.recommendations.cross_domain.night_routine}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {report.playlistRoutes?.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {report.playlistRoutes.map((route) => (
            <div key={route.title} className="ac-card p-4">
              <strong className="mb-1.5 block text-[0.88rem] font-bold text-paper">{route.title}</strong>
              <p className="mb-2.5 text-[0.8rem] leading-relaxed text-paper-dim">{route.description}</p>
              <div className="ac-tag-row">
                {(route.items || []).slice(0, 6).map((item) => <span key={item} className="ac-tag">{item}</span>)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {easterEggs.length > 0 ? (
        <div className="ac-tag-row">
          {easterEggs.slice(0, 5).map((item) => (
            <span key={item} className="rounded-full border border-accent-pink/25 bg-accent-pink/10 px-3 py-1.5 text-[0.74rem] font-medium text-accent-pink">
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {report.ui_theme_hint ? (
        <div className="ac-card flex flex-wrap items-center gap-3 p-4">
          <span
            className="h-6 w-6 shrink-0 rounded-full ring-1 ring-white/20"
            style={{ background: report.ui_theme_hint.primary_color }}
            aria-hidden="true"
          />
          <strong className="text-[0.85rem] font-bold text-paper">{report.ui_theme_hint.style}</strong>
          <p className="min-w-[180px] flex-1 text-[0.78rem] text-paper-dim">{report.ui_theme_hint.bg_animation}</p>
        </div>
      ) : null}

      {identityFields.length > 0 ? (
        <details className="group/id ac-card overflow-hidden">
          <summary className="cursor-pointer list-none px-5 py-3.5 text-[0.85rem] font-semibold text-paper-dim transition-colors hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60">
            本次抽到的资料牌
          </summary>
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
            {identityFields.map((item) => (
              <article key={`${item.label}-${item.value}`} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <span className="ac-eyebrow">{item.label}</span>
                <b className="mt-1 block text-[0.85rem] font-bold text-paper">{item.value}</b>
                {item.reading ? <p className="mt-1 text-[0.76rem] leading-relaxed text-paper-dim">{item.reading}</p> : null}
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {(report.tags || []).length ? (
        <div className="ac-tag-row">
          {(report.tags || []).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addPublicTag(tag)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[0.75rem] font-medium text-paper-dim transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-accent-sky/35 hover:bg-accent-sky/12 hover:text-accent-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
            >
              {tag}
              <Plus size={12} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      <SourceStrip sources={report.sources} />

      {report.riskNotice ? (
        <p className="text-[0.72rem] leading-relaxed text-paper-faint">{report.riskNotice}</p>
      ) : null}
    </article>
  );
}

/* --------------------------------- 画像对话 --------------------------------- */

export function PersonaChatBox({ report, personaQuestion, setPersonaQuestion, askPersona, personaChat, personaChatStatus }) {
  const starters = report?.conversationStarters || [
    '我下一张应该补什么专辑？',
    '我的音乐年龄为什么是这样？',
    '根据我的资料推荐 5 首歌'
  ];
  const thinking = personaChatStatus === 'thinking';

  return (
    <article className="ac-card p-5">
      <div className="ac-section-title mb-4">
        <MessageCircle size={17} className="text-accent-sky" aria-hidden="true" />
        <h3 className="text-[0.95rem] font-bold text-paper">继续聊这个画像</h3>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {starters.slice(0, 4).map((question) => (
          <button key={question} type="button" className="ac-pill" onClick={() => askPersona(question)}>
            {question}
          </button>
        ))}
      </div>

      {personaChat.length ? (
        <div className="ac-scroll mb-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {personaChat.map((message, index) => {
            const isUser = message.role === 'user';
            return (
              <div
                key={`${message.role}-${index}`}
                className={[
                  'max-w-[86%] animate-slide-up rounded-lg border p-3.5',
                  isUser
                    ? 'ml-auto border-accent-sky/25 bg-accent-sky/[0.1]'
                    : 'mr-auto border-white/[0.08] bg-white/[0.035]'
                ].join(' ')}
              >
                <strong className={['mb-1 block text-[0.7rem] font-bold uppercase tracking-[0.1em]', isUser ? 'text-accent-sky' : 'text-accent-purple'].join(' ')}>
                  {isUser ? '你' : 'Album Circle AI'}
                </strong>
                <p className="whitespace-pre-wrap text-[0.84rem] leading-relaxed text-paper-dim">{message.text}</p>
                {message.sources?.length > 0 ? (
                  <div className="mt-2">
                    <SourceStrip sources={message.sources.slice(0, 4)} label="" compact />
                  </div>
                ) : null}
              </div>
            );
          })}
          {thinking ? (
            <div className="mr-auto flex max-w-[86%] items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] px-3.5 py-3">
              <span className="flex gap-1" aria-hidden="true">
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-purple" />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-purple [animation-delay:150ms]" />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-purple [animation-delay:300ms]" />
              </span>
              <span className="text-[0.78rem] text-paper-faint">正在思考…</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="persona-chat-input">向画像提问</label>
        <input
          id="persona-chat-input"
          className="ac-input min-w-[200px] flex-1"
          value={personaQuestion}
          onChange={(event) => setPersonaQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !thinking) {
              event.preventDefault();
              askPersona();
            }
          }}
          placeholder="继续问：为什么我会喜欢这些歌？下一批听什么？"
        />
        <button type="button" className="ac-btn ac-btn-primary shrink-0" onClick={() => askPersona()} disabled={thinking}>
          <Send size={15} aria-hidden="true" />
          {thinking ? '回复中' : '发送'}
        </button>
      </div>

      {String(personaChatStatus).startsWith('error-') ? (
        <p className="ac-status ac-status-error mt-3">{String(personaChatStatus).replace('error-', '')}</p>
      ) : null}
    </article>
  );
}
