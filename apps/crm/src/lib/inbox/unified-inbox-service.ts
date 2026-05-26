import { createClient, getAuthUser, getAuthProfile } from '@/lib/supabase-server';
import type {
  InboxConversation,
  InboxMessage,
  InboxStats,
  ConversationFilters,
  ConversationsResult,
  ConversationStatus,
  ConversationPriority,
  InboxChannel,
  MessageDirection,
} from './types';

// ============================================================================
// Unified Inbox Service
// Fetch and manage conversations across all channels
// ============================================================================

/**
 * Cached auth context helper using request-scoped auth helpers.
 * Returns supabase client, user, and profile in a single call.
 */
interface AuthContext {
  supabase: any;
  user: { id: string };
  profile: { id: string; organization_id: string };
}

async function getAuthContext(): Promise<AuthContext | null> {
  const { user, error } = await getAuthUser();
  if (!user || error) return null;
  
  const profile = await getAuthProfile();
  if (!profile) return null;
  
  const supabase = await createClient() as any;
  
  return { supabase, user, profile };
}

// ============================================================================
// Conversation CRUD
// ============================================================================

/**
 * Get conversations with filtering and pagination
 */
export async function getConversations(
  filters?: ConversationFilters,
  page: number = 1,
  limit: number = 25
): Promise<ConversationsResult> {
  const auth = await getAuthContext();
  if (!auth) return { conversations: [], total: 0, hasMore: false };

  const { supabase } = auth;
  let query = supabase
    .from('inbox_conversations')
    .select('*', { count: 'exact' })
    .order('last_message_at', { ascending: false });
  
  // Apply filters
  if (filters?.channel) {
    query = query.eq('channel', filters.channel);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  } else {
    // Default: exclude archived
    query = query.neq('status', 'archived');
  }
  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters?.assigned_to) {
    if (filters.assigned_to === 'unassigned') {
      query = query.is('assigned_to', null);
    } else {
      query = query.eq('assigned_to', filters.assigned_to);
    }
  }
  if (filters?.unread_only) {
    query = query.gt('unread_count', 0);
  }
  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags);
  }
  if (filters?.search) {
    query = query.or(
      `subject.ilike.%${filters.search}%,preview.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,contact_email.ilike.%${filters.search}%`
    );
  }
  
  // Pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);
  
  const { data, count, error } = await query;
  
  if (error) {
    console.error('Error fetching conversations:', error);
    throw new Error('Failed to fetch conversations');
  }
  
  return {
    conversations: (data || []) as InboxConversation[],
    total: count || 0,
    hasMore: offset + limit < (count || 0),
  };
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(id: string): Promise<InboxConversation | null> {
  const auth = await getAuthContext();
  if (!auth) return null;

  const { supabase } = auth;
  
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching conversation:', error);
    throw new Error('Failed to fetch conversation');
  }
  
  return data as InboxConversation;
}

/**
 * Create a new conversation
 */
export async function createConversation(params: {
  channel: InboxChannel;
  thread_id: string;
  subject?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_name?: string;
  contact_id?: string;
  linked_lead_id?: string;
  linked_deal_id?: string;
  priority?: ConversationPriority;
  tags?: string[];
}): Promise<InboxConversation> {
  const auth = await getAuthContext();
  if (!auth) throw new Error('User not authenticated');
  
  const { supabase, profile } = auth;
  
  const conversationData = {
    org_id: profile.organization_id,
    channel: params.channel,
    thread_id: params.thread_id,
    subject: params.subject || null,
    contact_email: params.contact_email || null,
    contact_phone: params.contact_phone || null,
    contact_name: params.contact_name || null,
    contact_id: params.contact_id || null,
    linked_lead_id: params.linked_lead_id || null,
    linked_deal_id: params.linked_deal_id || null,
    priority: params.priority || 'normal',
    tags: params.tags || [],
    status: 'open',
  };
  
  const { data, error } = await supabase
    .from('inbox_conversations')
    .insert(conversationData)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating conversation:', error);
    throw new Error('Failed to create conversation');
  }
  
  return data as InboxConversation;
}

/**
 * Update a conversation
 */
export async function updateConversation(
  id: string,
  params: Partial<{
    status: ConversationStatus;
    priority: ConversationPriority;
    assigned_to: string | null;
    tags: string[];
    snoozed_until: string | null;
    contact_id: string | null;
    linked_lead_id: string | null;
    linked_deal_id: string | null;
    linked_account_id: string | null;
  }>
): Promise<InboxConversation> {
  const auth = await getAuthContext();
  if (!auth) throw new Error('User not authenticated');

  const { supabase } = auth;
  
  const updateData: Record<string, unknown> = { ...params };
  
  // Set timestamps based on status changes
  if (params.status === 'resolved') {
    updateData.resolved_at = new Date().toISOString();
  }
  if (params.assigned_to !== undefined) {
    updateData.assigned_at = params.assigned_to ? new Date().toISOString() : null;
  }
  
  const { data, error } = await supabase
    .from('inbox_conversations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating conversation:', error);
    throw new Error('Failed to update conversation');
  }
  
  return data as InboxConversation;
}

/**
 * Mark conversation as read
 */
export async function markAsRead(id: string): Promise<InboxConversation> {
  const auth = await getAuthContext();
  if (!auth) throw new Error('User not authenticated');
  
  const { supabase, profile } = auth;
  
  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({
      unread_count: 0,
      last_read_at: new Date().toISOString(),
      last_read_by: profile?.id,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error marking as read:', error);
    throw new Error('Failed to mark as read');
  }
  
  return data as InboxConversation;
}

// ============================================================================
// Messages
// ============================================================================

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ messages: InboxMessage[]; total: number; hasMore: boolean }> {
  const auth = await getAuthContext();
  if (!auth) return { messages: [], total: 0, hasMore: false };

  const { supabase } = auth;
  
  const offset = (page - 1) * limit;
  
  const { data, count, error } = await supabase
    .from('inbox_messages')
    .select('*', { count: 'exact' })
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })
    .range(offset, offset + limit - 1);
  
  if (error) {
    console.error('Error fetching messages:', error);
    throw new Error('Failed to fetch messages');
  }
  
  return {
    messages: (data || []) as InboxMessage[],
    total: count || 0,
    hasMore: offset + limit < (count || 0),
  };
}

/**
 * Add a message to a conversation
 */
export async function addMessage(params: {
  conversation_id: string;
  direction: MessageDirection;
  from_address?: string;
  from_name?: string;
  to_address?: string;
  to_name?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  external_id?: string;
  external_provider?: string;
}): Promise<InboxMessage> {
  const auth = await getAuthContext();
  if (!auth) throw new Error('User not authenticated');

  const { supabase } = auth;
  
  // Get conversation to get org_id and channel
  const conversation = await getConversation(params.conversation_id);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const messageData = {
    org_id: conversation.org_id,
    conversation_id: params.conversation_id,
    channel: conversation.channel,
    direction: params.direction,
    from_address: params.from_address || null,
    from_name: params.from_name || null,
    to_address: params.to_address || null,
    to_name: params.to_name || null,
    subject: params.subject || null,
    body_text: params.body_text || null,
    body_html: params.body_html || null,
    external_id: params.external_id || null,
    external_provider: params.external_provider || null,
    status: params.direction === 'outbound' ? 'sent' : 'delivered',
    sent_at: new Date().toISOString(),
  };
  
  const { data, error } = await supabase
    .from('inbox_messages')
    .insert(messageData)
    .select()
    .single();
  
  if (error) {
    console.error('Error adding message:', error);
    throw new Error('Failed to add message');
  }
  
  return data as InboxMessage;
}

// ============================================================================
// Stats & Helpers
// ============================================================================

/**
 * Get inbox statistics using aggregation for better performance
 */
export async function getInboxStats(): Promise<InboxStats> {
  const auth = await getAuthContext();
  if (!auth) {
    return {
      total_open: 0,
      total_pending: 0,
      total_unread: 0,
      assigned_to_me: 0,
      unassigned: 0,
    };
  }
  
  const { supabase, profile } = auth;
  
  // Use parallel count queries instead of fetching all records
  const [openResult, pendingResult, unreadResult, assignedResult, unassignedResult] = await Promise.all([
    supabase
      .from('inbox_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.organization_id)
      .eq('status', 'open'),
    supabase
      .from('inbox_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.organization_id)
      .eq('status', 'pending'),
    supabase
      .from('inbox_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.organization_id)
      .in('status', ['open', 'pending'])
      .gt('unread_count', 0),
    supabase
      .from('inbox_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.organization_id)
      .eq('assigned_to', profile.id),
    supabase
      .from('inbox_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.organization_id)
      .in('status', ['open', 'pending'])
      .is('assigned_to', null),
  ]);
  
  return {
    total_open: openResult.count || 0,
    total_pending: pendingResult.count || 0,
    total_unread: unreadResult.count || 0,
    assigned_to_me: assignedResult.count || 0,
    unassigned: unassignedResult.count || 0,
  };
}

/**
 * Get available team members for assignment
 */
export async function getTeamMembers(): Promise<Array<{ id: string; name: string; email: string; avatar_url?: string }>> {
  const auth = await getAuthContext();
  if (!auth) return [];
  
  const { supabase, profile } = auth;
  
  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('organization_id', profile.organization_id)
    .in('crm_role', ['crm_admin', 'crm_user']);
  
  return (members || []).map((m: { id: string; full_name: string | null; email: string; avatar_url: string | null }) => ({
    id: m.id,
    name: m.full_name || m.email,
    email: m.email,
    avatar_url: m.avatar_url || undefined,
  }));
}

// ============================================================================
// Unified Message Fetching (Legacy Communications Support)
// ============================================================================

interface UnifiedMessage {
  id: string;
  channel: InboxChannel;
  from: string;
  to: string;
  subject?: string;
  preview: string;
  status: string;
  direction: MessageDirection;
  lastAt: string;
  unreadCount: number;
  assignedTo?: string;
  entityLinks: {
    contact_id?: string;
    lead_id?: string;
    deal_id?: string;
  };
}

/**
 * Get unified messages from all sources
 * This aggregates from inbox_conversations, communications, and other sources
 */
export async function getUnifiedMessages(
  page: number = 1,
  limit: number = 25
): Promise<{ messages: UnifiedMessage[]; total: number }> {
  const auth = await getAuthContext();
  if (!auth) {
    return { messages: [], total: 0 };
  }
  
  const { supabase, profile } = auth;
  
  // First try to get from inbox_conversations
  const { data: conversations, count } = await supabase
    .from('inbox_conversations')
    .select('*', { count: 'exact' })
    .eq('org_id', profile.organization_id)
    .neq('status', 'archived')
    .order('last_message_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  
  if (conversations && conversations.length > 0) {
    const messages: UnifiedMessage[] = (conversations as InboxConversation[]).map(c => ({
      id: c.id,
      channel: c.channel,
      from: c.contact_email || c.contact_phone || c.contact_name || 'Unknown',
      to: 'Me',
      subject: c.subject || undefined,
      preview: c.preview || '',
      status: c.status,
      direction: 'inbound' as MessageDirection,
      lastAt: c.last_message_at,
      unreadCount: c.unread_count,
      assignedTo: c.assigned_to || undefined,
      entityLinks: {
        contact_id: c.contact_id || undefined,
        lead_id: c.linked_lead_id || undefined,
        deal_id: c.linked_deal_id || undefined,
      },
    }));
    
    return { messages, total: count || 0 };
  }

  // No conversations yet for this org — return empty inbox.
  // (The legacy `communications` fallback was removed because that table
  // is not part of the live PIFH schema; `inbox_conversations` is the
  // canonical source.)
  return { messages: [], total: 0 };
}
