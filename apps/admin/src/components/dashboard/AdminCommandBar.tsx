import { Shield, Clock, AlertTriangle, FileCheck, CreditCard, DollarSign } from 'lucide-react';
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

const severityDot: Record<Severity, string> = {
  healthy: 'bg-emerald-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

const severityText: Record<Severity, string> = {
  healthy: 'text-emerald-300',
  warning: 'text-amber-300',
  critical: 'text-red-300',
};

function StatusPill({
  icon: Icon,
  label,
  value,
  severity,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
  severity: Severity;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.07] backdrop-blur-sm border border-white/[0.10]">
      <div className={`w-1.5 h-1.5 rounded-full ${severityDot[severity]}`} />
      <Icon className={`w-3.5 h-3.5 ${severityText[severity]}`} />
      <span className="text-xs text-white/50">{label}</span>
      <span className={`text-xs font-semibold ${severityText[severity]}`}>{value}</span>
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
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#003560] via-[#004a7c] to-[#047474] px-5 py-4 shadow-lg shadow-[#003560]/20 ring-1 ring-white/10">
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-tight">
              {orgName}
            </span>
            <span className="text-white/30">|</span>
            <span className="text-sm text-white/80">
              {adminName}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#E9B61F]/20 text-[#E9B61F] border border-[#E9B61F]/30">
              <Shield className="w-2.5 h-2.5" />
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
            icon={AlertTriangle}
            label="Failures Today"
            value={billingStats.failedToday}
            severity={failureSeverity}
          />
          <StatusPill
            icon={FileCheck}
            label="Pending Reviews"
            value={enrollmentStats.pendingReview}
            severity={reviewSeverity}
          />
          <StatusPill
            icon={DollarSign}
            label="Pending Commissions"
            value={formatCurrency(commissionStats.pendingAmount)}
            severity={commissionSeverity}
          />
        </div>
      </div>
    </div>
  );
}
