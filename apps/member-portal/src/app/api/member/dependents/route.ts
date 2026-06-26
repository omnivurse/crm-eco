import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import {
  getFamilyCoverageSummary,
} from '@/lib/data/member';

export const dynamic = 'force-dynamic';

/**
 * Returns dependents with coverage periods for the authenticated member.
 * Mutations (add/start/end/log) use server actions in /dependents/actions.ts.
 */
export async function GET() {
  const summary = await getFamilyCoverageSummary();
  return NextResponse.json({
    dependents: summary.dependents,
    periods: summary.periods,
    covered_count: summary.coveredCount,
    total_dependents: summary.totalDependents,
    recent_changes: summary.recentChanges,
  });
}

/**
 * Optional: submit an add-dependent change request for admin review.
 * Direct self-service add is available at /dependents via server actions.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const body = (await request.json().catch(() => ({}))) as {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    relationship?: string;
    notes?: string;
    request_review?: boolean;
  };

  if (!body.first_name || !body.last_name || !body.date_of_birth || !body.relationship) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  if (!body.request_review) {
    return NextResponse.json(
      {
        error: 'use_server_actions',
        message: 'Use /dependents to add family members directly, or set request_review=true.',
      },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('member_change_requests')
    .insert({
      organization_id: ctx.member.organization_id,
      member_id: ctx.member.id,
      request_type: 'add_dependent',
      status: 'pending_review',
      payload: {
        first_name: body.first_name,
        last_name: body.last_name,
        date_of_birth: body.date_of_birth,
        relationship: body.relationship,
        notes: body.notes ?? null,
      },
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ change_request_id: data.id });
}
