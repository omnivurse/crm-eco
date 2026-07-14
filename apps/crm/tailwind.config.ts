import type { Config } from 'tailwindcss';
import preset from '@crm-eco/ui/tailwind.preset';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  presets: [preset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        fadeSlideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s ease-in-out infinite',
        fadeSlideUp: 'fadeSlideUp 0.5s ease-out forwards',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
