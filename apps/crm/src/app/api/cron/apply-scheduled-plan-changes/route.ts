/**
 * GET /api/cron/apply-scheduled-plan-changes
 *
 * Thin adapter: daily cron that applies due scheduled plan changes on
 * CRM-only (Zoho-imported) records. Logic lives in
 * `@/lib/crm/scheduled-plan-change-apply`.
 *
 * Member-synced records are skipped — their plan flip runs through
 * memberships + activate-due-memberships.
 *
 * Idempotent (the scheduled_plan_change key is consumed on apply),
 * `?dry_run=1` mutates nothing. Schedule: daily 06:05 UTC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { applyScheduledPlanChanges } from '@/lib/crm/scheduled-plan-change-apply';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  return bearerAuthorised(request);
}

function bearerAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const dryRun = params.get('dry_run') === '1';

  // Rehearsal-only date override (staging): requires the CRON_SECRET bearer
  // token — the x-vercel-cron header alone can never shift the clock.
  let today = new Date().toISOString().slice(0, 10);
  const todayOverride = params.get('today');
  if (todayOverride) {
    if (!bearerAuthorised(request)) {
      return NextResponse.json({ error: 'today override requires bearer auth' }, { status: 403 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(todayOverride)) {
      return NextResponse.json({ error: 'invalid today override' }, { status: 400 });
    }
    today = todayOverride;
  }

  const result = await applyScheduledPlanChanges(serviceClient(), today, { dryRun });

  const status = result.errors.length > 0 && result.applied === 0 && !dryRun ? 500 : 200;
  return NextResponse.json(result, { status });
}
