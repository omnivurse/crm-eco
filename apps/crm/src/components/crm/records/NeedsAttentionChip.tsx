'use client';

/**
 * List-row chip from rules-only signals (no LLM). Matches detail briefing codes.
 */

import { memo, useMemo } from 'react';
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
}

export const NeedsAttentionChip = memo(function NeedsAttentionChip({
  record,
  moduleKey,
  className,
}: NeedsAttentionChipProps) {
  const label = useMemo(() => {
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
    return topAttentionLabel(signals);
  }, [record, moduleKey]);

  if (!label) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
        'bg-amber-50 text-amber-800 border-amber-200',
        'dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30',
        className,
      )}
      title="Needs attention — based on record signals"
    >
      {label}
    </span>
  );
});
