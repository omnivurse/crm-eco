import { NextRequest, NextResponse } from 'next/server';
import { sanitizeBookName } from '@crm-eco/cash-pay';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { memberRateLimit } from '@/lib/api/guard';
import { getOwnedBook } from '@/lib/rate-book/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireActiveMembership();
  const limited = memberRateLimit(ctx.member.id, 'rate-books:rename', { limit: 30, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = sanitizeBookName(body.name);
  if (!name) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400, headers: limited.headers });
  }

  const supabase = await createServerSupabaseClient();
  const owned = await getOwnedBook(supabase, id, ctx.member.id, ctx.member.organization_id);
  if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: limited.headers });

  const { data, error } = await supabase
    .from('rate_books')
    .update({ name })
    .eq('id', id)
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .select('id, organization_id, member_id, name, is_default, created_at, updated_at')
    .single();

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'duplicate_name' }, { status: 409, headers: limited.headers });
  }
  if (error) {
    console.error('[rate-books:rename]', error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500, headers: limited.headers });
  }
  return NextResponse.json({ book: data }, { headers: limited.headers });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireActiveMembership();
  const limited = memberRateLimit(ctx.member.id, 'rate-books:delete', { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const supabase = await createServerSupabaseClient();
  const owned = await getOwnedBook(supabase, id, ctx.member.id, ctx.member.organization_id);
  if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: limited.headers });
  if (owned.is_default) {
    return NextResponse.json(
      { error: 'default_locked', message: 'The default book stays. Empty it instead.' },
      { status: 409, headers: limited.headers },
    );
  }

  const { error } = await supabase
    .from('rate_books')
    .delete()
    .eq('id', id)
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id);

  if (error) {
    console.error('[rate-books:delete]', error);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500, headers: limited.headers });
  }
  return NextResponse.json({ ok: true }, { headers: limited.headers });
}
