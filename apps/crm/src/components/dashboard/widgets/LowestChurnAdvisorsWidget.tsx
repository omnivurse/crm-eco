import { Shield } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import type { WidgetSize } from '@/lib/dashboard/types';

interface ChurnAdvisor {
  advisor_id: string;
  advisor_name: string;
  churn_rate: number;
  total_members: number;
  churned_members: number;
}

interface LowestChurnAdvisorsWidgetProps {
  data: ChurnAdvisor[] | null;
  size: WidgetSize;
}

function getChurnColor(rate: number) {
  if (rate < 5) return 'bg-emerald-500';
  if (rate < 15) return 'bg-amber-500';
  return 'bg-red-500';
}

function getChurnLabel(rate: number) {
  if (rate < 5) return 'text-emerald-600 dark:text-emerald-400';
  if (rate < 15) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export default function LowestChurnAdvisorsWidget({
  data,
  size,
}: LowestChurnAdvisorsWidgetProps) {
  const advisors = data || [];
  const maxRows = size === 'small' ? 3 : size === 'medium' ? 5 : 10;

  return (
    <WidgetCard
      title="Lowest Churn Advisors"
      subtitle="Best member retention rates"
      icon={<Shield className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500"
      badge={`${advisors.length} advisors`}
    >
      {advisors.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No churn data available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {advisors.slice(0, maxRows).map((advisor) => (
            <div
              key={advisor.advisor_id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              {/* Churn dot */}
              <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center shrink-0">
                <div className={`w-3 h-3 rounded-full ${getChurnColor(advisor.churn_rate)}`} />
              </div>

              {/* Name + member count */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {advisor.advisor_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {advisor.total_members} members · {advisor.churned_members} churned
                </p>
              </div>

              {/* Churn rate */}
              <span className={`text-sm font-bold shrink-0 ${getChurnLabel(advisor.churn_rate)}`}>
                {advisor.churn_rate.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
