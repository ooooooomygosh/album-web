/** Flow Cabin pixel design tokens — mirror of tokens.css for JS / canvas use. Keep in sync. */
export const tokens = {
  '--px-bg': '#1c120b',
  '--px-surface': '#2e1d12',
  '--px-surface-2': '#3a2416',
  '--px-surface-3': '#4d311c',
  '--px-ink': '#ffe9cb',
  '--px-ink-dim': '#c9a47a',
  '--px-ink-faint': '#a88a68',
  '--px-accent': '#e0ad69',
  '--px-accent-hi': '#ffd99c',
  '--px-accent-lo': '#a8743c',
  '--px-accent-2': '#7fb8a8',
  '--px-good': '#9ccf8c',
  '--px-warn': '#e06a4e',
  '--px-night': '#22304a',
  '--px-border': '#8a5a32',
  '--px-border-hi': '#b07a46',
  '--px-shadow': '#0d0805',
  '--px-focus': '#ffd99c',
  '--px-font-cn': "'Fusion Pixel 12', 'Fusion Pixel', 'Zpix', 'HarmonyOS Sans SC Bundled', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  '--px-font-en': "'Silkscreen', 'Fusion Pixel 12', 'Press Start 2P', monospace",
  '--px-font-body': "'HarmonyOS Sans SC Bundled', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  '--px-unit': '4px',
  '--px-radius': '0',
  '--px-border-w': '2px',
  '--px-dur-fast': '120ms',
  '--px-dur-med': '240ms',
  '--px-dur-slow': '480ms',
  '--px-ease': 'steps(4, end)',
  '--px-ease-fine': 'steps(8, end)',
} as const;

/** Plain palette for canvas / sprite generators (cover art, pet sprites). */
export const palette = {
  bg: tokens['--px-bg'], surface: tokens['--px-surface'], surface2: tokens['--px-surface-2'], surface3: tokens['--px-surface-3'],
  ink: tokens['--px-ink'], inkDim: tokens['--px-ink-dim'], inkFaint: tokens['--px-ink-faint'],
  accent: tokens['--px-accent'], accentHi: tokens['--px-accent-hi'], accentLo: tokens['--px-accent-lo'], accent2: tokens['--px-accent-2'],
  good: tokens['--px-good'], warn: tokens['--px-warn'], night: tokens['--px-night'],
  border: tokens['--px-border'], borderHi: tokens['--px-border-hi'], shadow: tokens['--px-shadow'],
} as const;

export const PX_UNIT = 4;
export const durations = { fast: 120, med: 240, slow: 480 } as const;
export type TokenName = keyof typeof tokens;
