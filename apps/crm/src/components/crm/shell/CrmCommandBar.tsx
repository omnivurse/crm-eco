'use client';

import { Search, Sparkles } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { openCrmCommandPalette } from '@/lib/crm/command-palette-bus';

interface CrmCommandBarProps {
  className?: string;
  /** Larger variant for dashboard hero placement. */
  size?: 'default' | 'hero';
  placeholder?: string;
}

/**
 * Zoho-style omnibar — opens the global command palette (search, navigate,
 * quick actions). Keyboard shortcut ⌘K / Ctrl+K is handled in CrmShell.
 */
export function CrmCommandBar({
  className,
  size = 'default',
  placeholder = 'Search records, jump to a module, or start a workflow…',
}: CrmCommandBarProps) {
  const isHero = size === 'hero';

  return (
    <button
      type="button"
      onClick={openCrmCommandPalette}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border text-left transition-all',
        'border-slate-200/90 dark:border-white/10 bg-white dark:bg-slate-900/80',
        'hover:border-teal-300 dark:hover:border-teal-500/40 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40',
        isHero ? 'px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'px-3 py-2',
        className,
      )}
      aria-label="Open command palette"
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg',
          isHero
            ? 'h-9 w-9 bg-teal-50 dark:bg-teal-500/10'
            : 'h-7 w-7 bg-slate-100 dark:bg-white/5',
        )}
      >
        <Search
          className={cn(
            'text-teal-600 dark:text-teal-400',
            isHero ? 'h-4 w-4' : 'h-3.5 w-3.5',
          )}
        />
      </div>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200',
          isHero ? 'text-sm' : 'text-[13px]',
        )}
      >
        {placeholder}
      </span>
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {isHero && (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 dark:bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <Sparkles className="h-3 w-3" />
            Workflows
          </span>
        )}
        <kbd className="inline-flex items-center rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          ⌘K
        </kbd>
      </div>
    </button>
  );
}
