import { NextRequest, NextResponse } from 'next/server';
import {
  getConversation,
  updateConversation,
  markAsRead,
  getMessages,
} from '@/lib/inbox';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/inbox/[id]
 * Get a single conversation with its messages
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get conversation
    const conversation = await getConversation(id);
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }
    
    // Check if should include messages
    const includeMessages = searchParams.get('include_messages') !== 'false';
    
    let response: Record<string, unknown> = { conversation };
    
    if (includeMessages) {
      const page = parseInt(searchParams.get('message_page') || '1', 10);
      const limit = parseInt(searchParams.get('message_limit') || '50', 10);
      const messagesResult = await getMessages(id, page, limit);
      response.messages = messagesResult.messages;
      response.messagesTotal = messagesResult.total;
      response.messagesHasMore = messagesResult.hasMore;
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/inbox/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inbox/[id]
 * Update a conversation
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check for special actions
    const action = body.action;
    
    if (action === 'mark_read') {
      const conversation = await markAsRead(id);
      return NextResponse.json(conversation);
    }
    
    if (action === 'assign') {
      const conversation = await updateConversation(id, {
        assigned_to: body.assigned_to || null,
      });
      return NextResponse.json(conversation);
    }
    
    if (action === 'change_status') {
      const conversation = await updateConversation(id, {
        status: body.status,
      });
      return NextResponse.json(conversation);
    }
    
    if (action === 'snooze') {
      const conversation = await updateConversation(id, {
        status: 'snoozed',
        snoozed_until: body.snoozed_until,
      });
      return NextResponse.json(conversation);
    }
    
    if (action === 'resolve') {
      const conversation = await updateConversation(id, {
        status: 'resolved',
      });
      return NextResponse.json(conversation);
    }
    
    if (action === 'archive') {
      const conversation = await updateConversation(id, {
        status: 'archived',
      });
      return NextResponse.json(conversation);
    }
    
    if (action === 'reopen') {
      const conversation = await updateConversation(id, {
        status: 'open',
        snoozed_until: null,
      });
      return NextResponse.json(conversation);
    }
    
    if (action === 'link_record') {
      const conversation = await updateConversation(id, {
        contact_id: body.contact_id,
        linked_lead_id: body.linked_lead_id,
        linked_deal_id: body.linked_deal_id,
        linked_account_id: body.linked_account_id,
      });
      return NextResponse.json(conversation);
    }
    
    // Generic update
    const conversation = await updateConversation(id, {
      status: body.status,
      priority: body.priority,
      assigned_to: body.assigned_to,
      tags: body.tags,
    });
    
    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error in PUT /api/inbox/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}
