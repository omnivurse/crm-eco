import Link from 'next/link';
import { Clock, ArrowUpRight, Sparkles } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { PeopleQueue, PeopleQueueItem } from '@/lib/dashboard/people-queue-types';
import { MarketTypeBadge } from '@/components/shared/crm-lane-badges';
import { StatusPill, AvatarTile, ACTION_ICONS, QuickActions } from './desk-primitives';
import {
  NOT_ON_FILE,
  formatCityState,
  formatDateWithYear,
  formatRelativeDays,
  formatShortDate,
  hasValue,
  orNotOnFile,
} from './command-desk-format';

interface NextUpRailProps {
  item: PeopleQueueItem | null;
  recentlyViewed: PeopleQueue['recentlyViewed'];
  className?: string;
}

function Fact({ label, value, hint }: { label: string; value: string | null; hint?: string | null }) {
  const present = hasValue(value);
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={cn('truncate text-xs', present ? 'text-foreground' : 'italic text-muted-foreground/70')}
        title={present ? (value ?? undefined) : NOT_ON_FILE}
      >
        {present ? value : NOT_ON_FILE}
        {present && hint ? <span className="ml-1 text-muted-foreground">({hint})</span> : null}
      </dd>
    </div>
  );
}

function NextUpCard({ item }: { item: PeopleQueueItem }) {
  const Icon = ACTION_ICONS[item.nextAction.kind] ?? ArrowUpRight;
  const effective = item.effectiveDate ? formatShortDate(item.effectiveDate) : null;
  const effectiveHint = item.effectiveDate ? formatRelativeDays(item.effectiveDate) : null;
  const dob = item.dateOfBirth ? formatDateWithYear(item.dateOfBirth) : null;

  return (
    <div className="p-3">
      <div className="flex items-start gap-2.5">
        <AvatarTile name={item.name} initials={item.initials} marketType={item.marketType} size="md" />
        <div className="min-w-0 flex-1">
          <Link
            href={item.href}
            title={item.name}
            className="block truncate text-sm font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {item.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <StatusPill status={item.status} className="max-w-[11rem]" />
            {item.marketType ? <MarketTypeBadge marketType={item.marketType} size="sm" short /> : null}
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground" title={item.reasonLabel}>
            {item.reasonLabel}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        <Fact label="City" value={formatCityState(item.city, item.state)} />
        <Fact label="DOB" value={dob} />
        <Fact label="Plan" value={item.plan} />
        <Fact label="Enrolled by" value={item.enrolledBy} />
        <Fact label="Referring member" value={item.referringMember} />
        <Fact label="Member ID" value={item.memberId} />
        <Fact label="Effective date" value={effective} hint={effectiveHint} />
      </dl>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={item.nextAction.href}
          className={cn(
            'inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground',
            'hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{item.nextAction.label}</span>
        </Link>
        <QuickActions item={item} showOpen={false} />
      </div>
    </div>
  );
}

function NextUpEmpty() {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
      <Sparkles className="h-5 w-5 text-muted-foreground/60" aria-hidden />
      <p className="text-xs font-medium text-foreground">Queue is clear</p>
      <p className="text-[11px] text-muted-foreground">Search for a member above or pick up a recent record below.</p>
    </div>
  );
}

/** Right rail: the top queue item as a member brief + recently viewed. */
export function NextUpRail({ item, recentlyViewed, className }: NextUpRailProps) {
  const recent = recentlyViewed.slice(0, 6);
  return (
    <aside aria-label="Next up" className={cn('flex min-w-0 flex-col gap-3', className)}>
      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next up</h2>
          {item ? (
            <Link
              href={item.href}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Open
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          ) : null}
        </header>
        {item ? <NextUpCard item={item} /> : <NextUpEmpty />}
      </section>

      <section aria-label="Recently viewed" className="rounded-lg border border-border bg-card">
        <header className="flex items-center gap-1.5 border-b border-border px-3 py-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recently viewed</h2>
        </header>
        {recent.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-muted-foreground">
            Records you open will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.recordId}>
                <Link
                  href={r.href}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <AvatarTile name={r.name} initials={r.initials} marketType={null} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground" title={r.name}>{r.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[r.status, r.city].filter(Boolean).join(' · ') || orNotOnFile(null)}
                    </p>
                  </div>
                  <StatusPill status={r.status} className="hidden max-w-[7rem] xl:inline-flex" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
