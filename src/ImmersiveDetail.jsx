import { useCallback, useEffect, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';

/*
 * ImmersiveDetail —— 沉浸式专辑阅读视图
 * 独立文件，遵循项目「实验性 UI 隔离」约定（与 corridor 同模式）。
 * 全屏覆盖层 + 封面视差 + AI 导览分段渐入；Esc 关闭、焦点陷阱、reduce-motion 降级静态。
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
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    };
  }, [onClose]);

  // 分段渐入（滚动驱动）
  useEffect(() => {
    const root = overlayRef.current;
    if (!root) return undefined;
    const sections = Array.from(root.querySelectorAll('.immersive-section'));
    const reduce = document.documentElement.classList.contains('reduce-motion')
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
    <div className="immersive-overlay" role="dialog" aria-modal="true" aria-label={`${item.title} 沉浸阅读`} ref={overlayRef}>
      <div className="immersive-backdrop" aria-hidden="true" />
      <div className="immersive-progress" aria-hidden="true" />
      <button type="button" className="immersive-close" ref={closeRef} onClick={onClose} aria-label="关闭沉浸阅读"><X size={20} /></button>
      <div className="immersive-scroll" onScroll={handleImmersiveScroll}>
        <header className="immersive-hero">
          <div className="immersive-cover" style={item.cover ? { backgroundImage: `url(${item.cover})` } : undefined} aria-hidden="true" />
          <div className="immersive-hero-copy">
            <p className="eyebrow">{item.type === 'album' ? 'ALBUM' : 'SONG'}</p>
            <h1>{item.title}</h1>
            <p className="immersive-artist">{item.artist}</p>
            <p className="immersive-score">好友均分 {score}</p>
            <span className="immersive-ai-tag"><Sparkles size={13} /> AI 生成音乐导览</span>
          </div>
        </header>

        <section className="immersive-section">
          <h2>导览概述</h2>
          <p>{profile.overview || item.background || item.context}</p>
        </section>

        {dossier.map(([title, value]) => (
          <section className="immersive-section" key={title}>
            <h2>{title}</h2>
            <p>{value}</p>
          </section>
        ))}

        {comments.length > 0 && (
          <section className="immersive-section">
            <h2>房间评论（{comments.length}）</h2>
            <div className="immersive-comments">
              {comments.map((comment) => (
                <article key={comment.id} className="immersive-comment">
                  <strong>{comment.author || '朋友'}</strong>
                  <p>{comment.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {profile.sources?.length > 0 && (
          <section className="immersive-section">
            <h2>联网来源</h2>
            <ul className="immersive-sources">
              {profile.sources.slice(0, 6).map((source) => (
                <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>
              ))}
            </ul>
          </section>
        )}

        <footer className="immersive-footer">
          <p className="immersive-footer-note">导览由 DeepSeek 基于房间资料生成 · 向下滚动逐段展开</p>
          <button type="button" onClick={onClose}>返回展柜</button>
        </footer>
      </div>
    </div>
  );
}
