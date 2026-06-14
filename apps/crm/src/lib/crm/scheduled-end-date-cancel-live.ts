/**
 * Live application of scheduled end-date cancellation for a single record.
 * Mirrors applyAge65AutoCancelForRecord — cheap no-op when not yet due.
 */

import { createCrmClient } from '@/lib/crm/queries';
import {
  applyScheduledEndDateCancelForRecord,
  type RecordForScheduledCancel,
} from './scheduled-end-date-cancel';

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
