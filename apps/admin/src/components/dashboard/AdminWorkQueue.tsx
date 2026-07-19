import Link from 'next/link';
import {
  CreditCard,
  Cpu,
  ClipboardText,
  CurrencyDollar,
  Clock,
  CaretRight,
  Tray,
} from '@phosphor-icons/react/dist/ssr';
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
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    href: '/settings/automation',
  },
  enrollment_review: {
    icon: ClipboardText,
    label: 'Enrollment',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    href: '/enrollments',
  },
  commission_payout: {
    icon: CurrencyDollar,
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
    <div className="adm-bezel h-full">
      <div className="adm-bezel-inner flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--adm-hairline)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[rgba(11,109,133,0.06)] p-2 dark:bg-white/5">
              <Tray weight="light" className="h-4 w-4 text-[var(--adm-muted)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--adm-ink)]">
                Action Items
              </h3>
              <p className="text-xs text-[var(--adm-muted)]">
                {items.length} item{items.length !== 1 ? 's' : ''} requiring attention
              </p>
            </div>
          </div>
        </div>

        {/* Queue items */}
        {items.length > 0 ? (
          <div className="flex-1 divide-y divide-[var(--adm-hairline)]">
            {items.map((item) => {
              const config = typeConfig[item.type];
              const Icon = config.icon;

              return (
                <Link
                  key={item.id}
                  href={config.href}
                  className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[rgba(11,109,133,0.05)] dark:hover:bg-white/5"
                >
                  {/* Priority dot */}
                  <div className={`h-2 w-2 shrink-0 rounded-full ${priorityDot[item.priority] || 'bg-slate-400'}`} />

                  {/* Type badge */}
                  <div className={`flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${config.badgeClass}`}>
                    <Icon weight="light" className="h-3 w-3" />
                    {config.label}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--adm-ink)]">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-[var(--adm-muted)]">
                      {item.subtitle}
                    </p>
                  </div>

                  {/* Time */}
                  <span className="shrink-0 whitespace-nowrap text-xs text-[var(--adm-muted)]">
                    {timeAgo(item.createdAt)}
                  </span>

                  {/* Arrow */}
                  <CaretRight weight="light" className="h-4 w-4 shrink-0 text-[var(--adm-muted)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--adm-ink)]" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-[var(--adm-muted)]">
            <Tray weight="light" className="mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs">No action items requiring attention</p>
          </div>
        )}
      </div>
    </div>
  );
}
