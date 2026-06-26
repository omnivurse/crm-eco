import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { memberRateLimit, findRecentDuplicate } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: needId } = await params;
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();

  const { data: need } = await supabase
    .from('needs')
    .select('id')
    .eq('id', needId)
    .eq('member_id', ctx.member.id)
    .maybeSingle();
  if (!need) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data } = await supabase
    .from('need_events')
    .select('*')
    .eq('need_id', needId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: needId } = await params;
  const ctx = await requireActiveMembership();

  const limited = memberRateLimit(ctx.member.id, 'need-comments:create', { limit: 40, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const body = (await request.json().catch(() => ({}))) as { content?: string };
  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'missing_content' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: need } = await supabase
    .from('needs')
    .select('id, organization_id')
    .eq('id', needId)
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .maybeSingle();
  if (!need) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Idempotency: identical comment text on the same need within the window is a
  // double-submit, not two distinct replies.
  const duplicateId = await findRecentDuplicate(supabase, 'need_events', {
    need_id: needId,
    organization_id: need.organization_id,
    event_type: 'member_comment',
    note: body.content,
    created_by_profile_id: ctx.profile.id,
  });
  if (duplicateId) {
    return NextResponse.json({ event: { id: duplicateId }, deduplicated: true }, { headers: limited.headers });
  }

  const { data, error } = await supabase
    .from('need_events')
    .insert({
      organization_id: need.organization_id,
      need_id: needId,
      event_type: 'member_comment',
      description: 'Member comment',
      note: body.content,
      created_by_profile_id: ctx.profile.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data }, { headers: limited.headers });
}
