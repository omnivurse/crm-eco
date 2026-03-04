import { TrendingUp, Users } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import type { WidgetSize } from '@/lib/dashboard/types';
import type { AdvisorContactSummary } from '@/lib/crm/types';

interface AdvisorGrowthWidgetProps {
  data: AdvisorContactSummary[] | null;
  size: WidgetSize;
}

export default function AdvisorGrowthWidget({
  data,
  size,
}: AdvisorGrowthWidgetProps) {
  const advisors = data || [];
  const totalThisMonth = advisors.reduce((sum, a) => sum + a.contacts_this_month, 0);
  const totalMembers = advisors.reduce((sum, a) => sum + a.active_members, 0);
  const totalLeads = advisors.reduce((sum, a) => sum + a.leads, 0);
  const totalContacts = advisors.reduce((sum, a) => sum + a.total_contacts, 0);

  // Sort by this month's growth for the list
  const sorted = [...advisors]
    .filter((a) => a.contacts_this_month > 0)
    .sort((a, b) => b.contacts_this_month - a.contacts_this_month);

  const maxRows = size === 'small' ? 3 : size === 'medium' ? 5 : 8;

  return (
    <WidgetCard
      title="Advisor Growth"
      subtitle="Monthly contacts & active members"
      icon={<TrendingUp className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500"
      badge={`+${totalThisMonth} this month`}
      badgeColor="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
    >
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {totalContacts.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Contacts</p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {totalMembers.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Active Members</p>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
            {totalLeads.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Leads</p>
        </div>
      </div>

      {/* Top growers this month */}
      {sorted.length === 0 ? (
        <div className="text-center py-4 text-slate-500 dark:text-slate-400">
          <p className="text-sm">No new contacts this month</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Top growers this month
          </p>
          {sorted.slice(0, maxRows).map((advisor) => {
            const pct = totalThisMonth > 0
              ? Math.round((advisor.contacts_this_month / totalThisMonth) * 100)
              : 0;
            return (
              <div
                key={advisor.advisor_id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {advisor.advisor_name}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400 shrink-0">
                  +{advisor.contacts_this_month}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
