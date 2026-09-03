import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/inbox/reads
 * Upsert this user's read cursor. Does not clear org unread_count.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : '';
    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: conversation, error: convError } = await supabase
      .from('inbox_conversations')
      .select('id, org_id')
      .eq('id', conversationId)
      .eq('org_id', profile.organization_id)
      .maybeSingle();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { error } = await supabase.from('inbox_conversation_reads').upsert(
      {
        org_id: profile.organization_id,
        conversation_id: conversationId,
        user_id: profile.id,
        last_read_at: typeof body.last_read_at === 'string' ? body.last_read_at : new Date().toISOString(),
        last_seen_message_id: typeof body.last_seen_message_id === 'string' ? body.last_seen_message_id : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id,user_id' },
    );

    if (error) {
      console.error('inbox read upsert failed:', error);
      return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in POST /api/inbox/reads:', error);
    return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
  }
}

/**
 * DELETE /api/inbox/reads?conversation_id=
 * Remove this user's cursor so the thread is unread again.
 */
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = request.nextUrl.searchParams.get('conversation_id');
    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('inbox_conversation_reads')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', profile.id)
      .eq('org_id', profile.organization_id);

    if (error) {
      console.error('inbox read delete failed:', error);
      return NextResponse.json({ error: 'Failed to mark unread' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/inbox/reads:', error);
    return NextResponse.json({ error: 'Failed to mark unread' }, { status: 500 });
  }
}
