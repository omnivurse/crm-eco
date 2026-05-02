/**
 * Live application of the HealthShare age-65 auto-cancellation rule.
 *
 * The rule itself lives in the SQL function `apply_age_65_auto_cancellation`
 * (migration 202605060009). The function is idempotent and filters internally
 * — it only updates a record when:
 *   - module is contacts or members
 *   - market_type = 'healthshare'
 *   - data.date_of_birth is set + ISO-shaped
 *   - the 1st of the birthday month for age 65 has arrived
 *   - status is not already Cancelled / Terminated
 *   - data.age_65_cancel_override is not true
 *
 * Calling for non-eligible records is harmless (zero rows updated). The cost
 * is one round-trip per record view, which is fine — the function returns in
 * single-digit ms when the record is ineligible, and only does work the first
 * time someone visits a newly-eligible record.
 *
 * Reps still get the email via the daily Vercel cron at /api/cron/age-65-cancellations
 * — that drains the outbox table that this function writes to.
 */

import { createCrmClient } from '@/lib/crm/queries';

interface ApplyResult {
  count: number;
  cancelled: Array<{
    record_id: string;
    member_name: string | null;
    cancellation_date: string;
  }>;
}

export async function applyAge65AutoCancelForRecord(
  recordId: string,
): Promise<ApplyResult | null> {
  try {
    const supabase = await createCrmClient();
    const { data, error } = await supabase.rpc('apply_age_65_auto_cancellation', {
      p_record_id: recordId,
    });
    if (error) {
      console.error('[age-65 live] RPC error:', error.message);
      return null;
    }
    return data as ApplyResult;
  } catch (err) {
    console.error('[age-65 live] unexpected error:', err);
    return null;
  }
}
