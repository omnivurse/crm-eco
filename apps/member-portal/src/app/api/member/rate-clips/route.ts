import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { memberRateLimit } from '@/lib/api/guard';
import {
  countClips,
  deleteOwnedClip,
  ensureDefaultBook,
  getOwnedBook,
  insertClip,
  listBooks,
  listClips,
  MAX_CLIPS_PER_BOOK,
} from '@/lib/rate-book/db';
import { clipRecordToSnapshot, parseClipInput } from '@/lib/rate-book/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const bookId = request.nextUrl.searchParams.get('bookId');

  try {
    const book = bookId
      ? await getOwnedBook(supabase, bookId, ctx.member.id, ctx.member.organization_id)
      : (
          await listBooks(supabase, ctx.member.id, ctx.member.organization_id)
        ).find((row) => row.is_default) ?? null;
    if (bookId && !book) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (!book) return NextResponse.json({ book: null, clips: [] });

    const rows = await listClips(supabase, book.id, ctx.member.id, ctx.member.organization_id);
    return NextResponse.json({
      book,
      clips: rows.map(clipRecordToSnapshot),
    });
  } catch (err) {
    console.error('[rate-clips:list]', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const limited = memberRateLimit(ctx.member.id, 'rate-clips:create', { limit: 40, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const body = (await request.json().catch(() => ({}))) as {
    bookId?: string;
    clip?: unknown;
    clips?: unknown[];
  };

  const inputs = (body.clips?.length ? body.clips : body.clip ? [body.clip] : [])
    .map(parseClipInput)
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (inputs.length === 0) {
    return NextResponse.json({ error: 'invalid_clip' }, { status: 400, headers: limited.headers });
  }

  const supabase = await createServerSupabaseClient();
  try {
    const book = body.bookId
      ? await getOwnedBook(supabase, body.bookId, ctx.member.id, ctx.member.organization_id)
      : await ensureDefaultBook(supabase, ctx.member.id, ctx.member.organization_id);
    if (!book) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: limited.headers });

    const current = await countClips(supabase, book.id, ctx.member.id, ctx.member.organization_id);
    if (current + inputs.length > MAX_CLIPS_PER_BOOK) {
      return NextResponse.json(
        { error: 'clip_cap', message: `A book holds ${MAX_CLIPS_PER_BOOK} clips.` },
        { status: 409, headers: limited.headers },
      );
    }

    const clips = [];
    let deduplicated = 0;
    for (const input of inputs) {
      const result = await insertClip(
        supabase,
        ctx.member.id,
        ctx.member.organization_id,
        book,
        input,
      );
      clips.push(clipRecordToSnapshot(result.clip));
      if (result.deduplicated) deduplicated += 1;
    }

    return NextResponse.json(
      { book, clips, deduplicated: deduplicated > 0 },
      { headers: limited.headers },
    );
  } catch (err) {
    console.error('[rate-clips:create]', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500, headers: limited.headers });
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const limited = memberRateLimit(ctx.member.id, 'rate-clips:delete', { limit: 40, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const id =
    request.nextUrl.searchParams.get('id') ||
    ((await request.json().catch(() => ({}))) as { id?: string }).id;
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400, headers: limited.headers });
  }

  const supabase = await createServerSupabaseClient();
  try {
    const removed = await deleteOwnedClip(supabase, id, ctx.member.id, ctx.member.organization_id);
    if (!removed) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: limited.headers });
    return NextResponse.json({ ok: true }, { headers: limited.headers });
  } catch (err) {
    console.error('[rate-clips:delete]', err);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500, headers: limited.headers });
  }
}
