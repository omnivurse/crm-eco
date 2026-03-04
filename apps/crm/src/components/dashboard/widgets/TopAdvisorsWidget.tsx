import { Trophy, Medal } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import type { WidgetSize } from '@/lib/dashboard/types';

interface TopAdvisor {
  advisor_id: string;
  advisor_name: string;
  metric_value: number;
  metric_label: string;
}

interface TopAdvisorsWidgetProps {
  data: TopAdvisor[] | null;
  size: WidgetSize;
}

const MEDAL_COLORS = [
  'text-amber-500',   // gold
  'text-slate-400',   // silver
  'text-orange-600',  // bronze
];

export default function TopAdvisorsWidget({
  data,
  size,
}: TopAdvisorsWidgetProps) {
  const advisors = data || [];
  const maxRows = size === 'small' ? 3 : size === 'medium' ? 5 : 10;

  return (
    <WidgetCard
      title="Top Advisors"
      subtitle="Ranked by enrollment count"
      icon={<Trophy className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500"
      badge={`${advisors.length} advisors`}
    >
      {advisors.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Trophy className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No advisor data available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {advisors.slice(0, maxRows).map((advisor, index) => (
            <div
              key={advisor.advisor_id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              {/* Rank */}
              <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center shrink-0">
                {index < 3 ? (
                  <Medal className={`w-5 h-5 ${MEDAL_COLORS[index]}`} />
                ) : (
                  <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {advisor.advisor_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {advisor.metric_label}
                </p>
              </div>

              {/* Value */}
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">
                {advisor.metric_value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
