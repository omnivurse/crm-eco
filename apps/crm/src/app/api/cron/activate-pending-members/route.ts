/**
 * GET /api/cron/activate-pending-members
 *
 * Daily cron that auto-transitions "Pending" healthshare/insurance members
 * to "Active" when their `current_year_start_date` (or `original_start_date`)
 * has arrived.
 *
 * Logic:
 *   - Finds records in modules with market_type 'healthshare' or
 *     'traditional_insurance' where `status` is a pending-like value
 *     and the start date is today or earlier.
 *   - Updates `status` → 'Active HS Member' (for healthshare) or
 *     'Active' (for traditional insurance).
 *   - Logs a stage_change entry in `crm_stage_history` so the timeline
 *     shows the automated activation.
 *
 * Idempotent — safe to invoke repeatedly.  Already-activated records are
 * skipped by the status filter.
 *
 * Schedule: daily at 06:00 UTC (via Vercel cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

/** Status values that indicate a member is waiting for their start date. */
const PENDING_STATUSES = [
  'Pending',
  'Pending HS Member',
  'Pending Member',
  'Enrolled',
  'Enrolled - Pending Start',
];

/** Map market_type → the active status to set. */
const ACTIVE_STATUS_MAP: Record<string, string> = {
  healthshare: 'Active HS Member',
  traditional_insurance: 'Active',
};

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Service role unavailable' }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Find records with a pending status whose start date has arrived
  const { data: pendingRecords, error: fetchError } = await supabase
    .from('crm_records')
    .select('id, status, market_type, current_year_start_date, original_start_date, organization_id')
    .in('status', PENDING_STATUSES)
    .in('market_type', ['healthshare', 'traditional_insurance'])
    .or(`current_year_start_date.lte.${today},original_start_date.lte.${today}`)
    .is('deleted_at', null)
    .limit(500);

  if (fetchError) {
    console.error('[activate-pending-members] fetch error:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pendingRecords || pendingRecords.length === 0) {
    return NextResponse.json({ activated: 0, message: 'No pending members to activate' });
  }

  let activated = 0;
  const errors: string[] = [];

  for (const record of pendingRecords) {
    const newStatus = ACTIVE_STATUS_MAP[record.market_type] ?? 'Active';
    const oldStatus = record.status;

    // Check: the effective start date must actually be today or earlier
    const startDate = record.current_year_start_date || record.original_start_date;
    if (!startDate || startDate > today) continue;

    // Update the record status
    const { error: updateError } = await supabase
      .from('crm_records')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    if (updateError) {
      console.error(`[activate-pending-members] update error for ${record.id}:`, updateError);
      errors.push(`${record.id}: ${updateError.message}`);
      continue;
    }

    // Log stage history for the timeline
    await supabase.from('crm_stage_history').insert({
      record_id: record.id,
      organization_id: record.organization_id,
      from_stage: oldStatus,
      to_stage: newStatus,
      reason: `Auto-activated: start date ${startDate} has arrived`,
      // No user — system automation
    });

    activated++;
  }

  console.log(`[activate-pending-members] activated ${activated}/${pendingRecords.length} records`);

  return NextResponse.json({
    activated,
    total_eligible: pendingRecords.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
