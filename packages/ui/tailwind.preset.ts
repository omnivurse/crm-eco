import type { Config } from 'tailwindcss';

/**
 * Pay It Forward HealthShare - Tailwind Preset
 * Shared design tokens for all applications
 */
const preset: Partial<Config> = {
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1280px',
      },
    },
    extend: {
      colors: {
        /* shadcn/ui semantic tokens */
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },

        /* Brand color scales */
        brand: {
          navy: {
            50: '#e0e7ec',
            100: '#bfccd7',
            200: '#99aebf',
            300: '#6686a0',
            400: '#335d80',
            500: '#003560',
            600: '#002f54',
            700: '#002848',
            800: '#00213c',
            900: '#00192e',
          },
          teal: {
            50: '#e1f3f3',
            100: '#c1e6e6',
            200: '#9bd7d7',
            300: '#6ac3c2',
            400: '#38afae',
            500: '#069b9a',
            600: '#058888',
            700: '#047474',
            800: '#04605f',
            900: '#034a4a',
          },
          emerald: {
            50: '#e0f1ea',
            100: '#c0e3d6',
            200: '#99d2be',
            300: '#66ba9f',
            400: '#358f69',
            500: '#027343',
            600: '#02653b',
            700: '#025632',
            800: '#01472a',
            900: '#013720',
          },
          gold: {
            50: '#fcf6e4',
            100: '#faedc7',
            200: '#f6e2a5',
            300: '#f2d379',
            400: '#edc54c',
            500: '#e9b61f',
            600: '#cda01b',
            700: '#af8817',
            800: '#907113',
            900: '#70570f',
          },
        },
      },
      borderRadius: {
        xl: '16px',
        lg: '12px',
        md: '8px',
        sm: '4px',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      fontSize: {
        h1: ['2.5rem', { lineHeight: '3rem', fontWeight: '700' }],
        h2: ['2rem', { lineHeight: '2.5rem', fontWeight: '600' }],
        h3: ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        small: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(2,6,23,0.06), 0 8px 24px rgba(2,6,23,0.08)',
        popover: '0 12px 36px rgba(2,6,23,0.16)',
      },
      backgroundImage: {
        'brand-primary': 'linear-gradient(135deg, #003560 0%, #069B9A 100%)',
        'brand-accent': 'linear-gradient(135deg, #069B9A 0%, #027343 100%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default preset;
