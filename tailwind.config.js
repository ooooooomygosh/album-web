/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 背景墨色阶（近黑）
        ink: {
          950: '#040507',
          900: '#050608',
          850: '#07080a',
          800: '#08090b',
          750: '#0a0c0e',
          700: '#111315',
          600: '#121417',
          500: '#1f2226',
          400: '#222529',
        },
        // 文本纸色
        paper: {
          DEFAULT: '#f8fbff',
          dim: 'rgba(248, 251, 255, 0.72)',
          faint: 'rgba(248, 251, 255, 0.46)',
        },
        // 品牌强调色
        accent: {
          sky: '#6fc7ff',
          skyBright: '#64d2ff',
          gold: '#f7df71',
          yellow: '#ffd60a',
          pink: '#ff375f',
          purple: '#bf5af2',
          green: '#30d158',
          red: '#ff6b6b',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        sm: '10px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      boxShadow: {
        card: '0 22px 80px rgba(0,0,0,0.28)',
        soft: '0 12px 30px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 18px 60px rgba(0,0,0,0.45)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.18, 0.92, 0.22, 1.18)',
        snap: 'cubic-bezier(0.2, 1.05, 0.24, 1)',
        soft: 'cubic-bezier(0.22, 0.78, 0.2, 1)',
      },
      transitionDuration: {
        '400': '400ms',
        '500': '500ms',
        '700': '700ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slow-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        drift: {
          '0%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -2%, 0) scale(1.06)' },
          '100%': { transform: 'translate3d(0,0,0) scale(1)' },
        },
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'record-open': {
          '0%': { opacity: '0', transform: 'scale(0.86) rotate(-6deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'halo-pulse': {
          '0%,100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s var(--ease-soft, ease) both',
        'scale-in': 'scale-in 0.4s var(--ease-spring, cubic-bezier(0.18,0.92,0.22,1.18)) both',
        'slide-up': 'slide-up 0.5s var(--ease-soft, ease) both',
        'sheet-in': 'sheet-in 0.45s var(--ease-spring, cubic-bezier(0.18,0.92,0.22,1.18)) both',
        shimmer: 'shimmer 1.8s linear infinite',
        'slow-spin': 'slow-spin 22s linear infinite',
        drift: 'drift 18s ease-in-out infinite',
        'rise-in': 'rise-in 0.6s var(--ease-spring, cubic-bezier(0.18,0.92,0.22,1.18)) both',
        'record-open': 'record-open 0.7s var(--ease-spring, cubic-bezier(0.18,0.92,0.22,1.18)) both',
        'halo-pulse': 'halo-pulse 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.backface-hidden': { 'backface-visibility': 'hidden' },
        '.backface-visible': { 'backface-visibility': 'visible' },
        '.transform-style-3d': { 'transform-style': 'preserve-3d' },
        '.rotate-y-0': { transform: 'rotateY(0deg)' },
        '.rotate-y-180': { transform: 'rotateY(180deg)' },
        '.rotate-x-1': { transform: 'rotateX(1deg)' },
        '.perspective-1000': { perspective: '1000px' },
      });
    },
  ],
};
