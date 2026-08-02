import type { Config } from 'tailwindcss';
import preset, { consoleColors } from '@crm-eco/ui/tailwind.preset';
import tailwindcssAnimate from 'tailwindcss-animate';

/**
 * The Muted Spruce remap now lives in `@crm-eco/ui/tailwind.preset` as
 * `consoleColors`, shared with the Admin console so `bg-teal-500` resolves to
 * the same colour in both operator consoles.
 */
const config: Config = {
  presets: [preset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ...consoleColors,
        dhh: { highlight: '#3aa7b2' },
      },
      backgroundImage: {
        'brand-primary': 'linear-gradient(135deg, #0f172a 0%, #14707a 100%)',
        'brand-accent': 'linear-gradient(135deg, #14707a 0%, #2f6f57 100%)',
      },
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
