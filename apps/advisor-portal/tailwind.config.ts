import type { Config } from 'tailwindcss';
import preset from '@crm-eco/ui/tailwind.preset';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  presets: [preset],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Soft Structuralism spruce teal (was bright cyan)
        advisor: {
          50: '#f0f9fb',
          100: '#d9f0f4',
          200: '#b7e0e9',
          300: '#85c8d6',
          400: '#4da6bc',
          500: '#0b6d85',
          600: '#0a5f74',
          700: '#0e4f61',
          800: '#134150',
          900: '#153744',
          950: '#0a232e',
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
