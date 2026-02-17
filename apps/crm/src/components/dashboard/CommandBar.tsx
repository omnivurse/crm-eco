import { Shield, Clock, AlertTriangle, CheckSquare } from 'lucide-react';
import type { CrmProfile } from '@/lib/crm/types';

interface CommandBarProps {
  profile: CrmProfile;
  orgName: string;
  stats: {
    todaysTaskCount: number;
    overdueCount: number;
    atRiskCount: number;
    newThisWeek: number;
  };
}

/** Status severity derived from threshold logic */
type Severity = 'healthy' | 'warning' | 'critical';

function getSeverity(value: number, warnAt: number, critAt: number): Severity {
  if (value >= critAt) return 'critical';
  if (value >= warnAt) return 'warning';
  return 'healthy';
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
 * CommandBar -- Personal identity + status header for CRM sales agents.
 * Shows user identity and personal productivity metrics only.
 */
export function CommandBar({ profile, orgName, stats }: CommandBarProps) {
  const overdueSeverity = getSeverity(stats.overdueCount, 1, 5);
  const atRiskSeverity = getSeverity(stats.atRiskCount, 1, 3);

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
              {profile.full_name}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-teal-400/15 text-teal-300 border border-teal-400/20">
              <Shield className="w-2.5 h-2.5" />
              {getRoleLabel(profile.crm_role)}
            </span>
          </div>
        </div>

        {/* Right: Personal Status Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            icon={CheckSquare}
            label="Tasks Today"
            value={stats.todaysTaskCount}
            severity={stats.todaysTaskCount > 0 ? 'healthy' : 'healthy'}
          />
          <StatusPill
            icon={Clock}
            label="Overdue"
            value={stats.overdueCount}
            severity={overdueSeverity}
          />
          <StatusPill
            icon={AlertTriangle}
            label="At Risk"
            value={stats.atRiskCount}
            severity={atRiskSeverity}
          />
        </div>
      </div>
    </div>
  );
}
