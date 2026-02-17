import Link from 'next/link';
import { AlertTriangle, XCircle, Clock, FileCheck, DollarSign, Cpu } from 'lucide-react';
import type { AdminConsoleStats } from '@/lib/admin-console-queries';

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
    bg: 'bg-red-50 dark:bg-red-950/50',
    border: 'border-red-200 dark:border-red-800/50',
    text: 'text-red-700 dark:text-red-300',
    icon: 'text-red-500 dark:text-red-400',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-200 dark:border-amber-800/50',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-500 dark:text-amber-400',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    border: 'border-blue-200 dark:border-blue-800/50',
    text: 'text-blue-700 dark:text-blue-300',
    icon: 'text-blue-500 dark:text-blue-400',
  },
};

/**
 * Derive alert items from admin console stats.
 * Only alerts with count > 0 are shown.
 */
function deriveAlerts(stats: AdminConsoleStats): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (stats.billingStats.failedToday > 0) {
    alerts.push({
      id: 'failed-payments',
      severity: 'critical',
      icon: XCircle,
      message: `${stats.billingStats.failedToday} Payment${stats.billingStats.failedToday > 1 ? 's' : ''} Failed Today`,
      count: stats.billingStats.failedToday,
      href: '/billing',
    });
  }

  if (stats.systemStats.failedJobs24h > 0) {
    alerts.push({
      id: 'failed-jobs',
      severity: 'critical',
      icon: Cpu,
      message: `${stats.systemStats.failedJobs24h} Job${stats.systemStats.failedJobs24h > 1 ? 's' : ''} Failed (24h)`,
      count: stats.systemStats.failedJobs24h,
      href: '/settings/automation',
    });
  }

  if (stats.enrollmentStats.pendingReview > 0) {
    alerts.push({
      id: 'pending-reviews',
      severity: 'warning',
      icon: FileCheck,
      message: `${stats.enrollmentStats.pendingReview} Enrollment${stats.enrollmentStats.pendingReview > 1 ? 's' : ''} Pending Review`,
      count: stats.enrollmentStats.pendingReview,
      href: '/enrollments?status=submitted',
    });
  }

  if (stats.commissionStats.pendingAmount > 0) {
    alerts.push({
      id: 'pending-commissions',
      severity: 'warning',
      icon: DollarSign,
      message: `$${stats.commissionStats.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })} Commissions Pending`,
      count: stats.commissionStats.pendingPayouts,
      href: '/commissions/transactions?status=pending',
    });
  }

  if (stats.enrollmentStats.expiringSoon > 0) {
    alerts.push({
      id: 'expiring-apps',
      severity: 'warning',
      icon: Clock,
      message: `${stats.enrollmentStats.expiringSoon} Application${stats.enrollmentStats.expiringSoon > 1 ? 's' : ''} Stale > 48h`,
      count: stats.enrollmentStats.expiringSoon,
      href: '/enrollments',
    });
  }

  return alerts;
}

interface AdminAlertsStripProps {
  stats: AdminConsoleStats;
}

/**
 * AdminAlertsStrip -- Critical alerts strip for admin dashboard.
 * Only renders when there are active alerts.
 */
export function AdminAlertsStrip({ stats }: AdminAlertsStripProps) {
  const alerts = deriveAlerts(stats);

  if (alerts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
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
