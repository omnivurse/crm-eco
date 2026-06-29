'use client';

import { RecentlyViewedRail } from '@/components/crm/records/v2/RecentlyViewedRail';

/**
 * Post-login "pick up where you left off" strip — sits under the dashboard
 * command bar. Renders nothing until the user has recent record history.
 */
export function DashboardPickUpSection() {
  return (
    <section aria-label="Pick up where you left off" className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Pick up where you left off
        </h2>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
          Jump back into recent records
        </p>
      </div>
      <RecentlyViewedRail variant="inline" limit={6} />
    </section>
  );
}
