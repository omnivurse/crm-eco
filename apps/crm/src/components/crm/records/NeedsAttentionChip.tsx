'use client';

/**
 * List-row attention flag from rules-only signals (no LLM).
 *
 * Compact by default: a tiny flag that keeps first-name / title cells
 * readable. Full signal text lives in the hover title / aria-label —
 * never inline in the table cell (long "Coverage incomplete…" pills
 * were blowing up row height and hiding names).
 */

import { memo, useMemo } from 'react';
import { Flag } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmRecord } from '@/lib/crm/types';
// Prefer the pure signals module (also re-exported from the client-safe
// `@/lib/crm/ai` barrel). Server-only `getRecordBriefing` lives in
// `@/lib/crm/ai/server` so it never enters the client bundle.
import {
  attentionScore,
  computeRecordSignals,
  topAttentionLabel,
} from '@/lib/crm/ai/signals';

export interface NeedsAttentionChipProps {
  record: CrmRecord;
  moduleKey?: string | null;
  className?: string;
  /**
   * Icon-only flag with details on hover (default). Pass false only for
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
    const signals = computeRecordSignals({
      moduleKey: moduleKey ?? null,
      title: record.title,
      email: record.email,
      phone: record.phone,
      status: record.status,
      stage: record.stage,
      updatedAt: record.updated_at,
      data,
    });
    if (attentionScore(signals) < 40) return null;
    const label = topAttentionLabel(signals);
    if (!label) return null;
    const top = [...signals].sort((a, b) => {
      const sev = { blocker: 0, warn: 1, info: 2 } as const;
      return sev[a.severity] - sev[b.severity];
    })[0];
    return {
      label,
      severity: (top?.severity ?? 'warn') as AttentionSeverity,
    };
  }, [record, moduleKey]);

  if (!attention) return null;

  const hover = `Needs attention: ${attention.label}`;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center w-4 h-4 flex-shrink-0 rounded-full border',
          severityClasses(attention.severity),
          className,
        )}
        title={hover}
        aria-label={hover}
        role="status"
      >
        <Flag className="w-2.5 h-2.5" aria-hidden />
      </span>
    );
  }

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
});
