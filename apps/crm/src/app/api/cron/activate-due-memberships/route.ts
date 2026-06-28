/**
 * GET /api/cron/activate-due-memberships
 *
 * Daily cron that activates real coverage on the 1st. Enrollment completion
 * provisions a membership in `status='pending'` with `effective_date` = the 1st
 * of the coverage month (see finalize_member_enrollment_tx); on/after that date
 * this cron flips it live:
 *   1. memberships: pending -> active  WHERE effective_date <= today
 *   2. members:     pending -> active  for those members
 *
 * Enrollments are intentionally LEFT at 'approved' — flipping them to 'active'
 * would fire trg_enrollment_commission (auto-fire) a second time (the signup
 * commission already fired on approve). Coverage-live state is the membership's.
 *
 * Idempotent (status-guarded), org-agnostic (platform-wide), `?dry_run=1` mutates
 * nothing. Auth: Vercel cron `x-vercel-cron`, or `Bearer CRON_SECRET` for manual.
 * Schedule: daily 06:10 UTC (just after activate-pending-members).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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
  const sb = serviceClient() as unknown as { from: (t: string) => any };

  // Memberships whose coverage start has arrived but are still pending.
  const { data: due, error: dueErr } = await sb
    .from('memberships')
    .select('id, member_id, organization_id, effective_date')
    .eq('status', 'pending')
    .lte('effective_date', today);

  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  const dueMemberships = (due ?? []) as Array<{ id: string; member_id: string }>;
  const memberIds = Array.from(new Set(dueMemberships.map((m) => m.member_id).filter(Boolean)));

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      today,
      memberships_to_activate: dueMemberships.length,
      members_to_activate: memberIds.length,
    });
  }

  let membershipsActivated = 0;
  let membersActivated = 0;

  if (dueMemberships.length > 0) {
    const { data: m1, error: e1 } = await sb
      .from('memberships')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lte('effective_date', today)
      .select('id');
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    membershipsActivated = (m1 ?? []).length;

    if (memberIds.length > 0) {
      const { data: m2, error: e2 } = await sb
        .from('members')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .in('id', memberIds)
        .eq('status', 'pending')
        .select('id');
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
      membersActivated = (m2 ?? []).length;
    }
  }

  return NextResponse.json({
    ok: true,
    today,
    memberships_activated: membershipsActivated,
    members_activated: membersActivated,
  });
}
