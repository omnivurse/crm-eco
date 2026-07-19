import Link from 'next/link';
import { XCircle, Clock, ClipboardText, CurrencyDollar, Cpu } from '@phosphor-icons/react/dist/ssr';
import type { AdminConsoleStats } from '@/lib/admin-console-queries';

type AlertSeverity = 'critical' | 'warning' | 'info';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  icon: typeof XCircle;
  message: string;
  count: number;
  href: string;
}

/** Soft glass tinting per severity -- hand-tuned per theme, matches --adm-rose/amber/cyan in both light + dark. */
const severityStyles: Record<AlertSeverity, { bg: string; border: string; text: string }> = {
  critical: {
    bg: 'bg-[rgba(225,29,72,0.07)] dark:bg-[rgba(251,113,133,0.10)]',
    border: 'border-[rgba(225,29,72,0.22)] dark:border-[rgba(251,113,133,0.25)]',
    text: 'text-[var(--adm-rose)]',
  },
  warning: {
    bg: 'bg-[rgba(217,119,6,0.07)] dark:bg-[rgba(251,191,36,0.10)]',
    border: 'border-[rgba(217,119,6,0.22)] dark:border-[rgba(251,191,36,0.25)]',
    text: 'text-[var(--adm-amber)]',
  },
  info: {
    bg: 'bg-[rgba(8,145,178,0.07)] dark:bg-[rgba(34,211,238,0.10)]',
    border: 'border-[rgba(8,145,178,0.22)] dark:border-[rgba(34,211,238,0.25)]',
    text: 'text-[var(--adm-cyan)]',
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
      icon: ClipboardText,
      message: `${stats.enrollmentStats.pendingReview} Enrollment${stats.enrollmentStats.pendingReview > 1 ? 's' : ''} Pending Review`,
      count: stats.enrollmentStats.pendingReview,
      href: '/enrollments?status=submitted',
    });
  }

  if (stats.commissionStats.pendingAmount > 0) {
    alerts.push({
      id: 'pending-commissions',
      severity: 'warning',
      icon: CurrencyDollar,
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
              flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-sm
              ${styles.bg} ${styles.border}
              transition-all duration-200 hover:-translate-y-0.5
              whitespace-nowrap shrink-0
            `}
          >
            <Icon weight="light" className={`h-3.5 w-3.5 ${styles.text}`} />
            <span className={`text-xs font-medium ${styles.text}`}>
              {alert.message}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
