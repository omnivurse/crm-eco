/**
 * GET /api/cron/cancel-active-members
 *
 * Daily cron that auto-transitions Active contacts/members to Cancelled when
 * their scheduled end date has arrived — mirroring activate-pending-members for
 * the off-ramp.
 *
 * Rule:
 *   - Staff sets an end / cancellation / termination date on the record.
 *   - The member stays Active through the end of the prior month.
 *   - On the 1st of the month containing that end date, status → Cancelled.
 *     (e.g. end date April 15 → cancelled effective April 1.)
 *
 * Idempotent — safe to invoke repeatedly. Already-cancelled records are skipped.
 *
 * `?dry_run=1` returns counts only and mutates nothing.
 *
 * Schedule: daily at 06:15 UTC (via Vercel cron, after activate-pending-members).
 * Auth: Vercel cron sends `x-vercel-cron`; manual calls use `Bearer CRON_SECRET`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  TERMINAL_CONTACT_STATUSES,
  isEligibleForScheduledCancellation,
  isScheduledCancellationDue,
} from '@/lib/crm/resolve-effective-end-date';
import {
  applyScheduledEndDateCancelForRecord,
  type RecordForScheduledCancel,
} from '@/lib/crm/scheduled-end-date-cancel';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAGE_SIZE = 1000;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

const SELECT_COLS =
  'id, status, org_id, data, cancellation_date, title, email, owner_id';

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

  const today = new Date().toISOString().slice(0, 10);
  const dryRun = request.nextUrl.searchParams.get('dry_run') === '1';

  const { data: modules, error: moduleError } = await supabase
    .from('crm_modules')
    .select('id')
    .in('key', ['contacts', 'members']);

  if (moduleError) {
    console.error('[cancel-active-members] module fetch error:', moduleError);
    return NextResponse.json({ error: moduleError.message }, { status: 500 });
  }

  const moduleIds = (modules ?? []).map((m) => m.id);
  if (moduleIds.length === 0) {
    return NextResponse.json({ cancelled: 0, message: 'No contacts/members modules found' });
  }

  let scanned = 0;
  let eligible = 0;
  const cancelled: Array<{
    record_id: string;
    end_date: string;
    effective_date: string;
  }> = [];
  const errors: string[] = [];
  const dryRunSample: Array<{
    id: string;
    status: string | null;
    end_date: string;
    effective_date: string;
  }> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error: fetchError } = await supabase
      .from('crm_records')
      .select(SELECT_COLS)
      .in('module_id', moduleIds)
      .not('status', 'in', `(${[...TERMINAL_CONTACT_STATUSES].map((s) => `"${s}"`).join(',')})`)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (fetchError) {
      console.error('[cancel-active-members] fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!page || page.length === 0) break;
    scanned += page.length;

    for (const raw of page as RecordForScheduledCancel[]) {
      if (!isEligibleForScheduledCancellation(raw.status)) continue;
      const check = isScheduledCancellationDue(raw, today);
      if (!check.due || !check.effectiveDate || !check.endDate) continue;

      eligible++;
      if (dryRun) {
        if (dryRunSample.length < 25) {
          dryRunSample.push({
            id: raw.id,
            status: raw.status,
            end_date: check.endDate,
            effective_date: check.effectiveDate,
          });
        }
        continue;
      }

      const result = await applyScheduledEndDateCancelForRecord(supabase, raw, today);
      if (result.cancelled && result.record_id && result.effective_date && result.end_date) {
        cancelled.push({
          record_id: result.record_id,
          end_date: result.end_date,
          effective_date: result.effective_date,
        });
      } else if (result.error) {
        errors.push(`${raw.id}: ${result.error}`);
      }
    }

    if (page.length < PAGE_SIZE) break;
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      today,
      active_scanned: scanned,
      would_cancel: eligible,
      sample: dryRunSample,
    });
  }

  console.log(
    `[cancel-active-members] cancelled ${cancelled.length}/${eligible} eligible ` +
      `(${scanned} active scanned)`,
  );

  return NextResponse.json({
    cancelled: cancelled.length,
    eligible,
    active_scanned: scanned,
    records: cancelled,
    errors: errors.length > 0 ? errors : undefined,
  });
}
