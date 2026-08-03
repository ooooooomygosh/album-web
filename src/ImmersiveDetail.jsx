import { useCallback, useEffect, useRef } from 'react';
import { Sparkles, X, ArrowDown, ExternalLink } from 'lucide-react';

/*
 * ImmersiveDetail —— 沉浸式专辑阅读视图（Tailwind 版）
 * 全屏覆盖层 + 封面视差 + AI 导览分段渐入；Esc 关闭、焦点陷阱、reduce-motion 降级静态。
 * 分段渐入依赖 index.css 中的 .ac-reveal / .is-visible 原语（IntersectionObserver 驱动）。
 */
export default function ImmersiveDetail({ item, profile = {}, comments = [], ratingSummary, onClose }) {
  const overlayRef = useRef(null);
  const closeRef = useRef(null);

  // Esc 关闭 + 焦点陷阱 + 打开时锁定背景滚动、关闭时归还焦点
  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !overlayRef.current) return;
      const focusable = [...overlayRef.current.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('immersive-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('immersive-open');
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    };
  }, [onClose]);

  // 分段渐入（滚动驱动）
  useEffect(() => {
    const root = overlayRef.current;
    if (!root) return undefined;
    const sections = Array.from(root.querySelectorAll('.ac-reveal'));
    const reduce = document.documentElement.classList.contains('reduce-motion')
      || document.querySelector('.reduce-motion') !== null
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('is-visible'));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { root: null, threshold: 0, rootMargin: '0px 0px -8% 0px' });
    sections.forEach((section) => observer.observe(section));
    // 安全兜底：1.4s 后强制显示任何仍未出现的内容，杜绝阈值/视口差异导致永久不可见
    const safety = window.setTimeout(() => {
      sections.forEach((section) => section.classList.add('is-visible'));
    }, 1400);
    return () => {
      observer.disconnect();
      window.clearTimeout(safety);
    };
  }, []);

  // 阅读进度：随滚动写入 --immersive-progress (0~1)
  const handleImmersiveScroll = useCallback((event) => {
    const el = event.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
    if (overlayRef.current) {
      overlayRef.current.style.setProperty('--immersive-progress', progress.toFixed(4));
    }
  }, []);

  const score = ratingSummary?.count ? ratingSummary.average.toFixed(1) : '待评分';
  const dossier = [
    ['专辑位置', profile.albumContext],
    ['创作语境', profile.creativeBackground],
    ['旋律动机', profile.melodyMotif],
    ['歌词视角', profile.lyricPerspective],
    ['编曲层次', profile.arrangement],
    ['发行状态', profile.releaseState]
  ].filter(([, value]) => value);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} 沉浸阅读`}
      className="fixed inset-0 z-[120] flex flex-col bg-ink-950 animate-fade-in [--immersive-progress:0]"
    >
      {/* 背景：模糊封面 + 深色渐变 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {item.cover && (
          <div
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-3xl saturate-150"
            style={{ backgroundImage: `url(${item.cover})` }}
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(8,10,20,0.35),rgba(6,7,14,0.92)_65%,rgba(4,5,10,0.98))]" />
      </div>

      {/* 阅读进度条 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] bg-white/[0.06]" aria-hidden="true">
        <div
          className="h-full origin-left bg-gradient-to-r from-accent-sky via-accent-purple to-accent-gold transition-[width] duration-150 ease-out"
          style={{ width: 'calc(var(--immersive-progress, 0) * 100%)' }}
        />
      </div>

      <button
        type="button"
        ref={closeRef}
        onClick={onClose}
        aria-label="关闭沉浸阅读"
        className="ac-glass absolute right-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-full text-white/80 transition hover:scale-105 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/70 sm:right-6 sm:top-6"
      >
        <X size={20} />
      </button>

      <div
        onScroll={handleImmersiveScroll}
        className="ac-scroll relative z-10 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth px-5 pb-24 pt-0 sm:px-8"
      >
        <div className="mx-auto w-full max-w-[880px]">
          {/* Hero */}
          <header className="flex min-h-[86vh] flex-col items-center justify-center gap-7 py-16 text-center sm:min-h-[92vh]">
            <div
              className="relative aspect-square w-[min(64vw,320px)] shrink-0 overflow-hidden rounded-[28px] bg-white/[0.04] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10 sm:w-[min(48vw,360px)]"
              aria-hidden="true"
            >
              {item.cover ? (
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${item.cover})` }} />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-white/10 to-white/[0.02] text-4xl font-semibold text-white/30">
                  {item.title?.slice(0, 1) || '♪'}
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2.5">
              <p className="ac-eyebrow">{item.type === 'album' ? 'ALBUM' : 'SONG'}</p>
              <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
                {item.title}
              </h1>
              <p className="text-base text-white/60 sm:text-lg">{item.artist}</p>
              <p className="text-sm text-white/45">好友均分 {score}</p>
              <span className="ac-pill mt-1 gap-1.5 text-[11px] text-accent-purple">
                <Sparkles size={13} /> AI 生成音乐导览
              </span>
            </div>
            <div className="mt-4 flex flex-col items-center gap-1.5 text-white/30" aria-hidden="true">
              <span className="text-[11px] uppercase tracking-[0.28em]">Scroll</span>
              <ArrowDown size={16} className="animate-bounce" />
            </div>
          </header>

          {/* 导览概述 */}
          <Section title="导览概述">
            <p className="ac-body text-[15px] leading-[1.9] text-white/70 sm:text-base">
              {profile.overview || item.background || item.context || '暂无导览内容。'}

            </p>
          </Section>

          {dossier.map(([title, value]) => (
            <Section title={title} key={title}>
              <p className="ac-body text-[15px] leading-[1.9] text-white/70 sm:text-base">{value}</p>
            </Section>
          ))}

          {comments.length > 0 && (
            <Section title={`房间评论（${comments.length}）`}>
              <div className="grid gap-3 sm:grid-cols-2">
                {comments.map((comment) => (
                  <article
                    key={comment.id}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 backdrop-blur-sm"
                  >
                    <strong className="block text-[13px] font-medium text-white/85">{comment.author || '朋友'}</strong>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">{comment.text}</p>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {profile.sources?.length > 0 && (
            <Section title="联网来源">
              <ul className="flex flex-col gap-2">
                {profile.sources.slice(0, 6).map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex items-start gap-2 text-sm text-accent-sky/85 underline-offset-4 transition hover:text-accent-sky hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <ExternalLink size={14} className="mt-0.5 shrink-0 opacity-60 transition group-hover:opacity-100" />
                      <span className="line-clamp-2">{source.title || source.url}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <footer className="ac-reveal flex flex-col items-center gap-4 border-t border-white/[0.07] py-14 text-center">
            <p className="text-xs text-white/35">导览由 DeepSeek 基于房间资料生成 · 向下滚动逐段展开</p>
            <button type="button" onClick={onClose} className="ac-btn ac-btn-primary">
              返回展柜
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="ac-reveal border-t border-white/[0.06] py-11 sm:py-14">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">{title}</h2>
      {children}
    </section>
  );
}
