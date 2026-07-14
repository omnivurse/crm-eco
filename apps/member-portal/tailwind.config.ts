import type { Config } from 'tailwindcss';
import preset from '@crm-eco/ui/tailwind.preset';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  presets: [preset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/enrollment/src/**/*.{ts,tsx}',
  ],
  plugins: [tailwindcssAnimate],
};

export default config;
