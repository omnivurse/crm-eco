/**
 * GET /api/cron/activate-due-memberships
 *
 * Thin adapter: daily cron that activates real coverage on the 1st.
 * Logic lives in `@/lib/crm/member-activation` (billing adapter).
 *
 * Enrollments are intentionally LEFT at 'approved' — flipping them to 'active'
 * would fire trg_enrollment_commission a second time.
 *
 * Idempotent (status-guarded), `?dry_run=1` mutates nothing.
 * Schedule: daily 06:10 UTC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { activateBillingDue } from '@/lib/crm/member-activation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
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

  const dryRun = new URL(request.url).searchParams.get('dry_run') === '1';
  const today = new Date().toISOString().slice(0, 10);
  const sb = serviceClient();

  const result = await activateBillingDue(sb, today, { dryRun });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      today,
      memberships_to_activate: result.memberships_to_activate,
      members_to_activate: result.members_to_activate,
    });
  }

  return NextResponse.json({
    ok: true,
    today,
    memberships_activated: result.memberships_activated,
    members_activated: result.members_activated,
  });
}
