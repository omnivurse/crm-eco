'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Inbox,
  Phone,
  UserPlus,
  UserCheck,
  DollarSign,
  AlertTriangle,
  Clock,
  Users,
  BarChart3,
  Mail,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmRole } from '@/lib/crm/types';

export interface DashboardWorkflowChip {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Highlight when stats suggest immediate action */
  emphasis?: 'default' | 'warning' | 'critical';
}

interface DashboardWorkflowChipsProps {
  crmRole?: CrmRole | null;
  todaysTaskCount?: number;
  overdueCount?: number;
  atRiskCount?: number;
  className?: string;
}

function buildWorkflowChips(
  crmRole: CrmRole | null | undefined,
  stats: { todaysTaskCount: number; overdueCount: number; atRiskCount: number },
): DashboardWorkflowChip[] {
  const chips: DashboardWorkflowChip[] = [];

  if (stats.overdueCount > 0) {
    chips.push({
      id: 'overdue',
      label: `${stats.overdueCount} overdue`,
      href: '/crm/workqueue',
      icon: Clock,
      emphasis: stats.overdueCount >= 5 ? 'critical' : 'warning',
    });
  }

  if (stats.atRiskCount > 0) {
    chips.push({
      id: 'at-risk',
      label: `${stats.atRiskCount} at-risk deal${stats.atRiskCount > 1 ? 's' : ''}`,
      href: '/crm/pipeline',
      icon: AlertTriangle,
      emphasis: stats.atRiskCount >= 3 ? 'critical' : 'warning',
    });
  }

  chips.push(
    {
      id: 'workqueue',
      label: 'Open Workqueue',
      href: '/crm/workqueue',
      icon: Inbox,
      emphasis: stats.todaysTaskCount > 0 ? 'default' : undefined,
    },
    {
      id: 'log-call',
      label: 'Log Call',
      href: '/crm/activities?type=call',
      icon: Phone,
    },
    {
      id: 'new-contact',
      label: 'Add Member',
      href: '/crm/modules/contacts',
      icon: UserPlus,
    },
  );

  if (crmRole === 'crm_agent' || crmRole === 'crm_manager' || !crmRole) {
    chips.push(
      {
        id: 'review-leads',
        label: 'Review Leads',
        href: '/crm/modules/leads',
        icon: UserCheck,
      },
      {
        id: 'pipeline',
        label: 'Pipeline',
        href: '/crm/pipeline',
        icon: DollarSign,
      },
    );
  }

  if (crmRole === 'crm_manager' || crmRole === 'crm_admin') {
    chips.push(
      {
        id: 'advisors',
        label: 'Advisors',
        href: '/crm/analytics?tab=advisors',
        icon: Users,
      },
      {
        id: 'reports',
        label: 'Reports',
        href: '/crm/reports',
        icon: BarChart3,
      },
    );
  }

  if (crmRole !== 'crm_viewer') {
    chips.push({
      id: 'email',
      label: 'Send Email',
      href: '/crm/communications/new',
      icon: Mail,
    });
  }

  return chips;
}

const emphasisClasses: Record<
  NonNullable<DashboardWorkflowChip['emphasis']>,
  string
> = {
  default:
    'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 hover:border-teal-300 dark:hover:border-teal-500/40',
  warning:
    'border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:border-amber-300',
  critical:
    'border-red-200 dark:border-red-500/30 bg-red-50/80 dark:bg-red-500/10 text-red-800 dark:text-red-200 hover:border-red-300',
};

/**
 * Suggested workflow shortcuts under the dashboard command bar.
 */
export function DashboardWorkflowChips({
  crmRole,
  todaysTaskCount = 0,
  overdueCount = 0,
  atRiskCount = 0,
  className,
}: DashboardWorkflowChipsProps) {
  const chips = useMemo(
    () =>
      buildWorkflowChips(crmRole, {
        todaysTaskCount,
        overdueCount,
        atRiskCount,
      }),
    [crmRole, todaysTaskCount, overdueCount, atRiskCount],
  );

  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]',
        className,
      )}
      role="list"
      aria-label="Suggested workflows"
    >
      {chips.map((chip) => {
        const Icon = chip.icon;
        const emphasis = chip.emphasis ?? 'default';
        return (
          <Link
            key={chip.id}
            href={chip.href}
            role="listitem"
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5',
              'text-xs font-medium transition-colors',
              emphasisClasses[emphasis],
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}
