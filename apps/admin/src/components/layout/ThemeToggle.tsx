'use client';

import { Sun, Moon, Monitor } from '@phosphor-icons/react';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { useTheme } from '@/components/providers/theme-provider';
import { cn } from '@crm-eco/ui/lib/utils';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'dropdown';
}

export function ThemeToggle({ className, variant = 'dropdown' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
        className={cn(
          'relative h-9 w-9 rounded-full transition-all',
          'text-[var(--lp-muted,#64748b)] hover:text-[var(--lp-fg,#0f172a)]',
          'hover:bg-black/[0.04] dark:hover:bg-white/10',
          className,
        )}
        title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
      >
        <Sun
          weight="light"
          className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
        />
        <Moon
          weight="light"
          className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
        />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-9 w-9 rounded-full transition-all duration-500 ease-[var(--adm-ease)]',
            'text-[var(--adm-muted)] hover:text-[var(--adm-ink)]',
            'hover:bg-[rgba(11,109,133,0.08)] dark:hover:bg-white/10',
            className,
          )}
          title={`Theme: ${resolvedTheme}`}
        >
          <Sun
            weight="light"
            className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
          />
          <Moon
            weight="light"
            className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-36 rounded-2xl border-[var(--adm-hairline)] bg-[var(--adm-panel)]"
      >
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={cn('cursor-pointer gap-2', theme === 'light' && 'bg-[rgba(11,109,133,0.08)]')}
        >
          <Sun weight="light" className="h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={cn('cursor-pointer gap-2', theme === 'dark' && 'bg-white/10')}
        >
          <Moon weight="light" className="h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={cn('cursor-pointer gap-2', theme === 'system' && 'bg-[rgba(11,109,133,0.08)]')}
        >
          <Monitor weight="light" className="h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
