import type { CrmProfile } from '@/lib/crm/types';
import type { PeopleQueue } from '@/lib/dashboard/people-queue-types';
import { DeskGreeting } from './DeskGreeting';
import { DeskChips } from './DeskChips';
import { PeopleQueueTable } from './PeopleQueueTable';
import { NextUpRail } from './NextUpRail';

interface CommandDeskProps {
  profile: Pick<CrmProfile, 'full_name' | 'crm_role'>;
  queue: PeopleQueue;
}

/**
 * Dashboard "command desk": greeting + search, four count chips, then the
 * dense today-queue of people with a "Next up" member brief on the right.
 * Server component — only DeskGreeting is client (time-of-day after mount).
 */
export function CommandDesk({ profile, queue }: CommandDeskProps) {
  const nextUp = queue.items[0] ?? null;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <DeskGreeting fullName={profile.full_name} />
        <DeskChips counts={queue.counts} />
      </div>

      {/* Rail beside the table only when there is real room (≥ xl); on a
          laptop with the sidebar open the table takes the full width and the
          rail stacks under it. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <PeopleQueueTable items={queue.items} counts={queue.counts} degraded={queue.degraded} />
        <NextUpRail item={nextUp} recentlyViewed={queue.recentlyViewed} />
      </div>
    </div>
  );
}
