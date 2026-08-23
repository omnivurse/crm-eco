'use client';

/**
 * DataHealthClient — /crm/data-health
 *
 * Renders the deterministic sweep report from GET /api/crm/data-health:
 * the 0–100 score big and honest, then every check grouped by what kind of
 * problem it finds (error → warn → info), each with its count, its
 * one-sentence meaning, and — where a natural destination exists — a link
 * to go act on it. Sample ids link to /crm/r/<id>; RLS protects the
 * click-through, the payload itself is ids + counts only, never PII.
 *
 * Honesty rules (copied from the Review Duplicates fix):
 *   - a failed load must NEVER read as "all clean" — the error banner is the
 *     only voice, the celebratory panel stays hidden while an error shows;
 *   - checks that could not run are surfaced, because a score that silently
 *     skipped them would read better than reality.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { toastCopy } from '@/lib/crm/toast-copy';
import { pendingContactsHref } from '@/components/dashboard/command-desk/command-desk-format';
import { Button } from '@crm-eco/ui/components/button';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  HeartPulse,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Payload types — the API contract (ids + counts only, never PII)
// ---------------------------------------------------------------------------

export type RuleSeverity = 'error' | 'warn' | 'info';

export interface DataHealthRule {
  key: string;
  label: string;
  severity: RuleSeverity;
  /** One sentence: what this check means and why it matters. */
  describe: string;
  count: number;
  /** Record ids only (max 20) — resolved to titles behind RLS on click. */
  sampleIds: string[];
  /** Optional companion number (e.g. dismissed duplicate pairs). */
  context?: { label: string; value: number };
}

export interface DataHealthPayload {
  score: number;
  /** Bumps only when the formula changes — a moved score means moved data. */
  formulaVersion?: number;
  generatedAt: string;
  /** The day the checks were evaluated against (time-relative rules key off it). */
  asOf?: string;
  /**
   * 'live'     — swept just now, on demand.
   * 'recorded' — the last committed sweep, because this deployment has no
   *              read-only sweep connection. Said out loud, never disguised.
   */
  source?: 'live' | 'recorded';
  /** Active records in the book — the denominator behind the score. */
  bookSize: number;
  rules: DataHealthRule[];
  /**
   * Checks that could not run — shown, never silently skipped. `label` is the
   * rule's human name and is what renders; `key` is kept only as a support
   * handle behind a tooltip, because "dupes.open-pairs" means nothing to the
   * person this page is for.
   */
  errors: Array<{ key: string; label?: string; message?: string }>;
}

// ---------------------------------------------------------------------------
// Where a check's problems get fixed — the "act on it" links
// ---------------------------------------------------------------------------

function actionFor(key: string): { href: string; label: string } | null {
  switch (key) {
    case 'dupes.open-pairs':
      return { href: '/crm/duplicates', label: 'Review the pairs' };
    case 'vocabulary.product':
      return {
        href: '/crm/settings/field-options?module=contacts&field=product',
        label: 'Fix the dropdown list',
      };
    // Both pending rules land in the same lane, oldest first — the list the
    // Command Desk's Pending tile already opens.
    case 'lifecycle.stale-pending':
    case 'dates.pending-no-start':
      return { href: pendingContactsHref(), label: 'Open the Pending lane, oldest first' };
    case 'ingest.stuck-imports':
      return { href: '/crm/imports', label: 'Open import jobs' };
    case 'completeness.member-core':
      return { href: '/crm/modules/members', label: 'Open Members' };
    default:
      // No link is better than a wrong one: the rest are fixed on the record
      // itself, and every card lists sample records to open.
      return null;
  }
}

// ---------------------------------------------------------------------------
// Severity groups, in the order a person should read them
// ---------------------------------------------------------------------------

const SECTIONS: Array<{ severity: RuleSeverity; title: string; sub: string }> = [
  {
    severity: 'error',
    title: 'Fix first',
    sub: 'The data itself is broken — links that point nowhere or values that cannot be right.',
  },
  {
    severity: 'warn',
    title: 'Meaning problems',
    sub: 'A value is there, but it does not match the lists the CRM understands.',
  },
  {
    severity: 'info',
    title: 'Worth watching',
    sub: 'Not wrong by itself — a workflow smell that deserves a look.',
  },
];

const COUNT_BADGE: Record<RuleSeverity, string> = {
  error: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/40',
};

function scoreTone(score: number): string {
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 75) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/** Minimal shape guard so a half-deployed API never renders garbage. */
function isPayload(value: unknown): value is DataHealthPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.score === 'number' &&
    typeof v.generatedAt === 'string' &&
    Array.isArray(v.rules) &&
    Array.isArray(v.errors)
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataHealthClient() {
  const [report, setReport] = useState<DataHealthPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState(false);

  const load = useCallback(async (isManualRefresh = false) => {
    setIsLoading(true);
    try {
      // The route answers `private, max-age=60`, so simply re-opening the page
      // is served by the admin's own browser instead of re-sweeping the book.
      // Pressing Refresh is an explicit ask for fresh numbers, so it revalidates.
      const res = await fetch('/api/crm/data-health', {
        cache: isManualRefresh ? 'reload' : 'default',
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const msg =
          body && typeof body === 'object' && typeof (body as any).error === 'string'
            ? (body as any).error
            : `Request failed (${res.status})`;
        throw new Error(msg);
      }
      if (!isPayload(body)) {
        throw new Error('The report came back in a shape this page does not understand');
      }
      setReport(body);
      setError(null);
    } catch (err) {
      // No "Try again." in the banner copy: the banner has a Try again BUTTON
      // right beside it, and saying it twice reads like a stutter. The toast
      // keeps the sentence, because a toast has no button.
      const message = toastCopy.failed('load the data health report', err);
      setError(message);
      if (isManualRefresh) {
        toast.error(toastCopy.failed('refresh the data health report', err, 'Try again'));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rulesBySeverity = useMemo(() => {
    const map: Record<RuleSeverity, DataHealthRule[]> = { error: [], warn: [], info: [] };
    for (const rule of report?.rules ?? []) {
      (map[rule.severity] ?? map.info).push(rule);
    }
    // Loudest first inside each group; ties keep report order.
    for (const sev of Object.keys(map) as RuleSeverity[]) {
      map[sev] = map[sev].slice().sort((a, b) => b.count - a.count);
    }
    return map;
  }, [report]);

  const totalIssues = useMemo(
    () => (report?.rules ?? []).reduce((sum, r) => sum + (r.count > 0 ? r.count : 0), 0),
    [report],
  );

  const checkedAt = useMemo(() => {
    if (!report?.generatedAt) return null;
    const d = new Date(report.generatedAt);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  }, [report]);

  // 'recorded' means this deployment has no read-only sweep connection, so the
  // numbers are the last committed sweep. Say which, plainly, either way.
  const isRecorded = report?.source === 'recorded';

  // A failed load must never read as "all clean" (same honesty rule the
  // duplicates page pins): the clean panel only renders with no error showing.
  const allClean =
    !error && report !== null && totalIssues === 0 && report.errors.length === 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shadow-sm shrink-0">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Data Health</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Deterministic checks sweep the whole book and score it. Nothing here changes a
              record — every card just tells you what it found and where to go fix it.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load(true)}
          disabled={isLoading}
          className="h-9"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error — the only voice while it shows */}
      {error && (
        <div
          data-testid="crm-data-health-error"
          role="alert"
          className="p-4 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-300 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <span>{error}</span>
            {report && (
              // The numbers below are the previous check's. Saying so is the
              // difference between stale and wrong.
              <span className="block mt-0.5 text-xs opacity-80">
                Everything below is from the last check that worked
                {checkedAt ? ` (${checkedAt})` : ''}.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={isLoading}
            className="shrink-0 rounded-md border border-red-300 dark:border-red-800 px-2.5 py-1 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading && !report ? (
        <div className="space-y-4" data-testid="crm-data-health-loading">
          <div className="h-36 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : report ? (
        <>
          {/* Score hero */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Data health score
                </div>
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  <span
                    data-testid="crm-data-health-score"
                    className={`text-5xl font-bold tabular-nums ${scoreTone(report.score)}`}
                  >
                    {report.score.toFixed(1)}
                  </span>
                  <span className="text-slate-400 text-lg">/ 100</span>
                  <span
                    data-testid="crm-data-health-book-size"
                    className="text-sm text-slate-500"
                  >
                    across {report.bookSize.toLocaleString()} records
                  </span>
                </div>
              </div>
              <div
                data-testid="crm-data-health-source"
                className="text-xs text-slate-500 space-y-1 sm:text-right"
              >
                {isRecorded ? (
                  <>
                    <div className="font-medium text-slate-600 dark:text-slate-300">
                      Last recorded sweep{report.asOf ? ` · ${report.asOf}` : ''}
                    </div>
                    <div className="max-w-xs">
                      Live sweeps are off here until the read-only sweep connection is
                      configured — these are the numbers from that run, not from just now.
                    </div>
                  </>
                ) : (
                  <>
                    {checkedAt && <div>Checked {checkedAt}</div>}
                    <div>Re-checks at most once a minute</div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                data-testid="crm-data-health-formula-toggle"
                onClick={() => setShowFormula((v) => !v)}
                aria-expanded={showFormula}
                aria-controls="crm-data-health-formula"
                className="inline-flex items-center gap-1 rounded text-sm font-medium text-sky-700 dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showFormula ? 'rotate-180' : ''}`}
                />
                What moves this number
              </button>
              {showFormula && (
                <div
                  id="crm-data-health-formula"
                  data-testid="crm-data-health-formula"
                  className="mt-3 text-sm text-slate-600 dark:text-slate-300 space-y-2 max-w-2xl"
                >
                  <p>The score starts at 100 and problems take points away:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      Each kind of problem owns a fixed budget it can ever take: broken data can
                      cost up to 60 points, meaning problems up to 30, workflow smells up to 10.
                    </li>
                    <li>
                      That budget is split evenly across the checks in each group, so one noisy
                      check can never spend another check&apos;s points.
                    </li>
                    <li>
                      The first few bad records move the number the most — 25 bad records costs a
                      check half its points, and thousands can never cost more than its full
                      share. Every single record you fix nudges the score up.
                    </li>
                    <li>
                      The formula is versioned{report.formulaVersion ? ` (v${report.formulaVersion})` : ''}{' '}
                      and only changes on purpose — if the number moved, the data moved.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Checks that could not run — never silently skipped */}
          {report.errors.length > 0 && (
            <div
              data-testid="crm-data-health-rule-errors"
              className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p>
                  {report.errors.length === 1
                    ? '1 check could not run.'
                    : `${report.errors.length} checks could not run.`}{' '}
                  The score skips what it cannot see, so it may read better than reality.
                </p>
                <ul className="mt-1 space-y-0.5">
                  {report.errors.map((e) => (
                    <li key={e.key} className="break-words">
                      <span className="font-medium" title={e.key}>
                        {e.label || e.key}
                      </span>
                      {e.message ? ` — ${e.message}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* All clean — only ever shown without an error banner */}
          {allClean && (
            <div
              data-testid="crm-data-health-clean"
              className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/40 dark:bg-slate-900/20"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Every check came back clean
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                All {report.rules.length} checks ran across{' '}
                {report.bookSize.toLocaleString()} records and found nothing to fix.
              </p>
            </div>
          )}

          {/* Rule groups */}
          {SECTIONS.map(({ severity, title, sub }) => {
            const rules = rulesBySeverity[severity];
            if (rules.length === 0) return null;
            return (
              <section key={severity} aria-label={title}>
                <div className="mb-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                  </h2>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
                <ul className="space-y-2">
                  {rules.map((rule) => (
                    <RuleCard key={rule.key} rule={rule} />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One check
// ---------------------------------------------------------------------------

function RuleCard({ rule }: { rule: DataHealthRule }) {
  const clean = rule.count === 0;
  const action = clean ? null : actionFor(rule.key);
  return (
    <li
      data-testid={`crm-data-health-rule-${rule.key}`}
      className={`rounded-lg border p-4 ${
        clean
          ? 'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/20'
          : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50'
      }`}
    >
      {/*
        The count sits beside the label and NOTHING else does: at 390px an
        action link on this row (it is `shrink-0`, the label is not) squeezed
        the label to one word per line. The link lives on its own row below.
      */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className={`text-sm font-medium ${
              clean ? 'text-slate-500' : 'text-slate-900 dark:text-white'
            }`}
          >
            {rule.label}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{rule.describe}</p>
          {rule.context && (
            <p className="text-xs text-slate-400 mt-0.5">
              {rule.context.label}: {rule.context.value.toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {clean ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />0
            </span>
          ) : (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${COUNT_BADGE[rule.severity]}`}
            >
              {rule.count.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      {action && (
        <div className="mt-2">
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 rounded text-sm font-medium text-sky-700 dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {action.label}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
      {rule.sampleIds.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer rounded text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            See examples ({rule.sampleIds.length}
            {rule.count > rule.sampleIds.length ? ` of ${rule.count.toLocaleString()}` : ''})
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rule.sampleIds.map((id, i) => (
              <Link
                key={id}
                href={`/crm/r/${encodeURIComponent(id)}`}
                className="rounded border border-slate-200 dark:border-white/10 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Record {i + 1}
              </Link>
            ))}
          </div>
        </details>
      )}
    </li>
  );
}
