import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Copy, Download, Share2, X } from 'lucide-react';
import { toast } from 'sonner';

/* ============================================================
   灵魂卡分享
   在 canvas 上离屏画一张 1080×1500 的卡，
   支持：保存图片 / 系统分享（navigator.share）/ 复制链接。
   零依赖，不引 html2canvas。
   ============================================================ */

const W = 1080;
const H = 1500;
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif';

function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '');
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return { r: 143, g: 216, b: 255 };
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** 按宽度断行，返回结束时的 y。 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
  const chars = [...String(text || '')];
  let line = '';
  let cursorY = y;
  let lines = 0;
  for (let index = 0; index < chars.length; index += 1) {
    const next = line + chars[index];
    if (ctx.measureText(next).width > maxWidth && line) {
      lines += 1;
      if (lines >= maxLines) {
        ctx.fillText(`${line.slice(0, -1)}…`, x, cursorY);
        return cursorY + lineHeight;
      }
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
      line = chars[index];
    } else {
      line = next;
    }
  }
  if (line) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

function drawCard(canvas, { report, userName, shareUrl }) {
  const ctx = canvas.getContext('2d');
  const card = report?.soulCard || {};
  const palette = Array.isArray(card.palette) && card.palette.length === 3
    ? card.palette
    : ['#8fd8ff', '#c08bff', '#ff7da8'];
  const spectrum = (Array.isArray(report?.emotionSpectrum) ? report.emotionSpectrum : []).slice(0, 4);

  // 背景
  ctx.fillStyle = '#06070c';
  ctx.fillRect(0, 0, W, H);

  const glowTop = ctx.createRadialGradient(W * 0.24, H * 0.06, 0, W * 0.24, H * 0.06, W * 0.92);
  glowTop.addColorStop(0, rgba(palette[0], 0.34));
  glowTop.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, H);

  const glowBottom = ctx.createRadialGradient(W * 0.86, H * 0.95, 0, W * 0.86, H * 0.95, W * 0.85);
  glowBottom.addColorStop(0, rgba(palette[2], 0.28));
  glowBottom.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, W, H);

  const glowMid = ctx.createRadialGradient(W * 0.1, H * 0.58, 0, W * 0.1, H * 0.58, W * 0.7);
  glowMid.addColorStop(0, rgba(palette[1], 0.2));
  glowMid.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowMid;
  ctx.fillRect(0, 0, W, H);

  // 星尘
  for (let index = 0; index < 130; index += 1) {
    const x = (Math.sin(index * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(index * 78.233) * 12345.6789) % 1;
    const px = Math.abs(x) * W;
    const py = Math.abs(y) * H;
    const radius = (Math.abs(Math.sin(index * 3.1)) * 1.9) + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.abs(Math.cos(index)) * 0.4})`;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 卡面
  const pad = 72;
  const cardX = pad;
  const cardY = pad;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.11)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();

  const inner = cardX + 64;
  const innerW = cardW - 128;
  let y = cardY + 96;

  // eyebrow
  ctx.fillStyle = rgba(palette[0], 0.9);
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText('SOUL CARD', inner, y);
  y += 62;

  // 符号徽章
  const badge = 132;
  const badgeX = cardX + cardW - 64 - badge;
  const badgeY = cardY + 64;
  roundRect(ctx, badgeX, badgeY, badge, badge, 34);
  const badgeFill = ctx.createLinearGradient(badgeX, badgeY, badgeX + badge, badgeY + badge);
  badgeFill.addColorStop(0, rgba(palette[0], 0.28));
  badgeFill.addColorStop(1, rgba(palette[1], 0.18));
  ctx.fillStyle = badgeFill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = palette[0];
  ctx.font = `400 66px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(card.glyph || '☾', badgeX + badge / 2, badgeY + badge / 2 + 24);
  ctx.textAlign = 'left';

  // 标题
  ctx.fillStyle = '#f8fbff';
  ctx.font = `900 76px ${FONT}`;
  y = wrapText(ctx, card.title || '音乐灵魂', inner, y, innerW - 170, 92, 2) + 10;

  // 副标题
  if (card.subtitle) {
    ctx.fillStyle = 'rgba(248,251,255,0.68)';
    ctx.font = `500 32px ${FONT}`;
    y = wrapText(ctx, card.subtitle, inner, y, innerW, 48, 2) + 26;
  }

  // 金句
  if (card.oneLiner) {
    const quoteTop = y;
    ctx.fillStyle = '#f8fbff';
    ctx.font = `600 38px ${FONT}`;
    const quoteEnd = wrapText(ctx, card.oneLiner, inner + 32, y + 34, innerW - 32, 58, 4);
    ctx.fillStyle = palette[1];
    ctx.fillRect(inner, quoteTop, 5, quoteEnd - quoteTop - 6);
    y = quoteEnd + 34;
  }

  // 情绪光谱
  if (spectrum.length) {
    ctx.fillStyle = 'rgba(248,251,255,0.4)';
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('EMOTION  SPECTRUM', inner, y);
    y += 44;

    spectrum.forEach((item) => {
      ctx.fillStyle = '#f8fbff';
      ctx.font = `600 30px ${FONT}`;
      ctx.fillText(item.emotion, inner, y);
      ctx.fillStyle = item.color || palette[0];
      ctx.font = `700 28px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(String(item.value), inner + innerW, y);
      ctx.textAlign = 'left';
      y += 20;

      roundRect(ctx, inner, y, innerW, 12, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      const width = Math.max(24, (Math.min(100, item.value) / 100) * innerW);
      roundRect(ctx, inner, y, width, 12, 6);
      const barFill = ctx.createLinearGradient(inner, y, inner + width, y);
      barFill.addColorStop(0, rgba(item.color || palette[0], 0.55));
      barFill.addColorStop(1, item.color || palette[0]);
      ctx.fillStyle = barFill;
      ctx.fill();
      y += 46;
    });
    y += 8;
  }

  // 属性行
  const facts = [
    ['本命元素', card.element],
    ['星座式描述', card.starSign],
    ['稀有度', card.rarity]
  ].filter(([, value]) => value);

  if (facts.length) {
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(inner, y);
    ctx.lineTo(inner + innerW, y);
    ctx.stroke();
    y += 46;

    const colW = innerW / facts.length;
    facts.forEach(([label, value], index) => {
      const x = inner + colW * index;
      ctx.fillStyle = 'rgba(248,251,255,0.4)';
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText(label, x, y);
      ctx.fillStyle = 'rgba(248,251,255,0.85)';
      ctx.font = `600 28px ${FONT}`;
      wrapText(ctx, value, x, y + 40, colW - 24, 36, 2);
    });
    y += 100;
  }

  // 页脚
  const footerY = cardY + cardH - 74;
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(inner, footerY - 56);
  ctx.lineTo(inner + innerW, footerY - 56);
  ctx.stroke();

  palette.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(inner + 12 + index * 34, footerY - 12, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(248,251,255,0.55)';
  ctx.font = `600 26px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${userName ? `${userName} · ` : ''}Album Circle`, inner + innerW, footerY - 22);
  if (shareUrl) {
    ctx.fillStyle = 'rgba(248,251,255,0.32)';
    ctx.font = `500 21px ${FONT}`;
    ctx.fillText(shareUrl.replace(/^https?:\/\//, ''), inner + innerW, footerY + 12);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

/* --------------------------------- 分享弹层 --------------------------------- */

export function PersonaShareCard({ open, onClose, report, userName = '', shareUrl = '' }) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const safeShareUrl = typeof shareUrl === 'string' && /^https?:\/\//i.test(shareUrl) && !/room=undefined/i.test(shareUrl)
    ? shareUrl
    : '';

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !report?.soulCard) {
      setDataUrl('');
      return;
    }
    canvas.width = W;
    canvas.height = H;
    try {
      drawCard(canvas, { report, userName, shareUrl: safeShareUrl });
      setDataUrl(canvas.toDataURL('image/png'));
    } catch (error) {
      if (typeof window !== 'undefined') console.error('[PersonaShareCard] draw failed', error);
      setDataUrl('');
    }
  }, [report, userName, safeShareUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(render);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, render, onClose]);

  if (!open) return null;

  const fileName = `album-circle-soul-${(report?.soulCard?.title || 'card').replace(/[^\w\u4e00-\u9fa5-]/g, '')}.png`;

  const download = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
    toast.success('灵魂卡已保存');
  };

  const nativeShare = async () => {
    const text = report?.soulCard?.oneLiner || report?.headline || '我的音乐灵魂侧写';
    const title = report?.soulCard?.title || '音乐灵魂侧写';
    setBusy(true);
    try {
      const canvas = canvasRef.current;
      const blob = canvas ? await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')) : null;
      const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
      } else if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl || undefined });
      } else {
        download();
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('分享没成功，可以先保存图片');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!safeShareUrl) return;
    try {
      await navigator.clipboard.writeText(safeShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败，请手动选中链接');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/78 p-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="分享灵魂卡"
      onClick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <div className="ac-card flex max-h-[92dvh] w-full max-w-[420px] flex-col gap-4 overflow-y-auto p-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <span className="ac-eyebrow">share</span>
            <strong className="mt-1 block text-[0.95rem] font-bold text-paper">带走这张灵魂卡</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-paper-dim transition-colors hover:border-white/25 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
            aria-label="关闭"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="音乐灵魂卡预览"
            className="w-full rounded-lg border border-white/10 shadow-soft"
          />
        ) : (
          <div className="ac-empty py-16 text-[0.82rem]">正在绘制卡面…</div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" className="ac-btn ac-btn-primary justify-center" onClick={nativeShare} disabled={busy}>
            <Share2 size={15} aria-hidden="true" /> {busy ? '准备中' : '分享'}
          </button>
          <button type="button" className="ac-btn justify-center" onClick={download} disabled={!dataUrl}>
            <Download size={15} aria-hidden="true" /> 保存图片
          </button>
        </div>

        {safeShareUrl ? (
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-left text-[0.76rem] text-paper-dim transition-colors hover:border-white/16 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
          >
            {copied ? <Check size={14} className="shrink-0 text-accent-green" aria-hidden="true" /> : <Copy size={14} className="shrink-0" aria-hidden="true" />}
            <span className="min-w-0 flex-1 truncate">{safeShareUrl}</span>
            <span className="shrink-0 text-[0.7rem] text-paper-faint">{copied ? '已复制' : '复制'}</span>
          </button>
        ) : null}

        <p className="text-[0.7rem] leading-relaxed text-paper-faint">
          卡面只包含你的侧写结果，不含账号、邮箱或房间密码。
        </p>
      </div>
    </div>
  );
}
