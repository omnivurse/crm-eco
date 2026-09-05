import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Upper bound on a single bulk mark — matches the cap on
 * `inbox_unread_conversation_ids`, so "mark all read" can never ask for more
 * threads than the unread aggregate is willing to name.
 */
const MAX_BULK_CONVERSATIONS = 500;

function requestedIds(body: Record<string, unknown>): string[] {
  const many = Array.isArray(body.conversation_ids) ? body.conversation_ids : [];
  const one = typeof body.conversation_id === 'string' ? [body.conversation_id] : [];
  return [
    ...new Set(
      [...one, ...many].filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ].slice(0, MAX_BULK_CONVERSATIONS);
}

/**
 * POST /api/inbox/reads
 *
 * Upsert this user's read cursor for one thread (`conversation_id`), a set of
 * threads (`conversation_ids`), or every thread this user has not read
 * (`all_unread: true`, optionally narrowed by `mailbox`). Does not touch the
 * legacy org-wide `unread_count`.
 *
 * Every id is checked against the caller's org before anything is written: the
 * ids arrive from the browser, and a read cursor for another tenant's thread
 * would be a cross-tenant write even though it leaks no content.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const supabase = await createClient();

    let ids = requestedIds(body);

    if (body.all_unread === true) {
      const { data: unreadRows, error: unreadError } = await supabase.rpc(
        'inbox_unread_conversation_ids',
        { p_org_id: profile.organization_id, p_limit: MAX_BULK_CONVERSATIONS },
      );
      if (unreadError) {
        console.error('inbox unread lookup failed:', unreadError);
        return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
      }
      ids = [
        ...new Set(
          ((unreadRows ?? []) as Array<{ conversation_id: string }>).map(
            (row) => row.conversation_id,
          ),
        ),
      ];
    }

    if (ids.length === 0) {
      // "Mark all read" on an already-read folder is a no-op, not an error.
      return NextResponse.json({ ok: true, marked: 0 });
    }

    let ownedQuery = supabase
      .from('inbox_conversations')
      .select('id')
      .eq('org_id', profile.organization_id)
      .in('id', ids);

    if (typeof body.mailbox === 'string' && body.mailbox && body.mailbox !== 'all') {
      ownedQuery = ownedQuery.eq('mailbox_address', body.mailbox);
    }

    const { data: owned, error: ownedError } = await ownedQuery;

    if (ownedError) {
      console.error('inbox read ownership check failed:', ownedError);
      return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
    }

    const ownedIds = (owned ?? []).map((row: { id: string }) => row.id);
    if (ownedIds.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const readAt =
      typeof body.last_read_at === 'string' ? body.last_read_at : new Date().toISOString();
    const now = new Date().toISOString();
    // A seen-message id only makes sense for a single thread.
    const seenMessageId =
      ownedIds.length === 1 && typeof body.last_seen_message_id === 'string'
        ? body.last_seen_message_id
        : null;

    const { error } = await supabase.from('inbox_conversation_reads').upsert(
      ownedIds.map((conversationId) => ({
        org_id: profile.organization_id,
        conversation_id: conversationId,
        user_id: profile.id,
        last_read_at: readAt,
        last_seen_message_id: seenMessageId,
        updated_at: now,
      })),
      { onConflict: 'conversation_id,user_id' },
    );

    if (error) {
      console.error('inbox read upsert failed:', error);
      return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, marked: ownedIds.length, ids: ownedIds });
  } catch (error) {
    console.error('Error in POST /api/inbox/reads:', error);
    return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
  }
}

/**
 * DELETE /api/inbox/reads?conversation_id= | ?conversation_ids=a,b,c
 * Remove this user's cursor so the thread is unread again.
 */
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const ids = [
      ...new Set(
        [
          params.get('conversation_id') ?? '',
          ...(params.get('conversation_ids') ?? '').split(','),
        ]
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ].slice(0, MAX_BULK_CONVERSATIONS);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('inbox_conversation_reads')
      .delete()
      .in('conversation_id', ids)
      .eq('user_id', profile.id)
      .eq('org_id', profile.organization_id);

    if (error) {
      console.error('inbox read delete failed:', error);
      return NextResponse.json({ error: 'Failed to mark unread' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, unmarked: ids.length });
  } catch (error) {
    console.error('Error in DELETE /api/inbox/reads:', error);
    return NextResponse.json({ error: 'Failed to mark unread' }, { status: 500 });
  }
}
