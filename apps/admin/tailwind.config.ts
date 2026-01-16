import type { Config } from 'tailwindcss';
import preset from '@crm-eco/ui/tailwind.preset';

const config: Config = {
  presets: [preset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  plugins: [require('tailwindcss-animate')],
};

export default config;
