import Link from 'next/link';
import { Sun, Clock, Hourglass, CalendarClock, type LucideIcon } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { PeopleQueueCounts } from '@/lib/dashboard/people-queue-types';
import { pendingContactsHref } from './command-desk-format';

interface DeskChip {
  id: string;
  label: string;
  count: number;
  href: string;
  icon: LucideIcon;
  emphasis: 'default' | 'warning' | 'critical';
}

const CHIP_CLASSES: Record<DeskChip['emphasis'], string> = {
  // Mirrors DashboardWorkflowChips emphasis palette so the two chip rows read as one system.
  default:
    'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5',
  warning:
    'border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:border-amber-300',
  critical:
    'border-red-200 dark:border-red-500/30 bg-red-50/80 dark:bg-red-500/10 text-red-800 dark:text-red-200 hover:border-red-300',
};

const COUNT_CLASSES: Record<DeskChip['emphasis'], string> = {
  default: 'bg-muted text-foreground',
  warning: 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
  critical: 'bg-red-500/15 text-red-900 dark:text-red-100',
};

export function buildDeskChips(counts: PeopleQueueCounts): DeskChip[] {
  return [
    {
      id: 'tasks-today',
      label: 'Tasks today',
      count: counts.tasksToday,
      href: '/crm/tasks',
      icon: Sun,
      emphasis: 'default',
    },
    {
      id: 'overdue',
      label: 'Overdue',
      count: counts.overdue,
      href: '/crm/workqueue',
      icon: Clock,
      emphasis: counts.overdue >= 5 ? 'critical' : counts.overdue > 0 ? 'warning' : 'default',
    },
    {
      id: 'pending',
      label: 'Pending members',
      count: counts.pending,
      href: pendingContactsHref(),
      icon: Hourglass,
      emphasis: 'default',
    },
    {
      id: 'starting-soon',
      label: 'Starting soon',
      count: counts.startingSoon,
      href: '/crm/modules/contacts',
      icon: CalendarClock,
      emphasis: 'default',
    },
  ];
}

/** Four count chips under the command bar — each is a real link. */
export function DeskChips({ counts, className }: { counts: PeopleQueueCounts; className?: string }) {
  const chips = buildDeskChips(counts);
  return (
    <ul
      aria-label="Today at a glance"
      className={cn('flex flex-wrap gap-2', className)}
    >
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <li key={chip.id} className="shrink-0">
            <Link
              href={chip.href}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border pl-2.5 pr-1.5 py-1 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                CHIP_CLASSES[chip.emphasis],
              )}
              aria-label={`${chip.label}: ${chip.count}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span>{chip.label}</span>
              <span
                className={cn(
                  'ml-0.5 inline-flex min-w-[1.5rem] justify-center rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums',
                  COUNT_CLASSES[chip.emphasis],
                )}
              >
                {chip.count}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
