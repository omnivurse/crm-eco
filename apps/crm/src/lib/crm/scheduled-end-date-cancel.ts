/**
 * Scheduled end-date cancellation — mirrors activate-pending-members for the
 * off-ramp: when an end date is set, the record stays Active until the 1st of
 * that month, then flips to Cancelled automatically.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
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

export async function applyScheduledEndDateCancelForRecord(
  supabase: SupabaseClient,
  record: RecordForScheduledCancel,
  today: string,
): Promise<ScheduledCancelResult> {
  const check = isScheduledCancellationDue(record, today);
  if (!check.due || !check.effectiveDate) {
    return { cancelled: false };
  }

  const existingData =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? record.data
      : {};

  const { error: updateError } = await supabase
    .from('crm_records')
    .update({
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
    })
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
    effective_date: check.effectiveDate,
    end_date: check.endDate ?? undefined,
  };
}
