/**
 * Unified membership change — current + upcoming, not two current products.
 *
 * CRM-only records: `data.membership_changes` + `data.scheduled_plan_change`
 * (apply-scheduled-plan-changes cron flips fields on the effective date).
 *
 * MMS-linked records with an active core membership: same CRM keys for the
 * card, plus `staffSchedulePlanChange` / `staffChangePlan`. The CRM apply
 * cron still skips synced rows; activate-due-memberships projects fields.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  staffCancelScheduledPlanChange,
  staffChangePlan,
  staffSchedulePlanChange,
  membershipLayerOf,
  type StaffCoverageContext,
} from '@crm-eco/lib';
import { localTodayIso } from '@/lib/crm/plan-change-follow-up';
import {
  applyPlanChangeFieldsToData,
  isRecordSyncedToMember,
  parseScheduledPlanChange,
  type ScheduledPlanChange,
} from '@/lib/crm/scheduled-plan-change-apply';

export const SCHEDULABLE_MEMBERSHIP_CHANGE_TYPES = [
  'upgrade',
  'downgrade',
  'lateral',
] as const;

export type MembershipChangeType =
  | 'upgrade'
  | 'downgrade'
  | 'lateral'
  | 'enrollment'
  | 'cancellation';

export interface MembershipChangeEntry {
  id: string;
  date: string;
  type: MembershipChangeType;
  from_plan?: string;
  to_plan?: string;
  from_iua?: string;
  to_iua?: string;
  from_monthly?: string;
  to_monthly?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  follow_up_task_id?: string;
  change_status?: 'scheduled' | 'applied';
  applied_at?: string;
  plan_id?: string;
}

export type ScheduleMembershipLane = 'crm' | 'mms' | 'crm_immediate' | 'mms_immediate';

export interface BillingPlanOption {
  id: string;
  name: string;
  code: string | null;
  monthly_share: number | null;
  iua_amount: number | null;
}

export interface ScheduleMembershipChangeInput {
  type: MembershipChangeType;
  effective_date: string;
  to_plan?: string;
  to_iua?: string;
  to_monthly?: string;
  from_plan?: string;
  from_iua?: string;
  from_monthly?: string;
  notes?: string;
  plan_id?: string;
  change_id?: string;
  follow_up_task_id?: string;
  created_at?: string;
  created_by?: string;
}

export interface ScheduleMembershipChangeResult {
  ok: true;
  lane: ScheduleMembershipLane;
  data: Record<string, unknown>;
  warning?: string;
  mms_membership_id?: string;
}

export interface ScheduleMembershipChangeFailure {
  ok: false;
  error: string;
  plans?: BillingPlanOption[];
}

export interface LinkedMemberIdentity {
  id: string;
  member_number?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isSchedulableMembershipChangeType(
  type: string,
): type is (typeof SCHEDULABLE_MEMBERSHIP_CHANGE_TYPES)[number] {
  return (SCHEDULABLE_MEMBERSHIP_CHANGE_TYPES as readonly string[]).includes(type);
}

export function generateMembershipChangeId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Fold Care+ / Care Plus / Secure HSA 2024 (42644) into a lookup token. */
export function normalizePlanLookup(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/20\d{2}/g, ' ')
    .replace(/care\s*\+/g, 'careplus')
    .replace(/care\s*plus/g, 'careplus')
    .replace(/secure\s*hsa/g, 'securehsa')
    .replace(/[^a-z0-9]+/g, '');
}

export function resolvePlanFromCatalog(
  plans: BillingPlanOption[],
  input: { plan_id?: string; to_plan?: string },
): { ok: true; plan: BillingPlanOption } | { ok: false; error: string } {
  if (input.plan_id) {
    const hit = plans.find((p) => p.id === input.plan_id);
    if (!hit) return { ok: false, error: 'That plan is not in this organization.' };
    return { ok: true, plan: hit };
  }
  const needle = normalizePlanLookup(input.to_plan ?? '');
  if (!needle) return { ok: false, error: 'A destination plan is required.' };
  const matches = plans.filter((p) => {
    const n = normalizePlanLookup(p.name);
    const c = normalizePlanLookup(p.code ?? '');
    return n === needle || c === needle || n.includes(needle) || needle.includes(n);
  });
  if (matches.length === 1) return { ok: true, plan: matches[0] };
  if (matches.length === 0) {
    return {
      ok: false,
      error: `No billing plan matches "${input.to_plan}". Pick a plan from the catalog.`,
    };
  }
  return {
    ok: false,
    error: `Several billing plans match "${input.to_plan}". Pick one from the catalog.`,
  };
}

export function currentPlanFieldsFromData(data: Record<string, unknown> | null): {
  product?: string;
  iua?: string;
  monthly?: string;
} {
  const d = data ?? {};
  const product =
    (typeof d.product === 'string' && d.product) ||
    (typeof d.plan_name === 'string' && d.plan_name) ||
    (typeof d.product_type === 'string' && d.product_type) ||
    undefined;
  const iua =
    (d.iua_amount != null && String(d.iua_amount)) ||
    (d.iua != null && String(d.iua)) ||
    undefined;
  const monthly =
    (d.monthly_contribution != null && String(d.monthly_contribution)) ||
    (d.monthly_premium != null && String(d.monthly_premium)) ||
    (d.monthly_amount != null && String(d.monthly_amount)) ||
    undefined;
  return { product, iua, monthly };
}

function normalizeIdentityText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeIdentityPhone(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

/**
 * `linked_member_id` is mutable CRM JSON, so it cannot be the only evidence
 * used before a service-role billing mutation. Require member-number parity,
 * or matching first/last name plus an email/phone identifier.
 */
export function linkedMemberMatchesRecord(
  member: LinkedMemberIdentity,
  record: {
    email?: string | null;
    phone?: string | null;
    data: Record<string, unknown> | null;
  },
): boolean {
  const data = record.data ?? {};
  if (data.linked_member_id !== member.id) return false;

  const memberNumber = normalizeIdentityText(member.member_number);
  const recordMemberNumber = normalizeIdentityText(data.member_number);
  if (memberNumber && recordMemberNumber) return memberNumber === recordMemberNumber;

  const firstMatches =
    normalizeIdentityText(member.first_name) !== '' &&
    normalizeIdentityText(member.first_name) === normalizeIdentityText(data.first_name);
  const lastMatches =
    normalizeIdentityText(member.last_name) !== '' &&
    normalizeIdentityText(member.last_name) === normalizeIdentityText(data.last_name);
  if (!firstMatches || !lastMatches) return false;

  const memberEmail = normalizeIdentityText(member.email);
  const recordEmails = [
    normalizeIdentityText(record.email),
    normalizeIdentityText(data.email),
  ].filter(Boolean);
  if (memberEmail && recordEmails.includes(memberEmail)) return true;

  const memberPhone = normalizeIdentityPhone(member.phone);
  const recordPhones = [
    normalizeIdentityPhone(record.phone),
    normalizeIdentityPhone(data.phone),
  ].filter(Boolean);
  return Boolean(memberPhone && recordPhones.includes(memberPhone));
}

export function buildMembershipChangeEntry(
  input: ScheduleMembershipChangeInput,
  opts: { scheduled: boolean; nowIso?: string },
): MembershipChangeEntry {
  const entry: MembershipChangeEntry = {
    id: input.change_id || generateMembershipChangeId(),
    date: input.effective_date,
    type: input.type,
    created_at: input.created_at ?? opts.nowIso ?? new Date().toISOString(),
    ...(input.created_by && { created_by: input.created_by }),
    ...(input.from_plan && { from_plan: input.from_plan }),
    ...(input.to_plan && { to_plan: input.to_plan }),
    ...(input.from_iua && { from_iua: input.from_iua }),
    ...(input.to_iua && { to_iua: input.to_iua }),
    ...(input.from_monthly && { from_monthly: input.from_monthly }),
    ...(input.to_monthly && { to_monthly: input.to_monthly }),
    ...(input.notes && { notes: input.notes }),
    ...(input.follow_up_task_id && { follow_up_task_id: input.follow_up_task_id }),
    ...(input.plan_id && { plan_id: input.plan_id }),
  };
  if (opts.scheduled) entry.change_status = 'scheduled';
  return entry;
}

export function upsertMembershipChange(
  existing: unknown,
  next: MembershipChangeEntry,
): MembershipChangeEntry[] {
  const arr = Array.isArray(existing)
    ? [...(existing as MembershipChangeEntry[])]
    : [];
  const idx = arr.findIndex((c) => c && c.id === next.id);
  let merged = arr;
  if (idx >= 0) merged[idx] = next;
  else merged = [...arr, next];
  if (next.change_status === 'scheduled') {
    merged = merged.map((c) =>
      c.id !== next.id && c.change_status === 'scheduled'
        ? (({ change_status: _drop, ...rest }) => rest as MembershipChangeEntry)(c)
        : c,
    );
  }
  return merged;
}

export function buildScheduledPlanChangeObject(
  change: MembershipChangeEntry,
  extra?: { mms_membership_id?: string; scheduled_by?: string },
): ScheduledPlanChange {
  return {
    change_id: change.id,
    effective_date: change.date,
    ...(change.to_plan && { to_plan: change.to_plan }),
    ...(change.to_iua && { to_iua: change.to_iua }),
    ...(change.to_monthly && { to_monthly: change.to_monthly }),
    ...(change.from_plan && { from_plan: change.from_plan }),
    ...(change.from_iua && { from_iua: change.from_iua }),
    ...(change.from_monthly && { from_monthly: change.from_monthly }),
    scheduled_at: new Date().toISOString(),
    ...(extra?.scheduled_by && { scheduled_by: extra.scheduled_by }),
    ...(extra?.mms_membership_id && { mms_membership_id: extra.mms_membership_id }),
  };
}

export function buildCancelScheduledChangeData(
  data: Record<string, unknown> | null,
): {
  data: Record<string, unknown>;
  mmsMembershipId: string | null;
  changeId: string | null;
} {
  const next = data && typeof data === 'object' ? { ...data } : {};
  const spc = parseScheduledPlanChange(next);
  const mmsMembershipId = spc?.mms_membership_id ?? null;
  const changeId = spc?.change_id ?? null;
  if (changeId && Array.isArray(next.membership_changes)) {
    next.membership_changes = (next.membership_changes as MembershipChangeEntry[]).map((c) => {
      if (!c || c.id !== changeId || c.change_status !== 'scheduled') return c;
      const { change_status: _drop, ...rest } = c;
      return rest as MembershipChangeEntry;
    });
  }
  delete next.scheduled_plan_change;
  return { data: next, mmsMembershipId, changeId };
}

/**
 * Apply only the keys this operation changed onto a freshly-read CRM blob.
 * This preserves unrelated inline edits and member-sync projections that land
 * while the service-role membership operation is running.
 */
export function mergeChangedCrmData(
  original: Record<string, unknown>,
  desired: Record<string, unknown>,
  latest: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...latest };
  const touchedKeys = new Set([...Object.keys(original), ...Object.keys(desired)]);
  for (const key of touchedKeys) {
    if (JSON.stringify(original[key]) === JSON.stringify(desired[key])) continue;
    if (Object.prototype.hasOwnProperty.call(desired, key)) {
      merged[key] = desired[key];
    } else {
      delete merged[key];
    }
  }
  return merged;
}

export function pickActiveCoreMembership(
  rows: Array<{
    id: string;
    status: string;
    layer?: string | null;
    custom_fields?: unknown;
  }>,
): { id: string } | null {
  const active = rows.filter((row) => row.status === 'active');
  const core =
    active.find((row) => membershipLayerOf(row) === 'core') ?? active[0] ?? null;
  return core ? { id: core.id } : null;
}

export async function listOrgCorePlans(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<BillingPlanOption[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('id, name, code, monthly_share, iua_amount')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name');
  if (error || !data) return [];
  return (data as BillingPlanOption[]).filter((p) => p.id && p.name);
}

export async function loadActiveCoreMembership(
  supabase: SupabaseClient,
  args: { organizationId: string; memberId: string },
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from('memberships')
    .select('id, status, layer, custom_fields')
    .eq('member_id', args.memberId)
    .eq('organization_id', args.organizationId)
    .eq('status', 'active');
  return pickActiveCoreMembership((data ?? []) as Array<{
    id: string;
    status: string;
    layer?: string | null;
    custom_fields?: unknown;
  }>);
}

export async function executeScheduleMembershipChange(args: {
  userSupabase: SupabaseClient;
  staffCtx: StaffCoverageContext | null;
  organizationId: string;
  profileId: string;
  record: {
    id: string;
    email?: string | null;
    phone?: string | null;
    updated_at?: string | null;
    data: Record<string, unknown> | null;
    system: Record<string, unknown> | null;
  };
  input: ScheduleMembershipChangeInput;
  today?: string;
}): Promise<ScheduleMembershipChangeResult | ScheduleMembershipChangeFailure> {
  const { input, organizationId, profileId, record, userSupabase } = args;
  if (!DATE_RE.test(input.effective_date)) {
    return { ok: false, error: 'Effective date must be YYYY-MM-DD.' };
  }
  if (!input.type) return { ok: false, error: 'A change type is required.' };

  const today = args.today ?? localTodayIso();
  const data = record.data && typeof record.data === 'object' ? { ...record.data } : {};
  const current = currentPlanFieldsFromData(data);
  const filled: ScheduleMembershipChangeInput = {
    ...input,
    from_plan: input.from_plan || current.product,
    from_iua: input.from_iua || current.iua,
    from_monthly: input.from_monthly || current.monthly,
  };

  const schedulable =
    isSchedulableMembershipChangeType(filled.type) && filled.effective_date > today;
  const immediate =
    isSchedulableMembershipChangeType(filled.type) && filled.effective_date <= today;

  const linked = isRecordSyncedToMember({ system: record.system, data });
  const memberId =
    typeof data.linked_member_id === 'string' && data.linked_member_id
      ? data.linked_member_id
      : null;

  let lane: ScheduleMembershipLane = schedulable ? 'crm' : immediate ? 'crm_immediate' : 'crm';
  let mmsMembershipId: string | undefined;
  let resolvedPlanName = filled.to_plan;

  if (linked && isSchedulableMembershipChangeType(filled.type)) {
    if (!memberId || !args.staffCtx) {
      return {
        ok: false,
        error: 'This synced record cannot safely schedule a billing plan change.',
      };
    }
    if (
      record.system?.source_table === 'members' ||
      record.system?.synced === true ||
      record.system?.synced === 'true'
    ) {
      return {
        ok: false,
        error: 'Manage plan changes from the Member Command Center for this synced record.',
      };
    }

    const { data: member, error: memberError } = await args.staffCtx.supabase
      .from('members')
      .select('id, member_number, email, phone, first_name, last_name')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (
      memberError ||
      !member ||
      !linkedMemberMatchesRecord(member as LinkedMemberIdentity, {
        email: record.email,
        phone: record.phone,
        data,
      })
    ) {
      return {
        ok: false,
        error: 'The linked member identity does not match this CRM record.',
      };
    }

    const core = await loadActiveCoreMembership(args.staffCtx.supabase, {
      organizationId,
      memberId,
    });
    if (!core) {
      return {
        ok: false,
        error: 'This member has no active core membership to change.',
      };
    }

    const plans = await listOrgCorePlans(args.staffCtx.supabase, organizationId);
    const resolved = resolvePlanFromCatalog(plans, {
      plan_id: filled.plan_id,
      to_plan: filled.to_plan,
    });
    if (!resolved.ok) {
      return { ok: false, error: resolved.error, plans };
    }
    resolvedPlanName = resolved.plan.name;
    filled.to_plan = resolved.plan.name;
    filled.plan_id = resolved.plan.id;
    if (resolved.plan.monthly_share != null && !filled.to_monthly) {
      filled.to_monthly = String(resolved.plan.monthly_share);
    }
    if (resolved.plan.iua_amount != null && !filled.to_iua) {
      filled.to_iua = String(resolved.plan.iua_amount);
    }

    if (schedulable) {
      const scheduled = await staffSchedulePlanChange(args.staffCtx, {
        member_id: memberId,
        plan_id: resolved.plan.id,
        effective_date: filled.effective_date,
        reason: filled.notes,
      });
      if (!scheduled.success) {
        return { ok: false, error: scheduled.error ?? 'Could not schedule the billing plan change.' };
      }
      mmsMembershipId = scheduled.data?.membershipId;
      lane = 'mms';
    } else if (immediate) {
      const changed = await staffChangePlan(args.staffCtx, {
        member_id: memberId,
        membership_id: core.id,
        plan_id: resolved.plan.id,
        effective_date: filled.effective_date,
      });
      if (!changed.success) {
        return { ok: false, error: changed.error ?? 'Could not change the billing plan.' };
      }
      lane = 'mms_immediate';
    }
  }

  const change = buildMembershipChangeEntry(
    { ...filled, to_plan: resolvedPlanName || filled.to_plan },
    { scheduled: schedulable },
  );

  let nextData: Record<string, unknown> = {
    ...data,
    membership_changes: upsertMembershipChange(data.membership_changes, change),
  };

  if (schedulable) {
    nextData.scheduled_plan_change = buildScheduledPlanChangeObject(change, {
      mms_membership_id: mmsMembershipId,
      scheduled_by: profileId,
    });
  } else if (immediate) {
    const applied = applyPlanChangeFieldsToData(nextData, {
      change_id: change.id,
      effective_date: change.date,
      to_plan: change.to_plan,
      to_iua: change.to_iua,
      to_monthly: change.to_monthly,
    });
    nextData = applied.data;
    if (lane === 'crm') lane = 'crm_immediate';
  } else {
    delete nextData.scheduled_plan_change;
  }

  const { data: latestRecord, error: latestError } = await userSupabase
    .from('crm_records')
    .select('data, updated_at')
    .eq('id', record.id)
    .eq('org_id', organizationId)
    .maybeSingle();
  if (latestError || !latestRecord) {
    if (schedulable && mmsMembershipId && memberId && args.staffCtx) {
      const rollback = await staffCancelScheduledPlanChange(args.staffCtx, {
        member_id: memberId,
        pending_membership_id: mmsMembershipId,
      });
      if (!rollback.success) {
        return {
          ok: false,
          error: `${latestError?.message ?? 'The CRM record is no longer available.'} Billing rollback also failed: ${rollback.error ?? 'unknown error'}`,
        };
      }
    }
    return {
      ok: false,
      error: latestError?.message ?? 'The CRM record is no longer available.',
    };
  }
  nextData = mergeChangedCrmData(
    data,
    nextData,
    (latestRecord.data as Record<string, unknown> | null) ?? {},
  );

  let updateQuery = userSupabase
    .from('crm_records')
    .update({ data: nextData, updated_at: new Date().toISOString() })
    .eq('id', record.id)
    .eq('org_id', organizationId);
  if (latestRecord.updated_at) {
    updateQuery = updateQuery.eq('updated_at', latestRecord.updated_at);
  }
  const { data: updatedRecord, error: updateError } = await updateQuery
    .select('data')
    .maybeSingle();

  if (updateError || !updatedRecord) {
    // Scheduling mutates MMS first. If the optimistic CRM write loses a race
    // or fails, remove the pending membership and restore the outgoing end
    // date so billing never proceeds with an invisible CRM schedule.
    if (schedulable && mmsMembershipId && memberId && args.staffCtx) {
      const rollback = await staffCancelScheduledPlanChange(args.staffCtx, {
        member_id: memberId,
        pending_membership_id: mmsMembershipId,
      });
      if (!rollback.success) {
        return {
          ok: false,
          error: `${updateError?.message ?? 'The CRM record changed while scheduling.'} Billing rollback also failed: ${rollback.error ?? 'unknown error'}`,
        };
      }
    }
    return {
      ok: false,
      error: updateError?.message ?? 'The CRM record changed while scheduling. Please retry.',
    };
  }
  nextData = (updatedRecord.data as Record<string, unknown> | null) ?? nextData;

  return {
    ok: true,
    lane,
    data: nextData,
    ...(mmsMembershipId && { mms_membership_id: mmsMembershipId }),
  };
}

export async function executeCancelScheduledMembershipChange(args: {
  userSupabase: SupabaseClient;
  staffCtx: StaffCoverageContext | null;
  organizationId: string;
  record: {
    id: string;
    updated_at?: string | null;
    data: Record<string, unknown> | null;
    system: Record<string, unknown> | null;
  };
}): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const originalData =
    args.record.data && typeof args.record.data === 'object'
      ? { ...args.record.data }
      : {};
  const cancelled = buildCancelScheduledChangeData(originalData);
  const memberId =
    typeof args.record.data?.linked_member_id === 'string'
      ? args.record.data.linked_member_id
      : null;

  if (cancelled.mmsMembershipId && memberId && args.staffCtx) {
    const result = await staffCancelScheduledPlanChange(args.staffCtx, {
      member_id: memberId,
      pending_membership_id: cancelled.mmsMembershipId,
    });
    if (!result.success) {
      return { ok: false, error: result.error ?? 'Could not cancel the billing plan change.' };
    }
  }

  let expectedUpdatedAt = args.record.updated_at;
  const { data: latestBeforeCancel } = await args.userSupabase
    .from('crm_records')
    .select('data, updated_at')
    .eq('id', args.record.id)
    .eq('org_id', args.organizationId)
    .maybeSingle();
  if (latestBeforeCancel) {
    cancelled.data = mergeChangedCrmData(
      originalData,
      cancelled.data,
      (latestBeforeCancel.data as Record<string, unknown> | null) ?? {},
    );
    expectedUpdatedAt = latestBeforeCancel.updated_at;
  }

  let updateQuery = args.userSupabase
    .from('crm_records')
    .update({ data: cancelled.data, updated_at: new Date().toISOString() })
    .eq('id', args.record.id)
    .eq('org_id', args.organizationId);
  if (expectedUpdatedAt) {
    updateQuery = updateQuery.eq('updated_at', expectedUpdatedAt);
  }
  const { data: updatedRecord, error } = await updateQuery
    .select('data')
    .maybeSingle();

  if (error || !updatedRecord) {
    // MMS cancellation already succeeded. Merge the cancellation into the
    // latest CRM JSON through the service client so concurrent unrelated edits
    // survive and the UI cannot keep showing a plan that will no longer apply.
    if (cancelled.mmsMembershipId && args.staffCtx) {
      const { data: latest, error: latestError } = await args.staffCtx.supabase
        .from('crm_records')
        .select('data, updated_at')
        .eq('id', args.record.id)
        .eq('org_id', args.organizationId)
        .maybeSingle();
      if (!latestError && latest) {
        const converged = buildCancelScheduledChangeData(
          (latest.data as Record<string, unknown> | null) ?? null,
        ).data;
        let convergeQuery = args.staffCtx.supabase
          .from('crm_records')
          .update({ data: converged, updated_at: new Date().toISOString() })
          .eq('id', args.record.id)
          .eq('org_id', args.organizationId);
        if (latest.updated_at) {
          convergeQuery = convergeQuery.eq('updated_at', latest.updated_at);
        }
        const { data: convergedRecord, error: convergeError } = await convergeQuery
          .select('data')
          .maybeSingle();
        if (!convergeError && convergedRecord) {
          return {
            ok: true,
            data: (convergedRecord.data as Record<string, unknown> | null) ?? converged,
          };
        }
      }
    }
    return {
      ok: false,
      error: error?.message ?? 'The CRM record changed while cancelling. Please retry.',
    };
  }
  return {
    ok: true,
    data: (updatedRecord.data as Record<string, unknown> | null) ?? cancelled.data,
  };
}
