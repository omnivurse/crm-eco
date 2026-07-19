import { Shield, Warning, ClipboardText, CreditCard, CurrencyDollar } from '@phosphor-icons/react/dist/ssr';
import type { AdminConsoleStats } from '@/lib/admin-console-queries';

interface AdminCommandBarProps {
  adminName: string;
  orgName: string;
  stats: AdminConsoleStats;
}

/** Status severity derived from threshold logic */
type Severity = 'healthy' | 'warning' | 'critical';

function getSeverity(value: number, warnAt: number, critAt: number): Severity {
  if (value >= critAt) return 'critical';
  if (value >= warnAt) return 'warning';
  return 'healthy';
}

function getPaymentRecency(lastAt: string | null): { label: string; severity: Severity } {
  if (!lastAt) return { label: 'No payments', severity: 'warning' };
  const hoursAgo = (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 6) return { label: `${Math.round(hoursAgo)}h ago`, severity: 'healthy' };
  if (hoursAgo < 24) return { label: `${Math.round(hoursAgo)}h ago`, severity: 'warning' };
  const daysAgo = Math.round(hoursAgo / 24);
  return { label: `${daysAgo}d ago`, severity: 'critical' };
}

const severityColor: Record<Severity, string> = {
  healthy: 'var(--adm-emerald)',
  warning: 'var(--adm-amber)',
  critical: 'var(--adm-rose)',
};

function StatusPill({
  icon: Icon,
  label,
  value,
  severity,
}: {
  icon: typeof Shield;
  label: string;
  value: string | number;
  severity: Severity;
}) {
  const color = severityColor[severity];
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--adm-hairline)] bg-[rgba(11,109,133,0.04)] px-3 py-1.5 dark:bg-white/5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <Icon weight="light" className="h-3.5 w-3.5" style={{ color }} />
      <span className="text-xs text-[var(--adm-muted)]">{label}</span>
      <span className="text-xs font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * AdminCommandBar -- Enterprise operations status header for admins.
 * Shows org identity + org-wide operational status indicators.
 */
export function AdminCommandBar({ adminName, orgName, stats }: AdminCommandBarProps) {
  const { billingStats, enrollmentStats, commissionStats } = stats;

  const paymentRecency = getPaymentRecency(billingStats.lastPaymentAt);
  const failureSeverity = getSeverity(billingStats.failedToday, 1, 4);
  const reviewSeverity = getSeverity(enrollmentStats.pendingReview, 3, 8);
  const commissionSeverity = getSeverity(commissionStats.pendingPayouts, 1, 5);

  return (
    <div className="adm-bezel">
      <div className="adm-bezel-inner flex flex-col gap-4 px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--adm-cyan)] to-[var(--adm-teal)] shadow-sm">
            <Shield weight="light" className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-[var(--adm-ink)]">
              {orgName}
            </span>
            <span className="text-[var(--adm-muted)]">·</span>
            <span className="text-sm text-[var(--adm-muted)]">
              {adminName}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--adm-hairline)] bg-[rgba(217,119,6,0.10)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--adm-amber)]">
              <Shield weight="light" className="h-2.5 w-2.5" />
              Admin
            </span>
          </div>
        </div>

        {/* Right: Org-Wide Status Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            icon={CreditCard}
            label="Last Payment"
            value={paymentRecency.label}
            severity={paymentRecency.severity}
          />
          <StatusPill
            icon={Warning}
            label="Failures Today"
            value={billingStats.failedToday}
            severity={failureSeverity}
          />
          <StatusPill
            icon={ClipboardText}
            label="Pending Reviews"
            value={enrollmentStats.pendingReview}
            severity={reviewSeverity}
          />
          <StatusPill
            icon={CurrencyDollar}
            label="Pending Commissions"
            value={formatCurrency(commissionStats.pendingAmount)}
            severity={commissionSeverity}
          />
        </div>
      </div>
    </div>
  );
}
