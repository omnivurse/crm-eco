import Link from 'next/link';
import {
  CreditCard,
  Cpu,
  FileCheck,
  DollarSign,
  Clock,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import type { AdminWorkQueueItem } from '@/lib/admin-console-queries';

/** Map work queue item type to visual config */
const typeConfig: Record<
  AdminWorkQueueItem['type'],
  { icon: typeof CreditCard; label: string; badgeClass: string; href: string }
> = {
  billing_failure: {
    icon: CreditCard,
    label: 'Billing',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    href: '/billing',
  },
  failed_job: {
    icon: Cpu,
    label: 'System',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    href: '/settings/automation',
  },
  enrollment_review: {
    icon: FileCheck,
    label: 'Enrollment',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    href: '/enrollments',
  },
  commission_payout: {
    icon: DollarSign,
    label: 'Commission',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    href: '/commissions',
  },
  overdue_task: {
    icon: Clock,
    label: 'Task',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    href: '/ops/jobs',
  },
};

const priorityDot: Record<number, string> = {
  1: 'bg-red-400',
  2: 'bg-amber-400',
  3: 'bg-slate-400',
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

interface AdminWorkQueueProps {
  items: AdminWorkQueueItem[];
}

/**
 * AdminWorkQueue -- Org-wide prioritized action items panel for admin dashboard.
 * Sorted by urgency: billing > system > enrollments > commissions > tasks.
 */
export function AdminWorkQueue({ items }: AdminWorkQueueProps) {
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
              Action Items
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {items.length} item{items.length !== 1 ? 's' : ''} requiring attention
            </p>
          </div>
        </div>
      </div>

      {/* Queue items */}
      {items.length > 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;

            return (
              <Link
                key={item.id}
                href={config.href}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
              >
                {/* Priority dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[item.priority] || 'bg-slate-400'}`} />

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
