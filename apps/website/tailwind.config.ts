import type { Config } from 'tailwindcss';
import preset from '@crm-eco/ui/tailwind.preset';

const config: Config = {
  presets: [preset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/enrollment/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
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
  plugins: [require('tailwindcss-animate')],
};

export default config;
