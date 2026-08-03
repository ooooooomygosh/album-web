import React from 'react';
import { useMemo } from 'react';

/* ============================================================
   灵魂仪式的视觉零件
   —— 星尘 / 星图 / 灵魂卡 / 情绪光谱 ——
   全部零依赖：SVG + CSS 变量，动画写在 ritual.css 里。
   ============================================================ */

/** 用字符串生成稳定伪随机，保证同一个人每次看到的星空一样。 */
function seededRandom(seed) {
  let value = 0;
  const text = String(seed || 'album-circle');
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) % 2147483647;
  }
  return () => {
    value = (value * 1103515245 + 12345) % 2147483647;
    return value / 2147483647;
  };
}

/* --------------------------------- 星尘背景 --------------------------------- */

export function RitualStarfield({ count = 64, seed = 'soul' }) {
  const stars = useMemo(() => {
    const random = seededRandom(seed);
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      left: `${(random() * 100).toFixed(2)}%`,
      top: `${(random() * 100).toFixed(2)}%`,
      size: `${(random() * 2 + 0.8).toFixed(2)}px`,
      dur: `${(random() * 4 + 2.4).toFixed(2)}s`,
      delay: `${(random() * 5).toFixed(2)}s`,
      peak: (random() * 0.55 + 0.35).toFixed(2)
    }));
  }, [count, seed]);

  return (
    <div className="ritual-starfield" aria-hidden="true">
      {stars.map((star) => (
        <i
          key={star.id}
          className="ritual-star"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            '--dur': star.dur,
            '--delay': star.delay,
            '--peak': star.peak
          }}
        />
      ))}
    </div>
  );
}

/* --------------------------------- 召唤法阵 --------------------------------- */

const SIGIL_RUNES = ['☾', '✧', '⟡', '❍', '✦', '☍', '❈', '◈', '✶', '⌖'];

export function RitualSigil({ colors = ['#6fc7ff', '#bf5af2'], children }) {
  return (
    <div className="ritual-sigil" style={{ '--orb-a': colors[0], '--orb-b': colors[1] }} aria-hidden="true">
      <span className="ritual-sigil-ring ritual-sigil-ring--outer" />
      <span className="ritual-sigil-ring ritual-sigil-ring--mid" />
      <span className="ritual-sigil-ring ritual-sigil-ring--inner" />
      {SIGIL_RUNES.map((rune, index) => (
        <span
          key={rune}
          className="ritual-rune"
          style={{ '--angle': `${index * (360 / SIGIL_RUNES.length)}deg`, '--delay': `${index * 0.28}s` }}
        >
          {rune}
        </span>
      ))}
      <span className="ritual-orb">
        <span className="ritual-pulse" />
        <span className="ritual-pulse" style={{ '--delay': '1.1s' }} />
        <span className="ritual-pulse" style={{ '--delay': '2.2s' }} />
      </span>
      {children ? <span className="pointer-events-none absolute inset-0 grid place-items-center">{children}</span> : null}
    </div>
  );
}

/* --------------------------------- 灵魂星图 --------------------------------- */

/** 把口味 DNA / 情绪光谱折成极坐标星座。 */
function starMapPoints(axes, size) {
  const center = size / 2;
  const inner = size * 0.11;
  const span = size * 0.32;
  return axes.map((axis, index) => {
    const angle = (-90 + index * (360 / axes.length)) * (Math.PI / 180);
    const value = Math.max(6, Math.min(100, Number(axis.value) || 50));
    const radius = inner + (value / 100) * span;
    return {
      ...axis,
      value,
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      labelX: center + Math.cos(angle) * (size * 0.455),
      labelY: center + Math.sin(angle) * (size * 0.455),
      anchor: Math.cos(angle) > 0.25 ? 'start' : Math.cos(angle) < -0.25 ? 'end' : 'middle'
    };
  });
}

export function SoulStarMap({ report, size = 340, showLabels = true }) {
  const axes = useMemo(() => {
    const dna = Array.isArray(report?.tasteDNA) ? report.tasteDNA : [];
    const rows = dna
      .filter((item) => item?.axis)
      .slice(0, 6)
      .map((item) => ({ name: item.axis, value: item.value, hint: item.label }));
    if (rows.length >= 3) return rows;
    const spectrum = Array.isArray(report?.emotionSpectrum) ? report.emotionSpectrum : [];
    return spectrum.slice(0, 6).map((item) => ({ name: item.emotion, value: item.value, hint: item.moment }));
  }, [report]);

  if (axes.length < 3) return null;

  const points = starMapPoints(axes, size);
  const center = size / 2;
  const accent = report?.soulCard?.palette?.[0] || '#8fd8ff';
  const accentB = report?.soulCard?.palette?.[1] || '#c08bff';

  const segments = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return {
      key: `${point.name}-${index}`,
      d: `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} L ${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
      len: Math.hypot(next.x - point.x, next.y - point.y).toFixed(2),
      delay: `${index * 0.16}s`
    };
  });

  return (
    <figure className="relative mx-auto w-full max-w-[380px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full" role="img" aria-label="灵魂坐标星图">
        <defs>
          <radialGradient id="starmap-core" cx="50%" cy="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.42" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="starmap-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accent} />
            <stop offset="100%" stopColor={accentB} />
          </linearGradient>
        </defs>

        {/* 底盘：同心圆 + 辐条 */}
        {[0.16, 0.27, 0.38, 0.45].map((ratio) => (
          <circle
            key={ratio}
            cx={center}
            cy={center}
            r={size * ratio}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="0.7"
            strokeDasharray={ratio === 0.45 ? '3 6' : undefined}
          />
        ))}
        {points.map((point) => (
          <line
            key={`spoke-${point.name}`}
            x1={center}
            y1={center}
            x2={center + (point.x - center) * 2.35}
            y2={center + (point.y - center) * 2.35}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="0.7"
          />
        ))}
        <circle cx={center} cy={center} r={size * 0.3} fill="url(#starmap-core)" />

        {/* 星座连线 */}
        {segments.map((segment) => (
          <path
            key={segment.key}
            className="soul-starmap-line"
            d={segment.d}
            fill="none"
            stroke="url(#starmap-line)"
            strokeWidth="1.4"
            strokeLinecap="round"
            style={{ '--len': segment.len, '--delay': segment.delay }}
          />
        ))}

        {/* 星点 */}
        {points.map((point, index) => (
          <g key={`node-${point.name}`}>
            <circle
              className="soul-starmap-halo"
              cx={point.x}
              cy={point.y}
              r={4 + (point.value / 100) * 7}
              fill={accent}
              opacity="0.34"
              style={{ '--r': `${4 + (point.value / 100) * 7}` }}
            />
            <circle
              className="soul-starmap-node"
              cx={point.x}
              cy={point.y}
              r={2.6 + (point.value / 100) * 2.4}
              fill="#ffffff"
              style={{ '--delay': `${0.7 + index * 0.14}s` }}
            />
          </g>
        ))}

        {/* 轴标签 */}
        {showLabels ? points.map((point, index) => (
          <text
            key={`label-${point.name}`}
            x={point.labelX}
            y={point.labelY}
            textAnchor={point.anchor}
            dominantBaseline="middle"
            className="soul-starmap-node"
            style={{ '--delay': `${0.9 + index * 0.12}s` }}
            fill="rgba(248,251,255,0.66)"
            fontSize={size * 0.036}
            fontWeight="600"
          >
            {point.name}
          </text>
        )) : null}
      </svg>
    </figure>
  );
}

/* --------------------------------- 情绪光谱 --------------------------------- */

export function EmotionSpectrum({ items, animate = true }) {
  const rows = Array.isArray(items) ? items.filter((item) => item?.emotion) : [];
  if (!rows.length) return null;

  return (
    <div className="space-y-3.5">
      {rows.map((item, index) => (
        <div key={item.emotion} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <strong className="text-[0.84rem] font-semibold text-paper">{item.emotion}</strong>
            <small className="shrink-0 text-[0.72rem] font-bold tabular-nums" style={{ color: item.color }}>
              {item.value}
            </small>
          </div>
          <div className="emotion-bar">
            <i
              className="emotion-bar-fill block"
              style={{
                '--em': item.color,
                '--w': `${Math.max(6, Math.min(100, item.value))}%`,
                '--delay': animate ? `${index * 0.09}s` : '0s'
              }}
            />
          </div>
          {item.moment ? (
            <p className="text-[0.76rem] leading-relaxed text-paper-dim">{item.moment}</p>
          ) : null}
          {item.anchor ? (
            <em className="block text-[0.7rem] not-italic text-paper-faint">来自：{item.anchor}</em>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- 灵魂卡牌 --------------------------------- */

export function SoulCard({ card, userName = '', flip = false, className = '', footer = null }) {
  if (!card?.title) return null;
  const palette = Array.isArray(card.palette) && card.palette.length === 3
    ? card.palette
    : ['#8fd8ff', '#c08bff', '#ff7da8'];

  return (
    <article
      className={`soul-card ${flip ? 'soul-card-flip' : ''} ${className}`}
      style={{ '--sc-a': palette[0], '--sc-b': palette[1], '--sc-c': palette[2] }}
    >
      <div className="soul-card-body flex flex-col gap-5 p-7">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-faint">
              soul card
            </span>
            <h3 className="mt-1.5 break-words text-2xl font-black leading-tight text-paper">{card.title}</h3>
            {card.subtitle ? (
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-paper-dim">{card.subtitle}</p>
            ) : null}
          </div>
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/15 text-2xl"
            style={{ background: `linear-gradient(150deg, ${palette[0]}33, ${palette[1]}22)`, color: palette[0] }}
            aria-hidden="true"
          >
            {card.glyph || '☾'}
          </span>
        </header>

        {card.oneLiner ? (
          <p
            className="border-l-2 pl-3.5 text-[0.9rem] font-medium leading-relaxed text-paper"
            style={{ borderColor: palette[1] }}
          >
            {card.oneLiner}
          </p>
        ) : null}

        <dl className="grid grid-cols-3 gap-3 border-t border-white/[0.08] pt-4">
          {[
            ['本命元素', card.element],
            ['星座式描述', card.starSign],
            ['稀有度', card.rarity]
          ].filter(([, value]) => value).map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-paper-faint">{label}</dt>
              <dd className="mt-1 break-words text-[0.78rem] font-semibold text-paper-dim">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {palette.map((color) => (
              <span key={color} className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20" style={{ background: color }} />
            ))}
          </div>
          <small className="truncate text-[0.7rem] text-paper-faint">
            {userName ? `${userName} · ` : ''}Album Circle
          </small>
        </div>

        {footer}
      </div>
    </article>
  );
}
