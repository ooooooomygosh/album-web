import React, { useEffect, useId, useRef } from 'react';
import { ATMOSPHERE, atmosphereFrame, createAtmosphereLoop } from './cabin-atmosphere.mjs';
import './cabin-atmosphere.css';

const placement = ({ x, y, width, height }) => ({ left: `${x / 1448 * 100}%`, top: `${y / 1086 * 100}%`, width: `${width / 1448 * 100}%`, height: `${height / 1086 * 100}%` });
function prepare(canvas, box, pixel) {
  const ratio = pixel ? .25 : Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.ceil(box.width * ratio); canvas.height = Math.ceil(box.height * ratio);
  const ctx = canvas.getContext('2d'); if (!ctx) return null; ctx.imageSmoothingEnabled = !pixel; ctx.scale(canvas.width / box.width, canvas.height / box.height);
  return ctx;
}
function paintSnow(ctx, geometry, flakes, pixel, clean) {
  const { width, height } = geometry.window; ctx.clearRect(0, 0, width, height); ctx.save(); ctx.beginPath();
  for (const pane of geometry.panes) ctx.rect(...pane); ctx.clip();
  ctx.drawImage(clean, geometry.window.x, geometry.window.y, width, height, 0, 0, width, height);
  for (const flake of flakes) {
    ctx.fillStyle = `rgba(226,239,255,${flake.alpha})`;
    if (pixel) ctx.fillRect(Math.round(flake.x / 4) * 4, Math.round(flake.y / 4) * 4, 4, 4);
    else { ctx.beginPath(); ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
function paintFire(ctx, geometry, flames, clean) {
  const { width, height } = geometry.fire; ctx.clearRect(0, 0, width, height); ctx.save(); ctx.beginPath();
  geometry.opening.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
  ctx.drawImage(clean, geometry.fire.x, geometry.fire.y, width, height, 0, 0, width, height);
  for (const flame of flames) {
    for (const core of [false, true]) {
      const { x, base, sway, bend } = flame, h = flame.height * (core ? .58 : 1), w = flame.width * (core ? .43 : 1);
      const colour = ctx.createLinearGradient(x, base - h, x, base);
      colour.addColorStop(0, core ? '#fff7cb00' : '#ffce6800'); colour.addColorStop(.23, core ? '#fff3bdcc' : '#ffc65ab3'); colour.addColorStop(.6, core ? '#ffe09ddd' : '#ff982dc0'); colour.addColorStop(1, core ? '#ffb54b88' : '#dc461766');
      ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(x - w, base);
      ctx.bezierCurveTo(x - w * 1.2, base - h * .36, x + bend - w * .2, base - h * .73, x + sway, base - h);
      ctx.bezierCurveTo(x + sway + w * .25, base - h * .7, x + w + bend, base - h * .3, x + w, base);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}
export default function CabinAtmosphere({ look, weather }) {
  const gradient = useId().replace(/:/g, '');
  const root = useRef(null), snow = useRef(null), fire = useRef(null), light = useRef(null);
  const geometry = ATMOSPHERE[look] || ATMOSPHERE.warm;
  useEffect(() => {
    const element = root.current, pixel = look === 'pixel';
    const snowContext = prepare(snow.current, geometry.window, pixel), fireContext = prepare(fire.current, geometry.fire, pixel);
    if (!snowContext || !fireContext) return;
    const surfaces = [...light.current.querySelectorAll('[data-surface]')];
    const clean = new Image(); let ready = false, disposed = false;
    const draw = (seconds) => {
      if (!ready || disposed) return;
      const frame = atmosphereFrame(seconds, look, weather);
      paintSnow(snowContext, geometry, frame.snow, pixel, clean); paintFire(fireContext, geometry, frame.flames, clean);
      for (const surface of surfaces) surface.style.opacity = frame.surfaces[surface.dataset.surface];
    };
    draw(0);
    const loop = createAtmosphereLoop({ draw, request: requestAnimationFrame, cancel: cancelAnimationFrame, now: () => performance.now() });
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let focused = document.hasFocus();
    const update = (event) => {
      if (event?.type === 'blur') focused = false;
      if (event?.type === 'focus') focused = true;
      const reduced = media.matches || document.documentElement.dataset.desktopReduceMotion === 'true';
      if (!ready) return;
      // Main view keeps audio/timers unthrottled in Electron, so Page Visibility
      // can remain visible after minimize. Focus/blur is the renderer-only
      // fallback; an unfocusable wallpaper must keep animating independently.
      const background = document.hidden || (!window.albumWallpaper && !focused);
      const mode = background ? 'hidden' : reduced ? 'reduced' : 'running';
      element.dataset.motion = mode; loop.setMode(mode);
    };
    const observer = new MutationObserver(update); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-desktop-reduce-motion'] });
    media.addEventListener('change', update); document.addEventListener('visibilitychange', update); window.addEventListener('focus', update); window.addEventListener('blur', update);
    element.dataset.motion = 'loading';
    clean.onload = () => { if (disposed) return; ready = true; draw(0); update(); };
    clean.onerror = () => { if (!disposed) element.dataset.motion = 'unavailable'; };
    clean.src = `/room-scenes/${look}-cabin-clean.png`;
    return () => { disposed = true; clean.onload = clean.onerror = null; loop.dispose(); observer.disconnect(); media.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); window.removeEventListener('blur', update); };
  }, [look, weather, geometry]);
  return <div ref={root} className={`cabin-atmosphere atmosphere-${look}`} aria-hidden="true">
    <canvas ref={snow} className="cabin-window-snow" style={placement(geometry.window)}/>
    <canvas ref={fire} className="cabin-hearth-fire" style={placement(geometry.fire)}/>
    <svg ref={light} className="cabin-hearth-light" viewBox="0 0 1448 1086" preserveAspectRatio="none">
      <defs>
        <radialGradient id={`${gradient}-stone`} cx="98%" cy="68%" r="90%"><stop stopColor="#ffc071"/><stop offset=".55" stopColor="#ff9a38" stopOpacity=".6"/><stop offset="1" stopColor="#ff9a38" stopOpacity="0"/></radialGradient>
        <radialGradient id={`${gradient}-floor`} cx="83%" cy="20%" r="72%"><stop stopColor="#ffce81"/><stop offset=".5" stopColor="#ffa94b" stopOpacity=".45"/><stop offset="1" stopColor="#ffa94b" stopOpacity="0"/></radialGradient>
        <linearGradient id={`${gradient}-wood`}><stop stopColor="#ffad61" stopOpacity="0"/><stop offset="1" stopColor="#ffbb6d"/></linearGradient>
      </defs>
      <g data-surface="stone" fill={`url(#${gradient}-stone)`}>
        <path d="M1215 394H1448V495L1329 489L1215 488Z" opacity=".48"/>
        <path d="M1216 491L1328 498V744L1216 750Z"/>
        <path d="M1181 768L1328 742L1448 779V913L1181 832Z" opacity=".85"/>
      </g>
      <path data-surface="floor" d="M282 794L1144 790L1180 834L1448 917V1086L1320 938L283 937Z" fill={`url(#${gradient}-floor)`} opacity=".65"/>
      <g data-surface="wood" fill={`url(#${gradient}-wood)`} opacity=".38">
        <path d="M440 710H1128V779H440Z"/><path d="M1113 203L1140 198V778L1113 777Z"/>
      </g>
      <path data-surface="metal" d={look === 'pixel' ? 'M1343 533V721L1448 751' : 'M1344 529V706L1448 743'} fill="none" stroke="#ffdda0" strokeWidth="2" opacity="1"/>
      <path data-surface="glass" d="M1364 556L1364 617" fill="none" stroke="#ffe7bc" strokeWidth="2" opacity=".35"/>
    </svg>
  </div>;
}
