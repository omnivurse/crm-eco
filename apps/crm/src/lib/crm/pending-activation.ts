/**
 * Pending → Active for CRM `crm_records` (contacts/members modules).
 * Mirrors scheduled-end-date-cancel for the on-ramp: when a start date arrives,
 * status flips to market-aware Active and is audited in crm_stage_history.
 *
 * Outbox / Resend notification stays in the cron route adapter.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PENDING_CONTACT_STATUSES,
  resolveActiveStatusForMarket,
  resolveEffectiveStartDate,
  type CrmRecordStartDateInput,
} from './resolve-effective-start-date';

export type RecordForPendingActivation = CrmRecordStartDateInput & {
  id: string;
  status: string | null;
  market_type?: string | null;
  org_id: string;
  title: string | null;
  email?: string | null;
  owner_id?: string | null;
  data: Record<string, unknown> | null;
};

export interface ActivationDueCheck {
  due: boolean;
  startDate: string | null;
  newStatus: string | null;
}

export interface PendingActivationResult {
  activated: boolean;
  record_id?: string;
  start_date?: string;
  new_status?: string;
  old_status?: string | null;
  owner_id?: string | null;
  member_name?: string | null;
  member_email?: string | null;
  org_id?: string;
  error?: string;
}

export function isPendingContactStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (PENDING_CONTACT_STATUSES as readonly string[]).includes(status);
}

export function isEligibleForActivation(record: { status?: string | null }): boolean {
  return isPendingContactStatus(record.status);
}

export function isActivationDue(
  record: RecordForPendingActivation,
  today: string,
): ActivationDueCheck {
  if (!isEligibleForActivation(record)) {
    return { due: false, startDate: null, newStatus: null };
  }
  const startDate = resolveEffectiveStartDate(record);
  if (!startDate || startDate > today) {
    return { due: false, startDate, newStatus: null };
  }
  const newStatus = resolveActiveStatusForMarket(record.market_type, record.status);
  return { due: true, startDate, newStatus };
}

/** Build row updates when a start date has arrived. */
export function buildActivationUpdates(
  record: RecordForPendingActivation,
  today: string,
): Record<string, unknown> | null {
  const check = isActivationDue(record, today);
  if (!check.due || !check.newStatus) return null;

  const existingData =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? record.data
      : {};

  return {
    status: check.newStatus,
    data: { ...existingData, contact_status: check.newStatus },
    updated_at: new Date().toISOString(),
  };
}

export async function applyPendingActivationForRecord(
  supabase: SupabaseClient,
  record: RecordForPendingActivation,
  today: string,
): Promise<PendingActivationResult> {
  const check = isActivationDue(record, today);
  if (!check.due || !check.startDate || !check.newStatus) {
    return { activated: false };
  }

  const updates = buildActivationUpdates(record, today);
  if (!updates) {
    return { activated: false };
  }

  const oldStatus = record.status;
  const { error: updateError } = await supabase
    .from('crm_records')
    .update(updates)
    .eq('id', record.id);

  if (updateError) {
    return { activated: false, record_id: record.id, error: updateError.message };
  }

  // Best-effort audit; a history failure must not undo the activation.
  const { error: histError } = await supabase.from('crm_stage_history').insert({
    record_id: record.id,
    org_id: record.org_id,
    from_stage: oldStatus,
    to_stage: check.newStatus,
    reason: `Auto-activated: start date ${check.startDate} has arrived`,
  });
  if (histError) {
    console.error(
      `[pending-activation] stage_history error for ${record.id}:`,
      histError.message,
    );
  }

  return {
    activated: true,
    record_id: record.id,
    start_date: check.startDate,
    new_status: check.newStatus,
    old_status: oldStatus,
    owner_id: record.owner_id ?? null,
    member_name: record.title,
    member_email: record.email ?? null,
    org_id: record.org_id,
  };
}
