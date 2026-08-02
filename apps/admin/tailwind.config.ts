import type { Config } from 'tailwindcss';
import preset, { consoleColors } from '@crm-eco/ui/tailwind.preset';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  presets: [preset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      /**
       * Adopt the CRM's Muted Spruce remap so the two operator consoles share
       * one teal. Without this, Admin rendered stock Tailwind teal/cyan while
       * the CRM rendered muted spruce — the same utility class, two different
       * colours, and the main reason the consoles read as unrelated products.
       */
      colors: { ...consoleColors },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
