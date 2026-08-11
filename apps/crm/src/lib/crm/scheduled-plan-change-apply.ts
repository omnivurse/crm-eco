/**
 * Scheduled plan change (CRM-record lane) — for Zoho-imported records that
 * exist only as crm_records (no members/memberships rows). Staff logs a
 * future-dated plan change in MembershipChangeHistory, which stores a
 * machine-readable `data.scheduled_plan_change`; on the effective date this
 * job flips the flat plan fields, marks the membership_changes entry applied,
 * and completes the linked follow-up task.
 *
 * Member-synced records (system->>'synced' = 'true') are NEVER touched here:
 * sync_member_to_crm_records replaces their `data` wholesale, so their plan
 * flip flows through memberships + the activate-due-memberships cron instead.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ScheduledPlanChange {
  change_id?: string;
  /** YYYY-MM-DD — the day the new plan starts. */
  effective_date?: string;
  to_plan?: string;
  to_iua?: string;
  to_monthly?: string;
  from_plan?: string;
  from_iua?: string;
  from_monthly?: string;
  scheduled_at?: string;
  scheduled_by?: string;
}

export type RecordForScheduledPlanChange = {
  id: string;
  org_id: string;
  title: string | null;
  data: Record<string, unknown> | null;
  system: Record<string, unknown> | null;
};

export interface ScheduledPlanChangeApplyResult {
  today: string;
  dry_run: boolean;
  scanned: number;
  skipped_synced: number;
  would_apply: number;
  applied: number;
  tasks_completed: number;
  errors: string[];
  sample: { record_id: string; to_plan?: string; effective_date?: string }[];
}

/** Keys that may carry the record's monthly amount — flip whichever exist. */
const MONTHLY_KEYS = [
  'monthly_contribution',
  'monthly_premium',
  'monthly_amount',
  'monthly_share',
  'monthly_rate',
] as const;

export function parseScheduledPlanChange(
  data: Record<string, unknown> | null,
): ScheduledPlanChange | null {
  const raw = data?.scheduled_plan_change;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const spc = raw as ScheduledPlanChange;
  if (!spc.effective_date || !/^\d{4}-\d{2}-\d{2}$/.test(spc.effective_date)) return null;
  return spc;
}

/**
 * True when the record's plan is really managed by the MMS/billing side —
 * either the member-sync projection (system.synced, whose `data` gets replaced
 * wholesale by the sync trigger) or a twin record bridged to a members row via
 * data.linked_member_id (whose billing lives in memberships). Both must go
 * through the Member Command Center, never this flat-field lane.
 */
export function isRecordSyncedToMember(record: {
  system: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
}): boolean {
  if (record.system?.synced === true || record.system?.synced === 'true') return true;
  const linked = record.data?.linked_member_id;
  return typeof linked === 'string' && linked.length > 0;
}

/**
 * Compute the record update that applies a due scheduled plan change.
 * Returns null when nothing is due. Pure — no I/O.
 */
export function buildScheduledPlanChangeUpdates(
  record: RecordForScheduledPlanChange,
  today: string,
): { updates: Record<string, unknown>; followUpTaskId: string | null; spc: ScheduledPlanChange } | null {
  const spc = parseScheduledPlanChange(record.data);
  if (!spc || spc.effective_date! > today) return null;
  if (isRecordSyncedToMember(record)) return null;

  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? { ...record.data }
      : {};

  const oldProduct =
    (data.product as string | undefined) || (data.plan_name as string | undefined) || undefined;
  const oldIua =
    (data.iua_amount as string | undefined) || (data.iua as string | undefined) || undefined;
  const oldMonthly =
    MONTHLY_KEYS.map((k) => data[k] as string | undefined).find((v) => v != null && v !== '') ??
    undefined;

  // Flip the flat plan fields. start_date / original_start_date / any end-date
  // key stay untouched (the cancel cron must never see this as a termination).
  if (oldProduct) data.previous_product = oldProduct;
  if (spc.to_plan) {
    data.product = spc.to_plan;
    if (data.plan_name != null) data.plan_name = spc.to_plan;
  }
  if (spc.to_iua) {
    data.iua_amount = spc.to_iua;
    if (data.iua != null) data.iua = spc.to_iua;
  }
  if (spc.to_monthly) {
    const present = MONTHLY_KEYS.filter((k) => data[k] != null && data[k] !== '');
    for (const k of present) data[k] = spc.to_monthly;
    if (present.length === 0) data.monthly_contribution = spc.to_monthly;
  }
  data.sharing_effective_date = spc.effective_date;

  // Mark the audit entry applied (and backfill from_* if staff left them blank).
  let followUpTaskId: string | null = null;
  const changes = Array.isArray(data.membership_changes)
    ? [...(data.membership_changes as Record<string, unknown>[])]
    : [];
  const idx = changes.findIndex((c) => c && c.id === spc.change_id);
  if (idx >= 0) {
    const entry = { ...changes[idx] };
    if (!entry.from_plan && oldProduct) entry.from_plan = oldProduct;
    if (!entry.from_iua && oldIua) entry.from_iua = oldIua;
    if (!entry.from_monthly && oldMonthly) entry.from_monthly = oldMonthly;
    entry.change_status = 'applied';
    entry.applied_at = new Date().toISOString();
    changes[idx] = entry;
    data.membership_changes = changes;
    followUpTaskId = (entry.follow_up_task_id as string | undefined) ?? null;
  }

  delete data.scheduled_plan_change;

  return {
    updates: { data, updated_at: new Date().toISOString() },
    followUpTaskId,
    spc,
  };
}

export async function applyScheduledPlanChanges(
  supabase: SupabaseClient,
  today: string,
  opts: { dryRun?: boolean } = {},
): Promise<ScheduledPlanChangeApplyResult> {
  const dryRun = Boolean(opts.dryRun);
  const result: ScheduledPlanChangeApplyResult = {
    today,
    dry_run: dryRun,
    scanned: 0,
    skipped_synced: 0,
    would_apply: 0,
    applied: 0,
    tasks_completed: 0,
    errors: [],
    sample: [],
  };

  const { data: records, error } = await supabase
    .from('crm_records')
    .select('id, org_id, title, data, system')
    .not('data->scheduled_plan_change', 'is', null)
    .lte('data->scheduled_plan_change->>effective_date', today);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  for (const record of (records ?? []) as RecordForScheduledPlanChange[]) {
    result.scanned += 1;

    if (isRecordSyncedToMember(record)) {
      result.skipped_synced += 1;
      continue;
    }

    const built = buildScheduledPlanChangeUpdates(record, today);
    if (!built) continue;

    result.would_apply += 1;
    if (result.sample.length < 10) {
      result.sample.push({
        record_id: record.id,
        to_plan: built.spc.to_plan,
        effective_date: built.spc.effective_date,
      });
    }

    if (dryRun) continue;

    const { error: updateError } = await supabase
      .from('crm_records')
      .update(built.updates)
      .eq('id', record.id);

    if (updateError) {
      result.errors.push(`record ${record.id}: ${updateError.message}`);
      continue;
    }
    result.applied += 1;

    if (built.followUpTaskId) {
      // org-scoped: follow_up_task_id comes from user-writable JSONB, so the
      // service-role update must never reach another tenant's task.
      const { error: taskError } = await supabase
        .from('crm_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', built.followUpTaskId)
        .eq('org_id', record.org_id)
        .eq('record_id', record.id)
        .in('status', ['open', 'in_progress']);
      if (taskError) {
        result.errors.push(`task ${built.followUpTaskId}: ${taskError.message}`);
      } else {
        result.tasks_completed += 1;
      }
    }
  }

  return result;
}
