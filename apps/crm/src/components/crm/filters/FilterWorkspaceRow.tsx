'use client';

import { useRef, type ReactNode } from 'react';
import { useRemainingViewportHeight } from '@/lib/crm/use-remaining-viewport-height';

interface FilterWorkspaceRowProps {
  rail: ReactNode;
  children: ReactNode;
}

/**
 * Filter rail + records pane share one remaining-viewport height so the
 * table card is not shorter than the rail (gray gap beside a full-dvh rail).
 */
export function FilterWorkspaceRow({ rail, children }: FilterWorkspaceRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const height = useRemainingViewportHeight(ref);

  return (
    <div
      ref={ref}
      className="flex items-stretch gap-3"
      style={height != null ? { height } : { minHeight: 240 }}
    >
      {rail}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 [&>*]:h-full">{children}</div>
      </div>
    </div>
  );
}
