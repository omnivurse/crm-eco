import { NextRequest, NextResponse } from 'next/server';
import { sanitizeBookName } from '@crm-eco/cash-pay';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { memberRateLimit } from '@/lib/api/guard';
import { countBooks, listBooks, MAX_BOOKS_PER_MEMBER } from '@/lib/rate-book/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  try {
    const books = await listBooks(supabase, ctx.member.id, ctx.member.organization_id);
    return NextResponse.json({ books });
  } catch (err) {
    console.error('[rate-books:list]', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const limited = memberRateLimit(ctx.member.id, 'rate-books:create', { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = sanitizeBookName(body.name);
  if (!name) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400, headers: limited.headers });
  }

  const supabase = await createServerSupabaseClient();
  try {
    const existing = await countBooks(supabase, ctx.member.id, ctx.member.organization_id);
    if (existing >= MAX_BOOKS_PER_MEMBER) {
      return NextResponse.json(
        { error: 'book_cap', message: `A member can keep ${MAX_BOOKS_PER_MEMBER} books.` },
        { status: 409, headers: limited.headers },
      );
    }

    const { data, error } = await supabase
      .from('rate_books')
      .insert({
        organization_id: ctx.member.organization_id,
        member_id: ctx.member.id,
        name,
        is_default: existing === 0,
      })
      .select('id, organization_id, member_id, name, is_default, created_at, updated_at')
      .single();

    if (error?.code === '23505') {
      return NextResponse.json({ error: 'duplicate_name' }, { status: 409, headers: limited.headers });
    }
    if (error) {
      console.error('[rate-books:create]', error);
      return NextResponse.json({ error: 'create_failed' }, { status: 500, headers: limited.headers });
    }
    return NextResponse.json({ book: data }, { headers: limited.headers });
  } catch (err) {
    console.error('[rate-books:create]', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500, headers: limited.headers });
  }
}
