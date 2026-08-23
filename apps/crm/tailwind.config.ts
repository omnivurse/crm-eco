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
      /**
       * A11Y-1 contrast: `text-slate-400` (≈3k call sites) and
       * `text-slate-500` (≈2.4k) ARE the CRM's dim-chrome inks — section
       * headers, kbd hints, placeholders, counts, inline-edit prompts. At the
       * stock Tailwind values they fail WCAG AA as body text:
       *
       *   light  #94a3b8 on #ffffff = 2.56:1   (needs 4.5:1)
       *   light  #94a3b8 on #e9eef4 = 2.19:1   (the kbd chip)
       *   dark   #64748b on #060b16 = 4.13:1   (`dark:text-slate-500`)
       *   dark   #64748b on #1e293b = 3.07:1
       *
       * No single hex clears both themes — light needs a DARKER ink than
       * white allows a 400 to be, dark needs a LIGHTER one — so the two
       * shades resolve through per-theme tokens (globals.css `:root` /
       * `.dark`). Lightness only: same slate hue, same call sites, no
       * per-component overrides.
       *
       * Deliberately `textColor`, not `colors`: this must not move
       * `bg-slate-400` / `border-slate-500` / `ring-slate-400`, which are
       * surfaces and dividers with their own (passing) contrast story.
       * Same bridge pattern as `consoleColors` above.
       */
      textColor: {
        slate: {
          400: 'rgb(var(--crm-ink-dim) / <alpha-value>)',
          500: 'rgb(var(--crm-ink-muted) / <alpha-value>)',
        },
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
