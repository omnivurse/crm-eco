'use client';

import Link from 'next/link';
import {
  UserPlus,
  Users,
  DollarSign,
  ClipboardCheck,
  ChevronRight,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

export interface JourneyStageCounts {
  leads: number;
  contacts: number;
  deals: number;
  enrollments: number;
  /** Optional accent for deals stage */
  atRiskDeals?: number;
}

interface StageDef {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  countKey: keyof JourneyStageCounts;
}

const STAGES: StageDef[] = [
  {
    id: 'leads',
    label: 'Leads',
    shortLabel: 'Leads',
    href: '/crm/modules/leads',
    icon: UserPlus,
    countKey: 'leads',
  },
  {
    id: 'contacts',
    label: 'Contacts',
    shortLabel: 'Contacts',
    href: '/crm/modules/contacts',
    icon: Users,
    countKey: 'contacts',
  },
  {
    id: 'deals',
    label: 'Pipeline',
    shortLabel: 'Deals',
    href: '/crm/pipeline',
    icon: DollarSign,
    countKey: 'deals',
  },
  {
    id: 'enrollments',
    label: 'Enrollment',
    shortLabel: 'Enroll',
    href: '/crm/enrollment',
    icon: ClipboardCheck,
    countKey: 'enrollments',
  },
];

interface SalesJourneyStripProps {
  counts: JourneyStageCounts;
  className?: string;
}

/**
 * Horizontal Lead → Contact → Deal → Enroll journey with live counts.
 * One composition (not a card dashboard) — click-through to each stage.
 */
export function SalesJourneyStrip({ counts, className }: SalesJourneyStripProps) {
  const total =
    counts.leads + counts.contacts + counts.deals + counts.enrollments;
  const isEmpty = total === 0;

  return (
    <section
      aria-label="Sales journey"
      className={cn(
        'rounded-xl border border-border bg-card p-3 md:p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2 mb-3 px-0.5">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sales journey
          </h2>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5 hidden sm:block">
            Lead → Contact → Deal → Enroll
          </p>
        </div>
        {isEmpty ? (
          <Link
            href="/crm/modules/leads?new=true"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add your first lead
          </Link>
        ) : null}
      </div>

      <ol className="flex items-stretch gap-0 overflow-x-auto">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const count = counts[stage.countKey] ?? 0;
          const showAtRisk =
            stage.id === 'deals' && (counts.atRiskDeals ?? 0) > 0;

          return (
            <li key={stage.id} className="flex items-center min-w-0 flex-1">
              <Link
                href={stage.href}
                className={cn(
                  'crm-motion-safe group flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-3',
                  'border border-transparent hover:border-border hover:bg-muted/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'min-w-[4.5rem]',
                )}
              >
                <span
                  className={cn(
                    'crm-motion-safe flex h-9 w-9 items-center justify-center rounded-full',
                    'bg-primary/10 text-primary',
                    'group-hover:bg-primary/15',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-lg font-bold tabular-nums text-foreground leading-none">
                  {count}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  <span className="sm:hidden">{stage.shortLabel}</span>
                  <span className="hidden sm:inline">{stage.label}</span>
                </span>
                {showAtRisk ? (
                  <span className="text-[10px] font-medium text-destructive">
                    {counts.atRiskDeals} at risk
                  </span>
                ) : null}
              </Link>

              {index < STAGES.length - 1 ? (
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground/40 mx-0.5 hidden xs:block sm:block"
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
