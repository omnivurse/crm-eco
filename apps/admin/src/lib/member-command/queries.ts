import 'server-only';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  countCurrentlyCoveredDependents,
  summarizeRecentCoverageChanges,
  type DependentCoveragePeriod,
} from '@crm-eco/lib';
import { getActiveTenant } from '@/lib/tenant';

export type MemberCommandTab =
  | 'overview'
  | 'profile'
  | 'household'
  | 'dependents'
  | 'enrollments'
  | 'coverage'
  | 'products'
  | 'billing'
  | 'invoices'
  | 'payment-profiles'
  | 'portal'
  | 'documents'
  | 'activity'
  | 'audit'
  | 'communication'
  | 'tasks'
  | 'notes'
  | 'settings';

export const MEMBER_COMMAND_TABS: { id: MemberCommandTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Profile' },
  { id: 'household', label: 'Household' },
  { id: 'dependents', label: 'Dependents' },
  { id: 'enrollments', label: 'Enrollments' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'products', label: 'Products' },
  { id: 'billing', label: 'Billing' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'payment-profiles', label: 'Payment Profiles' },
  { id: 'portal', label: 'Portal Access' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'communication', label: 'Communication' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
  { id: 'settings', label: 'Settings' },
];

/** Tab → canonical backend (reuse first; build only when nothing exists). */
export const MEMBER_COMMAND_TAB_SOURCES: Record<
  MemberCommandTab,
  { tables: string[]; actions: string[]; components: string[] }
> = {
  overview: {
    tables: ['members', 'memberships', 'billing_schedules', 'dependents', 'enrollments'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  profile: {
    tables: ['members'],
    actions: ['MemberForm autosave'],
    components: ['MemberForm'],
  },
  household: {
    tables: ['dependents'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  dependents: {
    tables: ['dependents', 'dependent_coverage_periods'],
    actions: [
      'command-actions.ts → staffDependentCoverage (@crm-eco/lib)',
      'membershipBillingRecalc',
    ],
    components: ['AdminDependentCoveragePanel'],
  },
  enrollments: {
    tables: ['enrollments', 'plans'],
    actions: ['enrollments/actions.ts (approve/reject)'],
    components: ['MemberCommandCenter'],
  },
  coverage: {
    tables: ['dependent_coverage_periods', 'dependents'],
    actions: ['command-actions.ts → staffDependentCoverage'],
    components: ['AdminDependentCoveragePanel (readOnly)'],
  },
  products: {
    tables: ['memberships', 'plans'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  billing: {
    tables: ['billing_schedules', 'payment_profiles'],
    actions: ['MemberBillingTab client reads'],
    components: ['MemberBillingTab'],
  },
  invoices: {
    tables: ['invoices'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  'payment-profiles': {
    tables: ['payment_profiles'],
    actions: ['MemberBillingTab', '/api/billing/payment-profiles → BillingService'],
    components: ['MemberBillingTab'],
  },
  portal: {
    tables: ['members', 'auth.users'],
    actions: ['members/actions.ts inviteMemberToPortal → memberOnboarding.ts'],
    components: ['MemberPortalAccess'],
  },
  documents: {
    tables: ['enrollment_contracts'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  activity: {
    tables: ['admin_activity_log'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  audit: {
    tables: ['enrollment_audit_log'],
    actions: ['enrollments/actions.ts'],
    components: ['MemberCommandCenter'],
  },
  communication: {
    tables: ['members.receive_emails', 'communication_preferences'],
    actions: [],
    components: [],
  },
  tasks: {
    tables: [],
    actions: [],
    components: [],
  },
  notes: {
    tables: [],
    actions: [],
    components: ['CRM record notes (linked contact)'],
  },
  settings: {
    tables: ['member_change_requests', 'members'],
    actions: ['MergeMembersModal', '/changes/review'],
    components: ['MergeMembersSection', 'MemberCommandCenter'],
  },
};

export interface MemberCommandCenterData {
  member: Record<string, unknown> & {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    status: string;
    advisor?: { id: string; first_name: string; last_name: string; email: string } | null;
  };
  activeMembership: Record<string, unknown> | null;
  billingSchedule: Record<string, unknown> | null;
  dependents: Record<string, unknown>[];
  coveragePeriods: DependentCoveragePeriod[];
  coveredCount: number;
  recentCoverageChanges: ReturnType<typeof summarizeRecentCoverageChanges>;
  enrollments: Record<string, unknown>[];
  memberships: Record<string, unknown>[];
  changeRequests: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  adminActivity: Record<string, unknown>[];
  enrollmentAudit: Record<string, unknown>[];
  agents: { id: string; first_name: string; last_name: string; email: string }[];
}

export async function loadMemberCommandCenterData(
  memberId: string,
): Promise<MemberCommandCenterData | null> {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return null;

  const orgId = tenant.organizationId;

  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select(
      `
      *,
      advisor:advisors(id, first_name, last_name, email)
    `,
    )
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single();

  if (memberErr || !member) return null;

  const [
    activeMembershipRes,
    billingScheduleRes,
    dependentsRes,
    periodsRes,
    enrollmentsRes,
    membershipsRes,
    changeRequestsRes,
    invoicesRes,
    contractsRes,
    adminActivityRes,
    agentsRes,
  ] = await Promise.all([
    supabase
      .from('memberships')
      .select(
        `
        id, status, billing_amount, effective_date, end_date, membership_number,
        plans:plan_id (id, name, code, plan_type, monthly_share, description)
      `,
      )
      .eq('member_id', memberId)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('billing_schedules')
      .select('id, amount, frequency, billing_day, next_billing_date, status')
      .eq('member_id', memberId)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('next_billing_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('dependents')
      .select('*')
      .eq('member_id', memberId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true }),
    supabase
      .from('dependent_coverage_periods')
      .select('*')
      .eq('member_id', memberId)
      .eq('organization_id', orgId)
      .order('effective_from', { ascending: false }),
    supabase
      .from('enrollments')
      .select(
        `
        id, enrollment_number, status, effective_date, requested_effective_date,
        created_at, base_monthly_cost, total_monthly_cost,
        plan:plans!enrollments_selected_plan_id_fkey(id, name, code, monthly_share)
      `,
      )
      .eq('primary_member_id', memberId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('memberships')
      .select(
        `
        id, status, billing_amount, effective_date, end_date, membership_number,
        plans:plan_id (id, name, code, plan_type, monthly_share)
      `,
      )
      .eq('member_id', memberId)
      .eq('organization_id', orgId)
      .order('effective_date', { ascending: false }),
    supabase
      .from('member_change_requests')
      .select('id, request_type, status, payload, created_at, decision_notes')
      .eq('member_id', memberId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total, balance_due, due_date, created_at')
      .eq('member_id', memberId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('enrollment_contracts')
      .select('id, contract_type, status, file_url, pdf_url, created_at')
      .eq('member_id', memberId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('admin_activity_log')
      .select('id, action, entity_type, entity_id, metadata, created_at')
      .eq('entity_type', 'member')
      .eq('entity_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('advisors')
      .select('id, first_name, last_name, email')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('last_name'),
  ]);

  const dependents = (dependentsRes.data ?? []) as Record<string, unknown>[];
  const coveragePeriods = (periodsRes.data ?? []) as DependentCoveragePeriod[];
  const enrollmentRows = (enrollmentsRes.data ?? []) as Record<string, unknown>[];
  const enrollmentIds = enrollmentRows.map((e) => e.id as string);

  let enrollmentAudit: Record<string, unknown>[] = [];
  if (enrollmentIds.length > 0) {
    const { data: auditRows } = await supabase
      .from('enrollment_audit_log')
      .select(
        `
        id, event_type, message, old_status, new_status, created_at,
        enrollment_id,
        actor:profiles!enrollment_audit_log_actor_profile_id_fkey(full_name)
      `,
      )
      .in('enrollment_id', enrollmentIds)
      .order('created_at', { ascending: false })
      .limit(50);
    enrollmentAudit = (auditRows ?? []) as Record<string, unknown>[];
  }

  return {
    member: member as MemberCommandCenterData['member'],
    activeMembership: (activeMembershipRes.data as Record<string, unknown>) ?? null,
    billingSchedule: (billingScheduleRes.data as Record<string, unknown>) ?? null,
    dependents,
    coveragePeriods,
    coveredCount: countCurrentlyCoveredDependents(
      dependents.map((d) => ({
        id: d.id as string,
        included_in_enrollment: (d.included_in_enrollment as boolean | null) ?? null,
      })),
      coveragePeriods,
    ),
    recentCoverageChanges: summarizeRecentCoverageChanges(
      dependents as { id: string; first_name: string; last_name: string }[],
      coveragePeriods,
      5,
    ),
    enrollments: enrollmentRows,
    memberships: (membershipsRes.data ?? []) as Record<string, unknown>[],
    changeRequests: (changeRequestsRes.data ?? []) as Record<string, unknown>[],
    invoices: (invoicesRes.data ?? []) as Record<string, unknown>[],
    contracts: (contractsRes.data ?? []) as Record<string, unknown>[],
    adminActivity: (adminActivityRes.data ?? []) as Record<string, unknown>[],
    enrollmentAudit,
    agents: (agentsRes.data ?? []) as MemberCommandCenterData['agents'],
  };
}
