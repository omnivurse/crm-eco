import Link from 'next/link';
import {
  Clock,
  AlertTriangle,
  ChevronRight,
  Inbox,
} from 'lucide-react';

/** Personal work queue item for CRM sales agents */
export interface PersonalWorkItem {
  id: string;
  type: 'overdue_task' | 'at_risk_deal';
  title: string;
  subtitle: string;
  createdAt: string;
}

/** Map work queue item type to visual config */
const typeConfig: Record<
  PersonalWorkItem['type'],
  { icon: typeof Clock; label: string; badgeClass: string; href: string }
> = {
  overdue_task: {
    icon: Clock,
    label: 'Task',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    href: '/crm/activities',
  },
  at_risk_deal: {
    icon: AlertTriangle,
    label: 'Deal',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    href: '/crm/pipeline',
  },
};

const priorityDot: Record<PersonalWorkItem['type'], string> = {
  overdue_task: 'bg-amber-400',
  at_risk_deal: 'bg-red-400',
};

/** Format relative time from ISO timestamp */
function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface WorkQueueProps {
  items: PersonalWorkItem[];
}

/**
 * WorkQueue -- Personal action items panel for CRM sales agents.
 * Shows only the current user's overdue tasks and at-risk deals.
 */
export function WorkQueue({ items }: WorkQueueProps) {
  // Sort: at-risk deals first, then overdue tasks
  const sorted = [...items].sort((a, b) => {
    const order: Record<PersonalWorkItem['type'], number> = { at_risk_deal: 1, overdue_task: 2 };
    return (order[a.type] ?? 99) - (order[b.type] ?? 99);
  });

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
            <Inbox className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              My Action Items
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sorted.length} item{sorted.length !== 1 ? 's' : ''} requiring attention
            </p>
          </div>
        </div>
        <Link
          href="/crm/workqueue"
          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
        >
          View All
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Queue items */}
      {sorted.length > 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((item) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;

            return (
              <Link
                key={item.id}
                href={config.href}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
              >
                {/* Priority dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[item.type]}`} />

                {/* Type badge */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${config.badgeClass}`}>
                  <Icon className="w-3 h-3" />
                  {config.label}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    {item.subtitle}
                  </p>
                </div>

                {/* Time */}
                <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                  {timeAgo(item.createdAt)}
                </span>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
          <Inbox className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm font-medium">All clear</p>
          <p className="text-xs">No action items requiring attention</p>
        </div>
      )}
    </div>
  );
}
