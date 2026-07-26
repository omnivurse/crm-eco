import 'server-only';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  countCurrentlyCoveredDependents,
  summarizeRecentCoverageChanges,
  type DependentCoveragePeriod,
} from '@crm-eco/lib';
import { getActiveTenant } from '@/lib/tenant';
import type { MemberCommandCenterData } from './types';

// Client-safe types + constants live in ./types so the client MemberCommandCenter
// component can import them without pulling this 'server-only' module. Re-export
// them here for server callers that import from this file.
export * from './types';

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
    plansRes,
    ticketsRes,
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
      .is('deleted_at' as never, null)
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
    supabase
      .from('plans')
      .select('id, name, code, plan_type, monthly_share')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('tickets')
      .select('id, subject, status, priority, category, created_at')
      .eq('member_id', memberId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50),
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
    tickets: (ticketsRes.data ?? []) as MemberCommandCenterData['tickets'],
    agents: (agentsRes.data ?? []) as MemberCommandCenterData['agents'],
    availablePlans: (plansRes.data ?? []) as MemberCommandCenterData['availablePlans'],
  };
}
