import { NextRequest, NextResponse } from 'next/server';
import {
  getConversations,
  createConversation,
  getInboxStats,
  getUnifiedMessages,
} from '@/lib/inbox';
import type { ConversationFilters } from '@/lib/inbox';

/**
 * GET /api/inbox
 * Get inbox conversations or unified messages
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Check if requesting stats
    if (searchParams.get('stats') === 'true') {
      const stats = await getInboxStats();
      return NextResponse.json(stats);
    }
    
    // Check if requesting unified messages (legacy support)
    if (searchParams.get('unified') === 'true') {
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '25', 10);
      const result = await getUnifiedMessages(page, limit);
      return NextResponse.json(result);
    }
    
    // Parse filters
    const filters: ConversationFilters = {};
    
    const channel = searchParams.get('channel');
    if (channel) {
      filters.channel = channel as ConversationFilters['channel'];
    }
    
    const status = searchParams.get('status');
    if (status) {
      filters.status = status as ConversationFilters['status'];
    }
    
    const priority = searchParams.get('priority');
    if (priority) {
      filters.priority = priority as ConversationFilters['priority'];
    }
    
    const assignedTo = searchParams.get('assigned_to');
    if (assignedTo) {
      filters.assigned_to = assignedTo;
    }
    
    const unreadOnly = searchParams.get('unread_only');
    if (unreadOnly === 'true') {
      filters.unread_only = true;
    }
    
    const tags = searchParams.get('tags');
    if (tags) {
      filters.tags = tags.split(',');
    }
    
    const search = searchParams.get('search');
    if (search) {
      filters.search = search;
    }
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    
    // Include stats?
    const includeStats = searchParams.get('include_stats') === 'true';
    
    const result = await getConversations(filters, page, limit);
    
    let response: Record<string, unknown> = {
      conversations: result.conversations,
      total: result.total,
      hasMore: result.hasMore,
      page,
      limit,
    };
    
    if (includeStats) {
      response.stats = await getInboxStats();
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/inbox:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inbox' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inbox
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.channel || !body.thread_id) {
      return NextResponse.json(
        { error: 'Missing required fields: channel, thread_id' },
        { status: 400 }
      );
    }
    
    const conversation = await createConversation({
      channel: body.channel,
      thread_id: body.thread_id,
      subject: body.subject,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone,
      contact_name: body.contact_name,
      contact_id: body.contact_id,
      linked_lead_id: body.linked_lead_id,
      linked_deal_id: body.linked_deal_id,
      priority: body.priority,
      tags: body.tags,
    });
    
    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/inbox:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
