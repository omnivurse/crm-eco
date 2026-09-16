/**
 * Shared analytics metric catalog.
 *
 * Every dashboard / report number that counts enrollments, members, or
 * advisor revenue must use these definitions so Admin and CRM stay aligned.
 */

export const ENROLLMENT_STATUS = {
  approvedOrActive: ['approved', 'active'] as const,
  pendingReview: ['submitted', 'pending_review', 'more_info'] as const,
  cancelled: ['cancelled'] as const,
  rejected: ['rejected'] as const,
  draft: ['draft', 'in_progress'] as const,
};

export const MEMBER_STATUS = {
  active: ['active'] as const,
  cancelled: ['cancelled', 'inactive'] as const,
  terminated: ['terminated'] as const,
};

/** Legacy report filter aliases → live enrollment statuses. */
const ENROLLMENT_STATUS_ALIASES: Record<string, readonly string[]> = {
  pending: ENROLLMENT_STATUS.pendingReview,
  terminated: ENROLLMENT_STATUS.cancelled,
  active: ENROLLMENT_STATUS.approvedOrActive,
  approved: ['approved'],
  cancelled: ENROLLMENT_STATUS.cancelled,
  rejected: ENROLLMENT_STATUS.rejected,
  submitted: ['submitted'],
  pending_review: ['pending_review'],
  more_info: ['more_info'],
  draft: ['draft'],
  in_progress: ['in_progress'],
  inactive: ['inactive'],
  on_hold: ['on_hold'],
};

export const ADVISOR_METRIC_IDS = {
  enrollments: 'advisor.enrollments',
  activeMembers: 'advisor.active_members',
  cancellations: 'advisor.cancellations',
  revenue: 'advisor.revenue',
} as const;

export interface MetricDefinition {
  id: string;
  name: string;
  businessMeaning: string;
  sourceTables: readonly string[];
  sourceFields: readonly string[];
  dateField: string;
  grouping: string;
  permissionScope: string;
  refreshCadence: string;
  knownExclusions: string;
  reconciliation: string;
}

export const ADVISOR_METRICS: Record<keyof typeof ADVISOR_METRIC_IDS, MetricDefinition> = {
  enrollments: {
    id: ADVISOR_METRIC_IDS.enrollments,
    name: 'Advisor enrollments',
    businessMeaning: 'Enrollments attributed to an advisor, grouped by live status buckets.',
    sourceTables: ['enrollments', 'advisors', 'members'],
    sourceFields: ['enrollments.advisor_id', 'enrollments.status', 'enrollments.enrollment_date'],
    dateField: 'enrollments.enrollment_date',
    grouping: 'advisors.id',
    permissionScope: 'organization_id = caller tenant',
    refreshCadence: 'live RPC + 15m cache, invalidated on domain events',
    knownExclusions: 'Rows with a null advisor_id are omitted from per-advisor totals.',
    reconciliation:
      'SUM(total_enrollments) must equal COUNT(*) FROM enrollments WHERE organization_id = tenant AND advisor_id IS NOT NULL (plus optional date/state/status filters).',
  },
  activeMembers: {
    id: ADVISOR_METRIC_IDS.activeMembers,
    name: 'Advisor active members',
    businessMeaning: 'Members currently active and assigned to an advisor.',
    sourceTables: ['members', 'advisors'],
    sourceFields: ['members.advisor_id', 'members.status'],
    dateField: 'members.created_at',
    grouping: 'advisors.id',
    permissionScope: 'organization_id = caller tenant',
    refreshCadence: 'live RPC + 15m cache',
    knownExclusions: 'History-module CRM twins are not counted; source is members.status.',
    reconciliation:
      'SUM(active_members) must equal COUNT(*) FROM members WHERE organization_id = tenant AND status = active AND advisor_id IS NOT NULL.',
  },
  cancellations: {
    id: ADVISOR_METRIC_IDS.cancellations,
    name: 'Advisor cancellations',
    businessMeaning: 'Members in cancelled/inactive/terminated status per advisor.',
    sourceTables: ['members', 'advisors'],
    sourceFields: ['members.status', 'members.termination_date'],
    dateField: 'members.termination_date',
    grouping: 'advisors.id',
    permissionScope: 'organization_id = caller tenant',
    refreshCadence: 'live RPC + 15m cache',
    knownExclusions:
      'Do not use member_lifecycle_events.cancelled as SoT until that pile is reconciled.',
    reconciliation:
      'cancelled_count = members.status IN (cancelled, inactive); terminated_count = members.status = terminated.',
  },
  revenue: {
    id: ADVISOR_METRIC_IDS.revenue,
    name: 'Advisor revenue',
    businessMeaning: 'Gross/net commissions per advisor from the commissions SoT rollup.',
    sourceTables: ['commissions', 'advisor_commission_summary'],
    sourceFields: [
      'advisor_commission_summary.gross_commissions',
      'advisor_commission_summary.net_commissions',
    ],
    dateField: 'advisor_commission_summary.period_month',
    grouping: 'advisors.id',
    permissionScope: 'organization_id = caller tenant',
    refreshCadence: 'incremental on commission.created + nightly refresh',
    knownExclusions: 'commission_transactions alone do not count until mirrored into commissions.',
    reconciliation:
      'gross_commissions must equal SUM(commission_amount) FROM commissions for the same org/month/advisor.',
  },
};

export function expandEnrollmentStatusFilter(statuses?: string[] | null): string[] | null {
  if (!statuses?.length) return null;
  const expanded = new Set<string>();
  for (const raw of statuses) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    const aliases = ENROLLMENT_STATUS_ALIASES[key];
    if (aliases) {
      for (const status of aliases) expanded.add(status);
    } else {
      expanded.add(key);
    }
  }
  return expanded.size ? [...expanded] : null;
}

export function isPendingReviewStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (ENROLLMENT_STATUS.pendingReview as readonly string[]).includes(status);
}

export function isApprovedOrActiveStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (ENROLLMENT_STATUS.approvedOrActive as readonly string[]).includes(status);
}

export function sumAdvisorMetric(
  rows: Array<Record<string, unknown>>,
  field: string,
): number {
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
}

export function reconcileCount(actual: number, expected: number): { ok: boolean; actual: number; expected: number } {
  return { ok: actual === expected, actual, expected };
}
