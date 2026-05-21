import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { listChangeRequests } from '@/lib/data/member';

export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set([
  'add_dependent',
  'remove_dependent',
  'upgrade_plan',
  'downgrade_plan',
  'change_iua',
  'change_effective_date',
  'cancel_membership',
  'update_payment_method',
  'other',
]);

export async function GET() {
  const requests = await listChangeRequests();
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const body = (await request.json().catch(() => ({}))) as {
    request_type?: string;
    payload?: Record<string, unknown>;
  };

  if (!body.request_type || !VALID_TYPES.has(body.request_type)) {
    return NextResponse.json({ error: 'invalid_request_type' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('member_change_requests')
    .insert({
      organization_id: ctx.member.organization_id,
      member_id: ctx.member.id,
      request_type: body.request_type,
      status: 'pending_review',
      payload: (body.payload ?? {}) as never,
    })
    .select('id, request_type, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ change_request: data });
}
