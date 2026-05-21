import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

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
  return NextResponse.json({ event: data });
}
