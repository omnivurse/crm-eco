import type { Config } from 'tailwindcss';

/**
 * Double Helix Software — Marketing site Tailwind config
 *
 * Standalone (NOT extending @crm-eco/ui preset) to keep the SaaS
 * marketing brand visually distinct from the PIFH consumer site.
 *
 * Design language: dark-first bio-tech.
 *  - Base: deep ink + slate
 *  - Accents: electric cyan, helix violet, signal lime
 *  - Display type: Space Grotesk
 *  - Body type: Inter
 *  - Numerals: JetBrains Mono
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1.25rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1280px',
      },
    },
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          950: '#05060B',
          900: '#080A12',
          800: '#0C0F1A',
          700: '#11152233',
        },
        helix: {
          /* Primary accent — electric cyan */
          cyan: {
            50: '#E6FBFF',
            100: '#C2F4FF',
            200: '#85E8FF',
            300: '#3DD6FF',
            400: '#0DBEEB',
            500: '#06A0C8',
            600: '#0481A1',
            700: '#03607A',
            800: '#024354',
            900: '#012732',
          },
          /* Secondary accent — helix violet */
          violet: {
            50: '#F1ECFF',
            100: '#DCD0FF',
            200: '#B8A1FF',
            300: '#937DFF',
            400: '#6F5BFF',
            500: '#5840EB',
            600: '#3F2BC2',
            700: '#2B1D90',
            800: '#1B125F',
            900: '#0E0935',
          },
          /* Tertiary accent — signal lime (for confirmations / stats) */
          lime: {
            300: '#D5FF6E',
            400: '#B6F23E',
            500: '#94D81B',
          },
          /* Neutral chrome */
          mist: '#A2AEC2',
          fog: '#6E7A92',
          steel: '#384156',
          edge: '#1B2235',
        },
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      letterSpacing: {
        'tighter-2': '-0.04em',
      },
      boxShadow: {
        'glow-cyan': '0 0 0 1px rgba(13,190,235,0.25), 0 20px 60px -20px rgba(13,190,235,0.45)',
        'glow-violet': '0 0 0 1px rgba(111,91,255,0.25), 0 20px 60px -20px rgba(111,91,255,0.55)',
        'glow-soft': '0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px -30px rgba(0,0,0,0.6)',
        'inset-edge': 'inset 0 1px 0 0 rgba(255,255,255,0.05), inset 0 -1px 0 0 rgba(0,0,0,0.4)',
      },
      backgroundImage: {
        'aurora-radial':
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(13,190,235,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 30%, rgba(111,91,255,0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 10% 70%, rgba(13,190,235,0.10) 0%, transparent 60%)',
        'grid-fine':
          'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        'noise':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
      backgroundSize: {
        'grid-fine': '48px 48px',
      },
      keyframes: {
        'helix-spin': {
          '0%': { transform: 'rotate3d(0,1,0,0deg)' },
          '100%': { transform: 'rotate3d(0,1,0,360deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.7' },
          '50%': { opacity: '1' },
        },
        'aurora-shift': {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(-2%, 1%, 0)' },
        },
        'marquee-x': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'helix-spin': 'helix-spin 32s linear infinite',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'aurora-shift': 'aurora-shift 18s ease-in-out infinite',
        'marquee-x': 'marquee-x 38s linear infinite',
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
