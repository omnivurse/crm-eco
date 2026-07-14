import type { Config } from 'tailwindcss';
import preset from '@crm-eco/ui/tailwind.preset';
import tailwindcssAnimate from 'tailwindcss-animate';

// Pay It Forward Health brand palette (from the logo). Applied LOCALLY to this
// app only — the shared @crm-eco/ui preset is left untouched so CRM/admin/portal
// keep their own theme. We also repoint the legacy `dhh` and `cyan` scales used
// by pre-existing markup so the whole site re-skins to brand at once.
const pif = {
  navy: {
    50: '#ECF3F8', 100: '#D5E5EF', 200: '#ADCBDE', 300: '#6E9EBE', 400: '#356E92',
    500: '#0E5277', 600: '#003A5C', 700: '#002F4B', 800: '#06283D', 900: '#04202F',
    DEFAULT: '#003A5C',
  },
  teal: {
    50: '#E6F6F7', 100: '#C2EAED', 200: '#8FD7DC', 300: '#54BFC7', 400: '#1FA4AE',
    500: '#0E8C9A', 600: '#0B7480', 700: '#0B5D66', 800: '#0C4A52', 900: '#0A3B42',
    DEFAULT: '#0E8C9A',
  },
  green: {
    50: '#E7F7EE', 100: '#C5EBD5', 200: '#93D9B1', 300: '#57C389', 400: '#25AC68',
    500: '#12A065', 600: '#0B8453', 700: '#0A6A44', 800: '#0A5538', 900: '#08442E',
    DEFAULT: '#12A065',
  },
  gold: {
    50: '#FEF7E6', 100: '#FCEBBE', 200: '#F9D982', 300: '#F6C748', 400: '#F4B400',
    500: '#D89E00', 600: '#B07F00', 700: '#8A6300', 800: '#6B4D00', 900: '#4F3900',
    DEFAULT: '#F4B400',
  },
  ink: '#0A2233',
  mist: '#F2F8F9',
};

const config: Config = {
  presets: [preset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/enrollment/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        pif,
        // Repoint legacy tokens used by existing markup -> PIFH
        dhh: {
          ink: '#06283D',
          panel: '#003A5C',
          surface: '#002F4B',
          highlight: '#1FA4AE',
        },
        // Any stray cyan-* utility now renders as brand teal
        cyan: pif.teal,
      },
      backgroundImage: {
        'pif-brand': 'var(--pif-grad-brand)',
        'pif-care': 'var(--pif-grad-care)',
        'pif-deep': 'var(--pif-grad-deep)',
        'pif-gold': 'var(--pif-grad-gold)',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Fraunces', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'blob-1': 'blob-drift-1 12s ease-in-out infinite',
        'blob-2': 'blob-drift-2 15s ease-in-out infinite',
        'blob-3': 'blob-drift-3 10s ease-in-out infinite',
        'blob-4': 'blob-drift-4 18s ease-in-out infinite',
        'blob-5': 'blob-drift-5 14s ease-in-out infinite',
        'hero-float-slow': 'hero-float 8s ease-in-out infinite',
        'hero-float-mid': 'hero-float 6s ease-in-out infinite',
        'hero-float-fast': 'hero-float 4.5s ease-in-out infinite',
      },
      keyframes: {
        'hero-float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
