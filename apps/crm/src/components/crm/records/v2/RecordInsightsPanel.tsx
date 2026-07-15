'use client';

import { memo, type ReactNode } from 'react';
import {
  Phone,
  Mail,
  Clock,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@crm-eco/ui/lib/utils';

export interface InsightBestTimeSlot {
  channel: 'call' | 'email' | 'sms';
  label: string;
  /** Free-form string like "2:30 PM" or "Tomorrow AM". Null = no data. */
  value: string | null;
  hint?: string;
}

export interface RecordInsightsPanelProps {
  /** Last update ISO date for the pill at the top of the panel. */
  lastUpdatedAt?: string | null;
  bestTime?: InsightBestTimeSlot[];
  /** Quick action buttons merged in from the legacy ActionRail. */
  quickActions?: ReactNode;
  /** Optional info rows (Market, Owner, Created, Updated, Source). */
  infoRows?: Array<{ label: string; value: ReactNode }>;
  /** Slot for future AI suggestions / next best action. */
  extras?: ReactNode;
  className?: string;
}

const CHANNEL_ICONS: Record<InsightBestTimeSlot['channel'], LucideIcon> = {
  call: Phone,
  email: Mail,
  sms: Mail,
};

/**
 * Right-rail insights panel — replaces the legacy ActionRail in V2 and hosts
 * the Zoho-style "Best time to" widget plus the last-update pill, merged
 * quick actions, and record info rows.
 */
export const RecordInsightsPanel = memo(function RecordInsightsPanel({
  lastUpdatedAt,
  bestTime,
  quickActions,
  infoRows,
  extras,
  className,
}: RecordInsightsPanelProps) {
  return (
    <aside
      aria-label="Record insights"
      className={cn(
        'w-64 shrink-0 flex flex-col gap-4 text-sm',
        className,
      )}
    >
      {lastUpdatedAt && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 self-start">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Last update
          </span>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300" suppressHydrationWarning>
            {formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })}
          </span>
        </div>
      )}

      {bestTime && bestTime.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 overflow-hidden">
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r from-teal-50/60 to-transparent dark:from-teal-500/5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-500" />
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                Best time to
              </h4>
            </div>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Today
            </span>
          </header>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {bestTime.map((slot) => {
              const Icon = CHANNEL_ICONS[slot.channel];
              return (
                <li key={slot.channel + slot.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{slot.label}</span>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium truncate text-right',
                      slot.value
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400 dark:text-slate-500',
                    )}
                    title={slot.hint}
                  >
                    {slot.value ?? 'No best time for the day'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {quickActions && (
        <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-3 space-y-2">
          <h4 className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Quick Actions
          </h4>
          <div className="space-y-1.5">{quickActions}</div>
        </section>
      )}

      {infoRows && infoRows.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-3">
          <h4 className="px-1 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Record Info
          </h4>
          <dl className="space-y-1.5">
            {infoRows.map((row, idx) => (
              <div
                key={`${row.label}-${idx}`}
                className="flex items-center justify-between gap-3 px-1 py-1 text-xs"
              >
                <dt className="text-slate-500 dark:text-slate-400 shrink-0">{row.label}</dt>
                <dd className="text-slate-700 dark:text-slate-300 truncate text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {extras}
    </aside>
  );
});
