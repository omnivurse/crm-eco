import Link from 'next/link';
import { ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { PeopleQueueItem, PeopleQueueCounts } from '@/lib/dashboard/people-queue-types';
import { StatusPill, AvatarTile, NextActionLink, QuickActions, deskHref } from './desk-primitives';
import { countLabel, formatCityState, pendingContactsHref } from './command-desk-format';

interface PeopleQueueTableProps {
  items: PeopleQueueItem[];
  counts: PeopleQueueCounts;
  degraded?: boolean;
  className?: string;
}

const TH =
  'px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap';
const TD = 'px-3 py-1.5 align-middle';
const MUTED_BLANK = <span className="italic text-muted-foreground/70">—</span>;

function Cell({ value, title }: { value: string | null; title?: string }) {
  if (!value) return MUTED_BLANK;
  return (
    <span className="block min-w-0 truncate" title={title ?? value}>
      {value}
    </span>
  );
}

function EmptyQueue({ counts, degraded }: { counts: PeopleQueueCounts; degraded: boolean }) {
  if (degraded) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium text-foreground">We couldn&apos;t load today&apos;s queue</p>
        <p className="text-xs text-muted-foreground">
          Try refreshing, or{' '}
          <Link href="/crm/workqueue" className="font-medium text-primary hover:underline">
            open the workqueue
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <Inbox className="h-6 w-6 text-muted-foreground/60" aria-hidden />
      <p className="text-sm font-medium text-foreground">Nothing needs you right now</p>
      {counts.pending > 0 ? (
        <p className="text-xs text-muted-foreground">
          {countLabel(counts.pending, 'pending member is', 'pending members are')} waiting on activation.{' '}
          <Link
            href={pendingContactsHref(counts.pendingStatusValues)}
            className="font-medium text-primary hover:underline"
          >
            Review pending
          </Link>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No overdue tasks, no pending members, nothing starting soon.{' '}
          <Link href="/crm/workqueue" className="font-medium text-primary hover:underline">
            Browse the workqueue
          </Link>
        </p>
      )}
    </div>
  );
}

/**
 * Dense "today queue of people" — table on md+, compact cards below.
 * Server component: no state, everything is a link.
 */
export function PeopleQueueTable({ items, counts, degraded = false, className }: PeopleQueueTableProps) {
  return (
    <section
      aria-label="Today's queue"
      className={cn('flex min-w-0 flex-col rounded-lg border border-border bg-card', className)}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-sm font-semibold text-foreground">Today&apos;s queue</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            · {countLabel(items.length, 'person', 'people')}
          </span>
          {degraded ? (
            <span className="hidden text-[11px] text-muted-foreground sm:inline" title="One or more sources failed to load; the queue may be partial.">
              · Some sources didn&apos;t load
            </span>
          ) : null}
        </div>
        <Link
          href="/crm/workqueue"
          className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open workqueue
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>

      {degraded ? (
        <p className="border-b border-border px-3 py-1 text-[11px] text-muted-foreground sm:hidden">
          Some sources didn&apos;t load — the queue may be partial.
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyQueue counts={counts} degraded={degraded} />
      ) : (
        <>
          {/* md+: dense table. Own scroll container so the page never scrolls sideways. */}
          <div className="hidden md:block max-h-[560px] overflow-auto [scrollbar-width:thin]">
            {/* table-fixed + percentage columns: the row always fits the
                container (every cell truncates with a title tooltip), so the
                only horizontal scroll is the ≥720px floor on narrow tablets —
                never a hidden "Next action" column on a laptop. */}
            <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                <tr>
                  <th scope="col" className={cn(TH, 'w-[27%]')}>Person</th>
                  <th scope="col" className={cn(TH, 'w-[12%]')}>Status</th>
                  <th scope="col" className={cn(TH, 'w-[12%]')}>City</th>
                  <th scope="col" className={cn(TH, 'w-[15%]')}>Plan</th>
                  <th scope="col" className={cn(TH, 'w-[13%]')}>Enrolled by</th>
                  <th scope="col" className={cn(TH, 'w-[21%]')}>Next action</th>
                  {/* Fixed px so the four icon buttons never clip (table-fixed
                      allocates px columns first, then splits the % ones). */}
                  <th scope="col" className={cn(TH, 'w-[7.75rem] text-right')}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.recordId} className="hover:bg-muted/40">
                    <td className={TD}>
                      <div className="flex min-w-0 items-center gap-2">
                        <AvatarTile name={item.name} initials={item.initials} marketType={item.marketType} />
                        <div className="min-w-0">
                          <Link
                            href={deskHref(item.href)}
                            title={item.name}
                            className="block truncate font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                          >
                            {item.name}
                          </Link>
                          <p className="truncate text-[11px] text-muted-foreground" title={item.reasonLabel}>
                            {item.reasonLabel}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={cn(TD, 'min-w-0')}>
                      <StatusPill status={item.status} />
                    </td>
                    <td className={cn(TD, 'text-foreground/90')}>
                      <Cell value={formatCityState(item.city, item.state)} />
                    </td>
                    <td className={cn(TD, 'text-foreground/90')}>
                      <Cell value={item.plan} />
                    </td>
                    <td className={cn(TD, 'text-foreground/90')}>
                      <Cell value={item.enrolledBy} />
                    </td>
                    <td className={cn(TD, 'min-w-0')}>
                      <NextActionLink action={item.nextAction} />
                    </td>
                    <td className={cn(TD, 'text-right whitespace-nowrap')}>
                      <QuickActions item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* < md: compact cards */}
          <ul className="divide-y divide-border md:hidden">
            {items.map((item) => {
              const cityPlan = [formatCityState(item.city, item.state), item.plan].filter(Boolean).join(' · ');
              return (
                <li key={item.recordId} className="px-3 py-2">
                  <div className="flex items-start gap-2">
                    <AvatarTile name={item.name} initials={item.initials} marketType={item.marketType} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={deskHref(item.href)}
                          className="truncate text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >
                          {item.name}
                        </Link>
                        <StatusPill status={item.status} className="max-w-[45%]" />
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{item.reasonLabel}</p>
                      {cityPlan ? (
                        <p className="truncate text-xs text-foreground/80" title={cityPlan}>{cityPlan}</p>
                      ) : null}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <NextActionLink action={item.nextAction} compact />
                        <QuickActions item={item} showOpen={false} />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
