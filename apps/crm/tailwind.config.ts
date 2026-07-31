import type { Config } from 'tailwindcss';
import preset from '@crm-eco/ui/tailwind.preset';
import tailwindcssAnimate from 'tailwindcss-animate';

/**
 * Muted Spruce scale — the CRM's calming, de-fluoresced teal. Remapping the
 * default Tailwind `teal`/`cyan` palettes (and the shared `brand.teal` scale)
 * onto this family means the ~2k hardcoded `bg-teal-*` / `text-cyan-*` /
 * `brand-teal-*` classes across the product soften automatically, without
 * editing hundreds of call sites. Deep + low-chroma, not neon.
 */
const MUTED_SPRUCE = {
  50: '#eef4f5',
  100: '#d7e6e8',
  200: '#b3d0d4',
  300: '#84b2b8',
  400: '#549099',
  500: '#2f757f',
  600: '#255f69',
  700: '#204e57',
  800: '#1e4048',
  900: '#1b353c',
  950: '#0d2126',
} as const;

const config: Config = {
  presets: [preset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        teal: MUTED_SPRUCE,
        cyan: MUTED_SPRUCE,
        brand: { teal: MUTED_SPRUCE },
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
