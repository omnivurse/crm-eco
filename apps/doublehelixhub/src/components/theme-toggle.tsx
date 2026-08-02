'use client';

import { Moon, Sun } from '@phosphor-icons/react';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/55 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.06] hover:text-foreground ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun weight="light" className="h-4 w-4" /> : <Moon weight="light" className="h-4 w-4" />}
    </button>
  );
}
