/**
 * Billing coverage activation — pending memberships/members → active when
 * effective_date <= today. Separate seam from CRM crm_records activation
 * (see membership-lifecycle/README.md). Enrollments stay `approved`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type DuePendingMembership = {
  id: string;
  member_id: string;
  organization_id: string | null;
  effective_date: string | null;
};

export type BillingActivationOptions = {
  dryRun?: boolean;
};

export type BillingActivationResult = {
  today: string;
  dry_run: boolean;
  memberships_to_activate: number;
  members_to_activate: number;
  memberships_activated: number;
  members_activated: number;
  due: DuePendingMembership[];
  error?: string;
};

export async function listDuePendingMemberships(
  supabase: SupabaseClient,
  today: string,
): Promise<{ due: DuePendingMembership[]; error?: string }> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, member_id, organization_id, effective_date')
    .eq('status', 'pending')
    .lte('effective_date', today);

  if (error) {
    return { due: [], error: error.message };
  }

  return { due: (data ?? []) as DuePendingMembership[] };
}

/**
 * Activate due pending memberships and matching pending members.
 * Does not touch enrollments (commission invariant).
 */
export async function applyDueMembershipActivation(
  supabase: SupabaseClient,
  today: string,
  opts: BillingActivationOptions = {},
): Promise<BillingActivationResult> {
  const dryRun = Boolean(opts.dryRun);
  const { due, error } = await listDuePendingMemberships(supabase, today);

  if (error) {
    return {
      today,
      dry_run: dryRun,
      memberships_to_activate: 0,
      members_to_activate: 0,
      memberships_activated: 0,
      members_activated: 0,
      due: [],
      error,
    };
  }

  const memberIds = Array.from(new Set(due.map((m) => m.member_id).filter(Boolean)));

  if (dryRun || due.length === 0) {
    return {
      today,
      dry_run: dryRun,
      memberships_to_activate: due.length,
      members_to_activate: memberIds.length,
      memberships_activated: 0,
      members_activated: 0,
      due,
    };
  }

  const { data: m1, error: e1 } = await supabase
    .from('memberships')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lte('effective_date', today)
    .select('id');

  if (e1) {
    return {
      today,
      dry_run: false,
      memberships_to_activate: due.length,
      members_to_activate: memberIds.length,
      memberships_activated: 0,
      members_activated: 0,
      due,
      error: e1.message,
    };
  }

  let membersActivated = 0;
  if (memberIds.length > 0) {
    const { data: m2, error: e2 } = await supabase
      .from('members')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .in('id', memberIds)
      .eq('status', 'pending')
      .select('id');

    if (e2) {
      return {
        today,
        dry_run: false,
        memberships_to_activate: due.length,
        members_to_activate: memberIds.length,
        memberships_activated: (m1 ?? []).length,
        members_activated: 0,
        due,
        error: e2.message,
      };
    }
    membersActivated = (m2 ?? []).length;
  }

  return {
    today,
    dry_run: false,
    memberships_to_activate: due.length,
    members_to_activate: memberIds.length,
    memberships_activated: (m1 ?? []).length,
    members_activated: membersActivated,
    due,
  };
}
