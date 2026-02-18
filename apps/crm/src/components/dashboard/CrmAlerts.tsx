import Link from 'next/link';
import { AlertTriangle, Clock, ListChecks, CheckSquare } from 'lucide-react';

type AlertSeverity = 'critical' | 'warning' | 'info';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  icon: typeof AlertTriangle;
  message: string;
  href: string;
}

const severityStyles: Record<AlertSeverity, { bg: string; border: string; text: string; icon: string }> = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/50',
    text: 'text-red-700 dark:text-red-300',
    icon: 'text-red-500 dark:text-red-400',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-500 dark:text-amber-400',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800/50',
    text: 'text-blue-700 dark:text-blue-300',
    icon: 'text-blue-500 dark:text-blue-400',
  },
};

interface CrmAlertsProps {
  heroStats: {
    todaysTaskCount: number;
    overdueCount: number;
    atRiskCount: number;
    newThisWeek: number;
  };
}

/**
 * CrmAlerts -- CRM-focused alert badges for actionable items.
 * Only renders when there are items needing attention.
 */
export function CrmAlerts({ heroStats }: CrmAlertsProps) {
  const alerts: AlertItem[] = [];

  if (heroStats.overdueCount > 0) {
    alerts.push({
      id: 'overdue-tasks',
      severity: heroStats.overdueCount >= 5 ? 'critical' : 'warning',
      icon: Clock,
      message: `${heroStats.overdueCount} Overdue Task${heroStats.overdueCount > 1 ? 's' : ''}`,
      href: '/crm/workqueue',
    });
  }

  if (heroStats.atRiskCount > 0) {
    alerts.push({
      id: 'at-risk-deals',
      severity: heroStats.atRiskCount >= 3 ? 'critical' : 'warning',
      icon: AlertTriangle,
      message: `${heroStats.atRiskCount} At-Risk Deal${heroStats.atRiskCount > 1 ? 's' : ''}`,
      href: '/crm/modules/deals',
    });
  }

  if (heroStats.todaysTaskCount > 0) {
    alerts.push({
      id: 'tasks-today',
      severity: 'info',
      icon: CheckSquare,
      message: `${heroStats.todaysTaskCount} Task${heroStats.todaysTaskCount > 1 ? 's' : ''} Due Today`,
      href: '/crm/workqueue',
    });
  }

  if (heroStats.newThisWeek > 0) {
    alerts.push({
      id: 'new-records',
      severity: 'info',
      icon: ListChecks,
      message: `${heroStats.newThisWeek} New Record${heroStats.newThisWeek > 1 ? 's' : ''} This Week`,
      href: '/crm/modules/leads',
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
      {alerts.map((alert) => {
        const styles = severityStyles[alert.severity];
        const Icon = alert.icon;

        return (
          <Link
            key={alert.id}
            href={alert.href}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg
              ${styles.bg} border ${styles.border}
              hover:brightness-95 dark:hover:brightness-125 transition-all duration-200
              whitespace-nowrap shrink-0
            `}
          >
            <Icon className={`w-3.5 h-3.5 ${styles.icon}`} />
            <span className={`text-xs font-medium ${styles.text}`}>
              {alert.message}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
