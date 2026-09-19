'use client';

import { Heart, Shield } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { ActiveCoverageGlance } from '@/lib/crm/active-coverage-glance';

export interface ActiveCoverageCardProps {
  glance: ActiveCoverageGlance;
  onOpen?: () => void;
  className?: string;
}

/**
 * Green "this is the live membership / plan" card for the Insights rail.
 * Overview snapshot uses the same classification; this is the at-a-glance copy.
 */
export function ActiveCoverageCard({ glance, onOpen, className }: ActiveCoverageCardProps) {
  const Icon = glance.planType === 'insurance' ? Shield : Heart;
  const rows = [
    glance.carrierValue ? { label: glance.carrierLabel, value: glance.carrierValue } : null,
    glance.amountValue ? { label: glance.amountLabel ?? 'Monthly', value: glance.amountValue } : null,
    glance.effectiveDate ? { label: 'Effective', value: glance.effectiveDate } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  const body = (
    <>
      <div className="flex items-start gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white dark:bg-emerald-500">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-200">
            {glance.eyebrow}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-emerald-950 dark:text-emerald-50">
            {glance.name ?? 'No plan details on file'}
          </p>
        </div>
      </div>
      {rows.length > 0 && (
        <dl className="mt-2 space-y-1">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-2 text-xs">
              <dt className="shrink-0 text-emerald-800/70 dark:text-emerald-200/70">{row.label}</dt>
              <dd className="truncate text-right font-medium text-emerald-950 dark:text-emerald-50">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  const wrapClass = cn(
    'w-full rounded-xl border border-emerald-300/80 bg-gradient-to-br from-emerald-100/95 to-white p-3 text-left shadow-sm ring-1 ring-emerald-500/15',
    'dark:border-emerald-500/35 dark:from-emerald-500/20 dark:to-slate-900/40 dark:ring-emerald-400/15',
    className,
  );

  if (onOpen) {
    return (
      <button
        type="button"
        data-testid="crm-active-coverage-card"
        onClick={onOpen}
        className={cn(wrapClass, 'transition-colors hover:border-emerald-400 hover:ring-emerald-500/25')}
      >
        {body}
      </button>
    );
  }

  return (
    <div data-testid="crm-active-coverage-card" className={wrapClass}>
      {body}
    </div>
  );
}
