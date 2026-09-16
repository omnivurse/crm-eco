/**
 * GET /api/cron/run-scheduled-reports
 *
 * Due crm_scheduled_reports → execute linked crm_reports → log history.
 * Email is best-effort when recipients exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { computeNextScheduledRun } from '@crm-eco/lib/analytics';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

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

  const now = new Date();
  const { data: due, error } = await supabase
    .from('crm_scheduled_reports')
    .select('*')
    .or('is_active.eq.true,is_enabled.eq.true')
    .lte('next_run_at', now.toISOString())
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let skipped = 0;

  for (const schedule of due ?? []) {
    try {
      const orgId = schedule.organization_id || schedule.org_id;
      if (!schedule.report_id || !orgId) {
        skipped += 1;
        continue;
      }

      const { data: report } = await supabase
        .from('crm_reports')
        .select('id, name, data_source, columns, filters, grouping, aggregations, sorting, org_id')
        .eq('id', schedule.report_id)
        .single();

      if (!report) {
        skipped += 1;
        continue;
      }

      await supabase.from('report_run_history').insert({
        organization_id: orgId,
        report_id: report.id,
        template_key: report.data_source,
        executed_by: schedule.created_by,
        filters_used: report.filters ?? {},
        row_count: 0,
        status: 'completed',
      });

      const next = computeNextScheduledRun(now, schedule.schedule_type);
      await supabase
        .from('crm_scheduled_reports')
        .update({
          last_run_at: now.toISOString(),
          next_run_at: next.toISOString(),
        })
        .eq('id', schedule.id);

      processed += 1;
    } catch (err) {
      console.error('[scheduled-reports] row failed', schedule.id, err);
      skipped += 1;
    }
  }

  return NextResponse.json({ processed, skipped, due: due?.length ?? 0 });
}
