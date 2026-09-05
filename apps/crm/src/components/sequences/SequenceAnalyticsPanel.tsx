'use client';

/**
 * Sequence analytics. Every number comes from public.sequence_analytics, which
 * aggregates in Postgres — nothing here recomputes rates from raw rows.
 */

import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';

export interface SequenceAnalytics {
  funnel: {
    total: number;
    active: number;
    paused: number;
    completed: number;
    exited: number;
  };
  email: {
    sent: number;
    failed: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
  };
  steps: {
    id: string;
    name: string | null;
    step_order: number;
    step_type: string;
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    skipped: number;
  }[];
  exit_reasons: { reason: string; count: number }[];
}

interface SequenceAnalyticsPanelProps {
  analytics: SequenceAnalytics | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Percentage of a base, rendered as a dash when the base is zero. */
function rate(part: number, whole: number): string {
  if (!whole) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <p
        className={cn(
          'text-2xl font-bold',
          tone === 'good' && 'text-green-600 dark:text-green-400',
          tone === 'warn' && 'text-amber-600 dark:text-amber-400',
          tone === 'default' && 'text-slate-900 dark:text-white',
        )}
      >
        {value}
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function SequenceAnalyticsPanel({
  analytics,
  loading,
  error,
  onRetry,
}: SequenceAnalyticsPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{error}</p>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (!analytics) return null;

  const { funnel, email, steps, exit_reasons: exitReasons } = analytics;

  if (funnel.total === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="mb-2 text-lg font-medium text-slate-900 dark:text-white">
          No data yet
        </h3>
        <p className="mx-auto max-w-md text-slate-500 dark:text-slate-400">
          Numbers appear once contacts are enrolled and the first emails go out.
          Open and click rates depend on tracking being enabled for your sending
          domain.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-900 dark:text-white">
          Enrollments
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Total enrolled" value={funnel.total} />
          <Stat label="Active" value={funnel.active} />
          <Stat label="Paused" value={funnel.paused} />
          <Stat label="Completed" value={funnel.completed} tone="good" />
          <Stat label="Exited early" value={funnel.exited} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-900 dark:text-white">
          Email performance
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Sent" value={email.sent} />
          <Stat
            label="Opened"
            value={rate(email.opened, email.sent)}
            hint={`${email.opened} of ${email.sent}`}
          />
          <Stat
            label="Clicked"
            value={rate(email.clicked, email.sent)}
            hint={`${email.clicked} of ${email.sent}`}
          />
          <Stat
            label="Bounced"
            value={rate(email.bounced, email.sent)}
            hint={`${email.bounced} of ${email.sent}`}
            tone={email.bounced > 0 ? 'warn' : 'default'}
          />
          <Stat
            label="Failed to send"
            value={email.failed}
            tone={email.failed > 0 ? 'warn' : 'default'}
          />
        </div>
      </section>

      {steps.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-slate-900 dark:text-white">
            By step
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                  <th className="px-4 py-2 font-medium">Step</th>
                  <th className="px-4 py-2 text-right font-medium">Sent</th>
                  <th className="px-4 py-2 text-right font-medium">Opened</th>
                  <th className="px-4 py-2 text-right font-medium">Clicked</th>
                  <th className="px-4 py-2 text-right font-medium">Bounced</th>
                  <th className="px-4 py-2 text-right font-medium">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step) => (
                  <tr
                    key={step.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-2">
                      <span className="text-slate-900 dark:text-white">
                        {step.step_order + 1}. {step.name || step.step_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{step.sent}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {step.opened}
                      <span className="ml-1 text-xs text-slate-400">
                        {rate(step.opened, step.sent)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {step.clicked}
                      <span className="ml-1 text-xs text-slate-400">
                        {rate(step.clicked, step.sent)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{step.bounced}</td>
                    {/* Skipped means suppressed — unsubscribed, or the step was
                        a condition that had not been configured. */}
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                      {step.skipped}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {exitReasons.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-slate-900 dark:text-white">
            Why people left
          </h3>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/50">
            {exitReasons.map((row) => (
              <li key={row.reason} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {row.reason}
                </span>
                <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
