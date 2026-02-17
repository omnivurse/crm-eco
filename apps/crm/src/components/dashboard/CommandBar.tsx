import { Shield, Clock, AlertTriangle, FileCheck, CreditCard } from 'lucide-react';
import type { CrmProfile } from '@/lib/crm/types';
import type { CommandConsoleStats } from '@/lib/crm/queries';

interface CommandBarProps {
  profile: CrmProfile;
  orgName: string;
  stats: CommandConsoleStats;
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
  healthy: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
      <div className={`w-1.5 h-1.5 rounded-full ${severityDot[severity]}`} />
      <Icon className={`w-3.5 h-3.5 ${severityText[severity]}`} />
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-semibold ${severityText[severity]}`}>{value}</span>
    </div>
  );
}

/** Role badge display label */
function getRoleLabel(role: string | null): string {
  switch (role) {
    case 'admin': return 'Admin';
    case 'manager': return 'Manager';
    case 'member': return 'Advisor';
    default: return 'Operator';
  }
}

/**
 * CommandBar -- Enterprise operations status header.
 * Replaces the greeting card with identity + database-derived status indicators.
 */
export function CommandBar({ profile, orgName, stats }: CommandBarProps) {
  const { billingStats, enrollmentStats, operationsStats } = stats;

  const paymentRecency = getPaymentRecency(billingStats.lastSuccessfulPaymentAt);
  const failureSeverity = getSeverity(billingStats.failedToday, 1, 4);
  const pendingSeverity = getSeverity(enrollmentStats.pendingUnderwriting, 3, 8);
  const overdueSeverity = getSeverity(operationsStats.overdueTasks, 1, 5);

  return (
    <div className="rounded-lg bg-slate-950 border border-slate-800 px-5 py-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100 tracking-tight">
              {orgName}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-sm text-slate-300">
              {profile.full_name}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Shield className="w-2.5 h-2.5" />
              {getRoleLabel(profile.crm_role)}
            </span>
          </div>
        </div>

        {/* Right: Status Indicators */}
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
            label="Pending Review"
            value={enrollmentStats.pendingUnderwriting}
            severity={pendingSeverity}
          />
          <StatusPill
            icon={Clock}
            label="Overdue Tasks"
            value={operationsStats.overdueTasks}
            severity={overdueSeverity}
          />
        </div>
      </div>
    </div>
  );
}
