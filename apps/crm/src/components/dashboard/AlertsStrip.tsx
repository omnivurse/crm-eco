import Link from 'next/link';
import { AlertTriangle, XCircle, Clock, FileWarning, ListChecks } from 'lucide-react';
import type { CommandConsoleStats } from '@/lib/crm/queries';

type AlertSeverity = 'critical' | 'warning' | 'info';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  icon: typeof AlertTriangle;
  message: string;
  count: number;
  href: string;
}

const severityStyles: Record<AlertSeverity, { bg: string; border: string; text: string; icon: string }> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: 'text-amber-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'text-blue-500',
  },
};

/**
 * Derive alert items from command console stats.
 * Only alerts with count > 0 are shown.
 */
function deriveAlerts(stats: CommandConsoleStats): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (stats.billingStats.failedToday > 0) {
    alerts.push({
      id: 'failed-payments',
      severity: 'critical',
      icon: XCircle,
      message: `${stats.billingStats.failedToday} Payment${stats.billingStats.failedToday > 1 ? 's' : ''} Failed Today`,
      count: stats.billingStats.failedToday,
      href: '/crm/modules/deals',
    });
  }

  if (stats.enrollmentStats.rejectedCount > 0) {
    alerts.push({
      id: 'rejected-enrollments',
      severity: 'critical',
      icon: AlertTriangle,
      message: `${stats.enrollmentStats.rejectedCount} Enrollment${stats.enrollmentStats.rejectedCount > 1 ? 's' : ''} Rejected`,
      count: stats.enrollmentStats.rejectedCount,
      href: '/crm/modules/contacts',
    });
  }

  if (stats.enrollmentStats.expiringSoon > 0) {
    alerts.push({
      id: 'expiring-apps',
      severity: 'warning',
      icon: Clock,
      message: `${stats.enrollmentStats.expiringSoon} Application${stats.enrollmentStats.expiringSoon > 1 ? 's' : ''} Stale > 48h`,
      count: stats.enrollmentStats.expiringSoon,
      href: '/crm/modules/leads',
    });
  }

  if (stats.enrollmentStats.docsRequired > 0) {
    alerts.push({
      id: 'docs-required',
      severity: 'warning',
      icon: FileWarning,
      message: `${stats.enrollmentStats.docsRequired} Enrollment${stats.enrollmentStats.docsRequired > 1 ? 's' : ''} Missing Documents`,
      count: stats.enrollmentStats.docsRequired,
      href: '/crm/modules/contacts',
    });
  }

  if (stats.operationsStats.overdueTasks > 0) {
    alerts.push({
      id: 'overdue-tasks',
      severity: 'info',
      icon: ListChecks,
      message: `${stats.operationsStats.overdueTasks} Overdue Task${stats.operationsStats.overdueTasks > 1 ? 's' : ''}`,
      count: stats.operationsStats.overdueTasks,
      href: '/crm/activities?filter=overdue',
    });
  }

  if (stats.operationsStats.atRiskDeals > 0) {
    alerts.push({
      id: 'at-risk-deals',
      severity: 'warning',
      icon: AlertTriangle,
      message: `${stats.operationsStats.atRiskDeals} At-Risk Deal${stats.operationsStats.atRiskDeals > 1 ? 's' : ''}`,
      count: stats.operationsStats.atRiskDeals,
      href: '/crm/pipeline',
    });
  }

  return alerts;
}

interface AlertsStripProps {
  stats: CommandConsoleStats;
}

/**
 * AlertsStrip -- Critical alerts strip that only renders when alerts exist.
 * Each alert is a clickable badge linking to the relevant action page.
 */
export function AlertsStrip({ stats }: AlertsStripProps) {
  const alerts = deriveAlerts(stats);

  if (alerts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-300">
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
              hover:brightness-125 transition-all duration-200
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
