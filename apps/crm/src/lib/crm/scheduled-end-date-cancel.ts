/**
 * Scheduled end-date cancellation — mirrors activate-pending-members for the
 * off-ramp: when an end date is set, the record stays Active until the 1st of
 * that month, then flips to Cancelled automatically.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createCrmClient } from '@/lib/crm/queries';
import {
  isScheduledCancellationDue,
  type CrmRecordEndDateInput,
} from './resolve-effective-end-date';

export type RecordForScheduledCancel = CrmRecordEndDateInput & {
  id: string;
  status: string | null;
  org_id: string;
  title: string | null;
  data: Record<string, unknown> | null;
};

export interface ScheduledCancelResult {
  cancelled: boolean;
  record_id?: string;
  effective_date?: string;
  end_date?: string;
  error?: string;
}

/** Build row updates when a past end date should flip status to Cancelled. */
export function buildScheduledCancellationUpdates(
  record: RecordForScheduledCancel,
  today: string,
): Record<string, unknown> | null {
  const check = isScheduledCancellationDue(record, today);
  if (!check.due || !check.effectiveDate) return null;

  const existingData =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? record.data
      : {};

  return {
    status: 'Cancelled',
    cancellation_date: check.effectiveDate,
    data: {
      ...existingData,
      contact_status: 'Cancelled',
      cancellation_date: check.effectiveDate,
      cancellation_reason:
        (existingData.cancellation_reason as string | undefined) ||
        'Scheduled end date reached',
      scheduled_cancel_end_date: check.endDate,
      auto_cancelled_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };
}

export async function applyScheduledEndDateCancelForRecord(
  supabase: SupabaseClient,
  record: RecordForScheduledCancel,
  today: string,
): Promise<ScheduledCancelResult> {
  const check = isScheduledCancellationDue(record, today);
  if (!check.due || !check.effectiveDate) {
    return { cancelled: false };
  }

  const cancelUpdates = buildScheduledCancellationUpdates(record, today);
  if (!cancelUpdates) {
    return { cancelled: false };
  }

  const { error: updateError } = await supabase
    .from('crm_records')
    .update(cancelUpdates)
    .eq('id', record.id);

  if (updateError) {
    return { cancelled: false, record_id: record.id, error: updateError.message };
  }

  const { error: histError } = await supabase.from('crm_stage_history').insert({
    record_id: record.id,
    org_id: record.org_id,
    from_stage: record.status,
    to_stage: 'Cancelled',
    reason: `Auto-cancelled: end date ${check.endDate} (effective ${check.effectiveDate})`,
  });

  if (histError) {
    console.error(
      `[scheduled-end-date-cancel] stage_history error for ${record.id}:`,
      histError.message,
    );
  }

  return {
    cancelled: true,
    record_id: record.id,
    effective_date: check.effectiveDate ?? undefined,
    end_date: check.endDate ?? undefined,
  };
}

/**
 * Live application of scheduled end-date cancellation for a single record
 * (record detail view). Cheap no-op when not yet due.
 */
export async function applyScheduledEndDateCancelForRecordView(
  recordId: string,
): Promise<{ cancelled: boolean; effective_date?: string } | null> {
  try {
    const supabase = await createCrmClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: record, error } = await supabase
      .from('crm_records')
      .select('id, status, org_id, data, cancellation_date, title')
      .eq('id', recordId)
      .maybeSingle();

    if (error || !record) {
      if (error) console.error('[scheduled-cancel live] fetch error:', error.message);
      return null;
    }

    const result = await applyScheduledEndDateCancelForRecord(
      supabase,
      record as RecordForScheduledCancel,
      today,
    );

    return {
      cancelled: result.cancelled,
      effective_date: result.effective_date,
    };
  } catch (err) {
    console.error('[scheduled-cancel live] unexpected error:', err);
    return null;
  }
}
