'use client';

import { useRef, type ReactNode } from 'react';
import { useRemainingViewportHeight } from '@/lib/crm/use-remaining-viewport-height';
import { toastCopy } from '@/lib/crm/toast-copy';

const LOADING_ROWS_LABEL = toastCopy.loadingCopy('Loading records');

interface FilterWorkspaceRowProps {
  rail: ReactNode;
  children: ReactNode;
  /** Sticky pager inside the records pane, not below the 2× viewport workspace. */
  footer?: ReactNode;
  /**
   * A list navigation (Apply / sort / page / view mode) is in flight: the
   * stale rows stay put while a 2px bar runs along the top of the pane and
   * the pane reports `aria-busy`. Rendering stays mounted — no remount.
   */
  pending?: boolean;
}

/**
 * Filter rail + records pane share one remaining-viewport height.
 *
 * Load-bearing: the row always has an explicit `height` and `overflow-hidden`.
 * Without that, the rail sizes to its field list (taller than the viewport)
 * while the table uses a remaining-viewport cap — gray gap, clipped rows.
 */
export function FilterWorkspaceRow({ rail, children, footer, pending = false }: FilterWorkspaceRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const height = useRemainingViewportHeight(ref);

  return (
    <div
      ref={ref}
      data-filter-workspace
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 overflow-hidden"
      style={{ height: height ?? 240 }}
    >
      <div className="min-h-0 h-full overflow-hidden">{rail}</div>
      <div
        className="relative min-h-0 h-full overflow-hidden flex flex-col"
        aria-busy={pending || undefined}
        data-list-pending={pending ? 'true' : undefined}
      >
        {pending ? (
          <div
            role="progressbar"
            aria-label={LOADING_ROWS_LABEL}
            aria-valuetext={LOADING_ROWS_LABEL}
            data-testid="crm-list-progress"
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-2xl"
          >
            <div className="h-full w-full origin-left animate-pulse bg-primary/80" />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden [&>*]:h-full">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-slate-950">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
