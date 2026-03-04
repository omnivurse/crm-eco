import { Users, UserCheck, UserMinus, UserPlus } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import type { WidgetSize } from '@/lib/dashboard/types';
import type { AdvisorContactSummary } from '@/lib/crm/types';

interface AdvisorContactsWidgetProps {
  data: AdvisorContactSummary[] | null;
  size: WidgetSize;
}

export default function AdvisorContactsWidget({
  data,
  size,
}: AdvisorContactsWidgetProps) {
  const advisors = data || [];
  const maxRows = size === 'small' ? 3 : size === 'medium' ? 5 : 10;

  return (
    <WidgetCard
      title="Contacts per Advisor"
      subtitle="Client breakdown by advisor"
      icon={<Users className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500"
      badge={`${advisors.length} advisors`}
    >
      {advisors.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No advisors found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {advisors.slice(0, maxRows).map((advisor) => (
            <div
              key={advisor.advisor_id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-teal-700 dark:text-teal-300">
                  {advisor.advisor_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {advisor.advisor_name}
                </p>
                {advisor.agency_name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {advisor.agency_name}
                    {advisor.state ? ` · ${advisor.state}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Members">
                  <UserCheck className="w-3.5 h-3.5" />
                  {advisor.active_members}
                </span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400" title="Leads">
                  <UserPlus className="w-3.5 h-3.5" />
                  {advisor.leads}
                </span>
                <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500" title="Former">
                  <UserMinus className="w-3.5 h-3.5" />
                  {advisor.inactive_members}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300 min-w-[2rem] text-right">
                  {advisor.total_contacts}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
