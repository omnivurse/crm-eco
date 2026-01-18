'use client';

import { Sparkles, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmAuditLog } from '@/lib/crm/types';

interface ActivityItemProps {
  activity: CrmAuditLog;
}

const actionConfig: Record<
  string,
  { color: string; bgColor: string; icon: React.ElementType }
> = {
  create: { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', icon: Sparkles },
  update: { color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: Activity },
  delete: { color: 'text-red-600', bgColor: 'bg-red-500/10', icon: AlertCircle },
};

export function ActivityItem({ activity }: ActivityItemProps) {
  const config = actionConfig[activity.action] || {
    color: 'text-slate-600',
    bgColor: 'bg-slate-500/10',
    icon: Activity,
  };
  const Icon = config.icon;

  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200">
      <div className={cn('p-2.5 rounded-xl', config.bgColor)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-white capitalize">
            {activity.action}
          </span>{' '}
          {activity.entity}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {new Date(activity.created_at).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <span
        className={cn(
          'px-3 py-1.5 text-xs font-semibold rounded-full capitalize',
          config.bgColor,
          config.color
        )}
      >
        {activity.action}
      </span>
    </div>
  );
}
