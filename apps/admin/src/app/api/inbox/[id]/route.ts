import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/** GET /api/inbox/[id] — conversation + messages */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getActiveTenant();
    if (!tenant || !['owner', 'admin', 'staff'].includes(tenant.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: conversation, error: convError } = await (supabase as any)
      .from('inbox_conversations')
      .select('*')
      .eq('id', id)
      .eq('org_id', tenant.organizationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { data: messages, error: msgError } = await (supabase as any)
      .from('inbox_messages')
      .select('*')
      .eq('conversation_id', id)
      .eq('org_id', tenant.organizationId)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('Admin inbox messages error:', msgError);
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    // Mark as read
    await (supabase as any)
      .from('inbox_conversations')
      .update({ unread_count: 0 })
      .eq('id', id)
      .eq('org_id', tenant.organizationId);

    return NextResponse.json({ conversation, messages: messages || [] });
  } catch (error) {
    console.error('Admin inbox detail GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
