'use client';

/**
 * Grounded Record Briefing — insights-rail "Next move" card.
 * Deterministic intelligence by default (rules-only signals + recommendations).
 * Optional "Enhance with AI" rephrases/ranks the same closed signal pack.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Flag,
  Loader2,
  Mail,
  Phone,
  Shield,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import type { BriefingAction, RecordBriefing } from '@/lib/crm/ai/types';
import { useRecordAiContext } from './RecordAiContext';

export interface RecordBriefingCardProps {
  recordId?: string;
  onCall?: () => void;
  onEmail?: (goal?: string) => void;
  onTask?: () => void;
  onFillField?: (fieldKey: string) => void;
  onReviewCoverage?: () => void;
  className?: string;
}

const ACTION_ICONS: Record<BriefingAction['action'], LucideIcon> = {
  call: Phone,
  email: Mail,
  task: ClipboardList,
  fill_field: ClipboardList,
  review_coverage: Shield,
  none: Flag,
};

export const RecordBriefingCard = memo(function RecordBriefingCard({
  recordId: recordIdProp,
  onCall,
  onEmail,
  onTask,
  onFillField,
  onReviewCoverage,
  className,
}: RecordBriefingCardProps) {
  const aiCtx = useRecordAiContext();
  const recordId = recordIdProp ?? aiCtx?.recordId;
  const enabled = aiCtx?.enabled !== false;
  const [briefing, setBriefing] = useState<RecordBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferLlm, setPreferLlm] = useState(false);

  const load = useCallback(async () => {
    if (!recordId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, preferLlm }),
      });
      if (res.status === 401 || res.status === 403) {
        setError('permission');
        setBriefing(null);
        return;
      }
      if (!res.ok) {
        setError('failed');
        setBriefing(null);
        return;
      }
      const data = (await res.json()) as RecordBriefing;
      setBriefing(data);
    } catch {
      setError('failed');
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, [recordId, enabled, preferLlm]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!enabled || !recordId) return null;

  const run = (action: BriefingAction) => {
    switch (action.action) {
      case 'call':
        onCall?.();
        break;
      case 'email':
        onEmail?.(action.payload?.emailGoal);
        break;
      case 'task':
        onTask?.();
        break;
      case 'fill_field':
        if (action.payload?.fieldKey) onFillField?.(action.payload.fieldKey);
        break;
      case 'review_coverage':
        onReviewCoverage?.();
        break;
      default:
        break;
    }
  };

  const modeLabel =
    briefing?.mode === 'llm'
      ? 'AI ranked'
      : briefing?.mode === 'degraded'
        ? 'Rules fallback'
        : 'Deterministic';

  return (
    <section
      aria-label="Next move"
      className={cn(
        'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 overflow-hidden',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r from-teal-50/70 to-transparent dark:from-teal-500/10">
        <div className="flex items-center gap-1.5 min-w-0">
          {briefing?.mode === 'llm' ? (
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          ) : (
            <Flag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          )}
          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate">
            Next move
          </h4>
        </div>
        {briefing && (
          <span className="text-[10px] tabular-nums text-slate-400 shrink-0" title="Grounded in record fields and rules — not invented">
            {modeLabel}
          </span>
        )}
      </header>

      <div className="p-3 space-y-2.5">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Reading this record…
          </div>
        )}

        {!loading && error === 'permission' && (
          <p className="text-xs text-slate-500">You don’t have access to record briefings.</p>
        )}

        {!loading && error === 'failed' && (
          <div className="space-y-2">
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Couldn’t load briefing. Try again.
            </p>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && briefing?.allClear && (
          <div className="flex items-start gap-2 py-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
                All clear
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {briefing.summary}
              </p>
            </div>
          </div>
        )}

        {!loading && !error && briefing && !briefing.allClear && (
          <>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
              {briefing.summary}
            </p>

            {briefing.signals.length > 0 && (
              <ul className="flex flex-wrap gap-1">
                {briefing.signals.slice(0, 4).map((s) => (
                  <li
                    key={s.code + s.label}
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border',
                      s.severity === 'blocker' &&
                        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
                      s.severity === 'warn' &&
                        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30',
                      s.severity === 'info' &&
                        'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-white/10',
                    )}
                    title={s.evidence
                      .map((e) => ('key' in e ? e.key : e.id))
                      .filter(Boolean)
                      .join(', ')}
                  >
                    {s.label}
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-1">
              {briefing.recommendations.map((rec) => {
                const Icon = ACTION_ICONS[rec.action] ?? Flag;
                return (
                  <Button
                    key={`${rec.action}-${rec.title}`}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-auto py-2 text-left"
                    onClick={() => run(rec)}
                    title={rec.rationale}
                  >
                    <Icon className="w-4 h-4 mr-2 shrink-0 text-teal-600 dark:text-teal-400" />
                    <span className="flex flex-col items-start min-w-0">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-100">
                        {rec.title}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-full">
                        {rec.rationale}
                        {rec.confidence !== 'high' ? ` · ${rec.confidence}` : ''}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </>
        )}

        {!loading && !error && briefing && !briefing.allClear && (
          <div className="pt-1 border-t border-slate-100 dark:border-white/5">
            {!preferLlm ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                onClick={() => setPreferLlm(true)}
                title="Rephrase and rank the same record signals with AI"
              >
                <Sparkles className="w-3 h-3" />
                Enhance with AI
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                onClick={() => setPreferLlm(false)}
                title="Return to rules-only deterministic briefing"
              >
                <Flag className="w-3 h-3" />
                Use deterministic only
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
});
