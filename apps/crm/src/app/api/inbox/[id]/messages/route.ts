import { NextRequest, NextResponse } from 'next/server';
import { getMessages, addMessage } from '@/lib/inbox';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/inbox/[id]/messages
 * Get messages for a conversation
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { id } = await params;

    // Verify conversation belongs to user's org
    const { data: conversation } = await supabase
      .from('inbox_conversations')
      .select('id')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const result = await getMessages(id, page, limit);

    return NextResponse.json({
      messages: result.messages,
      total: result.total,
      hasMore: result.hasMore,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error in GET /api/inbox/[id]/messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inbox/[id]/messages
 * Add a message to a conversation
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { id } = await params;

    // Verify conversation belongs to user's org
    const { data: conversation } = await supabase
      .from('inbox_conversations')
      .select('id')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.direction) {
      return NextResponse.json(
        { error: 'Missing required field: direction' },
        { status: 400 }
      );
    }

    const message = await addMessage({
      conversation_id: id,
      direction: body.direction,
      from_address: body.from_address,
      from_name: body.from_name,
      to_address: body.to_address,
      to_name: body.to_name,
      subject: body.subject,
      body_text: body.body_text,
      body_html: body.body_html,
      external_id: body.external_id,
      external_provider: body.external_provider,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/inbox/[id]/messages:', error);
    return NextResponse.json(
      { error: 'Failed to add message' },
      { status: 500 }
    );
  }
}
