'use client';

import { useRef, type ReactNode } from 'react';
import { useRemainingViewportHeight } from '@/lib/crm/use-remaining-viewport-height';

interface FilterWorkspaceRowProps {
  rail: ReactNode;
  children: ReactNode;
}

/**
 * Filter rail + records pane share one remaining-viewport height.
 *
 * Load-bearing: the row always has an explicit `height` and `overflow-hidden`.
 * Without that, the rail sizes to its field list (taller than the viewport)
 * while the table uses a remaining-viewport cap — gray gap, clipped rows.
 */
export function FilterWorkspaceRow({ rail, children }: FilterWorkspaceRowProps) {
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
      <div className="relative min-h-0 h-full overflow-hidden [&>*]:h-full">
        {children}
      </div>
    </div>
  );
}
