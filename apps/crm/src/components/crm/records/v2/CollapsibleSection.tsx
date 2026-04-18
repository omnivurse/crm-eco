'use client';

import { useState, useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

export interface CollapsibleSectionProps {
  title: ReactNode;
  /** Right-aligned secondary element in the header (e.g. action link). */
  action?: ReactNode;
  /** Default expanded state. Defaults to true. */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional persistence key — stored in localStorage so state survives reloads. */
  persistKey?: string;
  children: ReactNode;
  className?: string;
  /** Matches Zoho's "Hide Details / Show Details" label style. */
  showLabel?: string;
  hideLabel?: string;
}

/**
 * Drop-in collapsible section used for "Hide Details" blocks in the V2 shell.
 * Persists state optionally via localStorage so a user's collapse preference
 * carries across pageloads.
 */
export function CollapsibleSection({
  title,
  action,
  defaultOpen,
  open: controlledOpen,
  onOpenChange,
  persistKey,
  children,
  className,
  showLabel = 'Show Details',
  hideLabel = 'Hide Details',
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultOpen ?? true;
    if (persistKey) {
      const stored = window.localStorage.getItem(`crm.collapse.${persistKey}`);
      if (stored === '1') return true;
      if (stored === '0') return false;
    }
    return defaultOpen ?? true;
  });
  const open = controlledOpen ?? internalOpen;
  const headingId = useId();
  const regionId = useId();

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
    if (persistKey && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`crm.collapse.${persistKey}`, next ? '1' : '0');
      } catch {
        // Ignore storage errors (Safari private mode, quotas, etc.)
      }
    }
  };

  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/5">
        <button
          type="button"
          id={headingId}
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          <ChevronDown
            className={cn('w-4 h-4 text-slate-400 transition-transform', !open && '-rotate-90')}
          />
          {title}
        </button>
        <div className="flex items-center gap-3">
          {action}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
            aria-labelledby={headingId}
          >
            {open ? hideLabel : showLabel}
          </button>
        </div>
      </header>
      {open && (
        <div id={regionId} role="region" aria-labelledby={headingId} className="p-4">
          {children}
        </div>
      )}
    </section>
  );
}
