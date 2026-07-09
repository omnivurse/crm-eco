import Link from 'next/link';
import {
  Clock,
  AlertTriangle,
  ChevronRight,
  Inbox,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

export interface TodayQueueItem {
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
  kind: 'task' | 'overdue' | 'at_risk';
}

interface TodayQueuePreviewProps {
  items: TodayQueueItem[];
  overdueCount?: number;
  todaysTaskCount?: number;
  className?: string;
}

const kindConfig = {
  task: {
    icon: Clock,
    badge: 'Task',
    badgeClass:
      'bg-primary/10 text-primary border-primary/20',
  },
  overdue: {
    icon: AlertTriangle,
    badge: 'Overdue',
    badgeClass:
      'bg-destructive/10 text-destructive border-destructive/20',
  },
  at_risk: {
    icon: AlertTriangle,
    badge: 'At risk',
    badgeClass:
      'bg-destructive/10 text-destructive border-destructive/20',
  },
} as const;

/**
 * Compact 3–5 item “today” preview linking to the full workqueue.
 * Server-friendly — no client fetch; parent passes items.
 */
export function TodayQueuePreview({
  items,
  overdueCount = 0,
  todaysTaskCount = 0,
  className,
}: TodayQueuePreviewProps) {
  const preview = items.slice(0, 5);
  const attention = overdueCount + todaysTaskCount;

  return (
    <section
      aria-label="Today's queue"
      className={cn(
        'rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Today&apos;s queue
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {attention > 0
                ? `${todaysTaskCount} due today${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`
                : 'Nothing urgent — you are clear'}
            </p>
          </div>
        </div>
        <Link
          href="/crm/workqueue"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0"
        >
          Open workqueue
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {preview.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500/80" />
          <p className="text-sm font-medium text-foreground">All caught up</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            No tasks due today. Jump into the workqueue anytime for approvals and follow-ups.
          </p>
          <Link
            href="/crm/workqueue"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Inbox className="h-3.5 w-3.5" />
            Browse workqueue
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {preview.map((item) => {
            const config = kindConfig[item.kind];
            const Icon = config.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="crm-motion-safe flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium shrink-0',
                      config.badgeClass,
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {config.badge}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.title}
                    </p>
                    {item.subtitle ? (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.subtitle}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
