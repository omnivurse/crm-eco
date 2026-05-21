import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { listDependentsForMember } from '@/lib/data/member';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dependents = await listDependentsForMember();
  return NextResponse.json({ dependents });
}

/**
 * Members do not directly add dependents; they create a `member_change_requests`
 * row of type='add_dependent'. Admin approval moves it onto the enrollment.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const body = (await request.json().catch(() => ({}))) as {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    relationship?: string;
    notes?: string;
  };

  if (!body.first_name || !body.last_name || !body.date_of_birth || !body.relationship) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
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
