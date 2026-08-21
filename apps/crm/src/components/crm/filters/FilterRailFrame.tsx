'use client';

import type { ReactNode } from 'react';
import { ChevronRight, Filter } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

interface FilterRailFrameProps {
  open: boolean;
  onToggle: () => void;
  title: string;
  activeCount?: number;
  children: ReactNode;
}

/**
 * Desktop-only docked filter column. Height comes from FilterWorkspaceRow —
 * this frame only fills that cell so the rail cannot outgrow the table.
 */
export function FilterRailFrame({
  open,
  onToggle,
  title,
  activeCount = 0,
  children,
}: FilterRailFrameProps) {
  if (!open) {
    return (
      <aside
        className="hidden h-full w-10 lg:flex"
        aria-label={title}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={`Show ${title}`}
          title={`Show ${title}`}
          className={cn(
            'flex h-full min-h-0 w-full flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-1.5 py-3',
            'text-slate-600 hover:border-primary/40 hover:text-primary dark:border-white/10 dark:bg-slate-950 dark:text-slate-300',
            activeCount > 0 && 'border-primary/40 bg-primary/5 text-primary',
          )}
        >
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
            {title}
          </span>
          {activeCount > 0 && (
            <span className="mt-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="hidden h-full w-72 min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950 lg:flex"
      aria-label={title}
    >
      {children}
    </aside>
  );
}
