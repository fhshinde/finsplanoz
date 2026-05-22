/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sophisticated warm-dark advisor palette
        ink: {
          950: '#0b0d11',  // app bg — very slight warm tint
          900: '#11141b',  // surface
          850: '#161a23',  // surface elevated
          800: '#1c2230',  // elevated card
          750: '#222a3a',  // border-stronger
          700: '#2a3346',  // border
          600: '#3a4458',
          500: '#525c75',
          400: '#6b7691',
          300: '#9aa3b8',
          200: '#bfc6d6',
          100: '#dfe3ec',
          50:  '#f4f6fb',
        },
        // Brand gradient endpoints — champagne luxe
        brand: {
          DEFAULT: '#c4a875',
          light: '#e8c79f',
          dark: '#9a7f4d',
          dim: '#241d12',
        },
        gain: { DEFAULT: '#88b59c', dim: '#172420' },
        loss: { DEFAULT: '#f87171', dim: '#2a1418' },
        info: { DEFAULT: '#7dd3fc', dim: '#0d2436' },
        warn: { DEFAULT: '#fbbf24', dim: '#2a2014' },
        dawn: '#e8c79f',
        dusk: '#b3a4d4',
        mist: '#a8c5b0',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        'hero': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
      },
      boxShadow: {
        'card': '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -8px rgba(0,0,0,0.5)',
        'card-hover': '0 1px 0 rgba(255,255,255,0.06) inset, 0 2px 4px rgba(0,0,0,0.5), 0 20px 48px -12px rgba(196,168,117,0.15)',
        'hero': '0 1px 0 rgba(255,255,255,0.06) inset, 0 2px 4px rgba(0,0,0,0.4), 0 32px 64px -16px rgba(196,168,117,0.2)',
        'glow-brand': '0 0 48px -8px rgba(196,168,117,0.4)',
        'glow-gain': '0 0 32px -8px rgba(74,222,128,0.3)',
      },
      animation: {
        'fade-in': 'fade-in 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        'rise': 'rise 600ms cubic-bezier(0.16, 1, 0.3, 1)',
        'breath': 'breath 4s ease-in-out infinite',
        'shimmer': 'shimmer 8s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'rise': { '0%': { opacity: 0, transform: 'translateY(12px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'breath': { '0%,100%': { transform: 'scale(1)', opacity: 0.6 }, '50%': { transform: 'scale(1.05)', opacity: 1 } },
        'shimmer': { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
