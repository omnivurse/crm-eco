'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
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

  // Simple toggle between light and dark
  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
        className={cn(
          'h-9 w-9 rounded-lg transition-all',
          'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
          'hover:bg-slate-100 dark:hover:bg-white/10',
          className
        )}
        title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  // Dropdown with all options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-9 w-9 rounded-lg transition-all',
            'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            'hover:bg-slate-100 dark:hover:bg-white/10',
            className
          )}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-36 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
      >
        <DropdownMenuItem 
          onClick={() => setTheme('light')}
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            'text-slate-700 dark:text-slate-300',
            theme === 'light' && 'bg-slate-100 dark:bg-white/10'
          )}
        >
          <Sun className="h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('dark')}
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            'text-slate-700 dark:text-slate-300',
            theme === 'dark' && 'bg-slate-100 dark:bg-white/10'
          )}
        >
          <Moon className="h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('system')}
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            'text-slate-700 dark:text-slate-300',
            theme === 'system' && 'bg-slate-100 dark:bg-white/10'
          )}
        >
          <Monitor className="h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
