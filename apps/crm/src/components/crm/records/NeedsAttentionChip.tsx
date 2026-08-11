'use client';

/**
 * List-row deterministic intelligence flag.
 *
 * Compact by default: a tiny flag that keeps first-name / title cells
 * readable. Click opens a popover with the top signal + next rules-based
 * action (same engine as the record "Next move" card). Full text never
 * lands inline in the table cell.
 */

import { memo, useMemo } from 'react';
import Link from 'next/link';
import { Flag } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import type { CrmRecord } from '@/lib/crm/types';
import {
  attentionScore,
  computeRecordSignals,
  rankRulesRecommendations,
  topAttentionLabel,
} from '@/lib/crm/ai/signals';

export interface NeedsAttentionChipProps {
  record: CrmRecord;
  moduleKey?: string | null;
  className?: string;
  /**
   * Icon-only flag with details on hover/click (default). Pass false only for
   * spacious surfaces that can afford a short text chip.
   */
  compact?: boolean;
}

type AttentionSeverity = 'blocker' | 'warn' | 'info';

function severityClasses(severity: AttentionSeverity): string {
  if (severity === 'blocker') {
    return 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300';
  }
  if (severity === 'warn') {
    return 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300';
  }
  return 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-500/10 dark:border-slate-500/30 dark:text-slate-300';
}

export const NeedsAttentionChip = memo(function NeedsAttentionChip({
  record,
  moduleKey,
  className,
  compact = true,
}: NeedsAttentionChipProps) {
  const attention = useMemo(() => {
    const key = (moduleKey ?? '').toLowerCase();
    if (!['leads', 'contacts', 'members'].includes(key)) return null;
    const data = {
      ...((record.data ?? {}) as Record<string, unknown>),
    };
    const signalInput = {
      moduleKey: moduleKey ?? null,
      title: record.title,
      email: record.email,
      phone: record.phone,
      status: record.status,
      stage: record.stage,
      updatedAt: record.updated_at,
      data,
    };
    const signals = computeRecordSignals(signalInput);
    if (attentionScore(signals) < 40) return null;
    const label = topAttentionLabel(signals);
    if (!label) return null;
    const top = [...signals].sort((a, b) => {
      const sev = { blocker: 0, warn: 1, info: 2 } as const;
      return sev[a.severity] - sev[b.severity];
    })[0];
    const next = rankRulesRecommendations(signals, signalInput)[0] ?? null;
    return {
      label,
      severity: (top?.severity ?? 'warn') as AttentionSeverity,
      code: top?.code ?? null,
      nextTitle: next?.title ?? null,
      nextRationale: next?.rationale ?? null,
    };
  }, [record, moduleKey]);

  if (!attention) return null;

  const hover = attention.nextTitle
    ? `${attention.label} → ${attention.nextTitle}`
    : `Needs attention: ${attention.label}`;

  const flagButton = (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 flex-shrink-0 rounded-full border',
        severityClasses(attention.severity),
        className,
      )}
      title={hover}
      aria-label={hover}
      onClick={(e) => e.stopPropagation()}
    >
      <Flag className="w-2.5 h-2.5" aria-hidden />
    </button>
  );

  if (!compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 max-w-[10rem] px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
          severityClasses(attention.severity),
          className,
        )}
        title={hover}
        aria-label={hover}
        role="status"
      >
        <Flag className="w-2.5 h-2.5 flex-shrink-0" aria-hidden />
        <span className="truncate">{attention.label}</span>
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{flagButton}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-64 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                'inline-flex items-center justify-center w-5 h-5 rounded-full border flex-shrink-0 mt-0.5',
                severityClasses(attention.severity),
              )}
            >
              <Flag className="w-3 h-3" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Deterministic signal
              </p>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-snug">
                {attention.label}
              </p>
            </div>
          </div>
          {attention.nextTitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Next: <span className="text-slate-700 dark:text-slate-200">{attention.nextTitle}</span>
              {attention.nextRationale ? ` — ${attention.nextRationale}` : ''}
            </p>
          )}
          <Link
            href={`/crm/r/${record.id}`}
            className="inline-flex text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open record →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
});
