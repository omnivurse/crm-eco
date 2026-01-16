// ============================================================================
// Unified Inbox Types
// ============================================================================

export type InboxChannel = 
  | 'email' 
  | 'sms' 
  | 'whatsapp' 
  | 'phone' 
  | 'video' 
  | 'chat' 
  | 'social' 
  | 'support';

export type ConversationStatus = 
  | 'open' 
  | 'pending' 
  | 'snoozed' 
  | 'resolved' 
  | 'archived';

export type ConversationPriority = 
  | 'low' 
  | 'normal' 
  | 'high' 
  | 'urgent';

export type MessageDirection = 'inbound' | 'outbound';

export type MessageStatus = 
  | 'pending' 
  | 'sent' 
  | 'delivered' 
  | 'read' 
  | 'failed' 
  | 'bounced';

export type QuickActionType = 
  | 'convert_lead'
  | 'create_contact'
  | 'create_task'
  | 'add_note'
  | 'change_deal_stage'
  | 'merge_contact'
  | 'link_record'
  | 'send_template'
  | 'snooze'
  | 'resolve'
  | 'archive';

export type AssignmentReason = 
  | 'manual'
  | 'auto_route'
  | 'round_robin'
  | 'skill_based'
  | 'load_balance';

// ============================================================================
// Database Row Types
// ============================================================================

export interface InboxConversation {
  id: string;
  org_id: string;
  channel: InboxChannel;
  thread_id: string;
  subject: string | null;
  preview: string | null;
  contact_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_name: string | null;
  linked_lead_id: string | null;
  linked_deal_id: string | null;
  linked_account_id: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  assigned_to: string | null;
  assigned_at: string | null;
  unread_count: number;
  last_read_at: string | null;
  last_read_by: string | null;
  message_count: number;
  last_message_at: string;
  first_message_at: string;
  snoozed_until: string | null;
  resolved_at: string | null;
  tags: string[];
  labels: Array<{ name: string; color: string }>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InboxMessage {
  id: string;
  org_id: string;
  conversation_id: string;
  channel: InboxChannel;
  direction: MessageDirection;
  from_address: string | null;
  from_name: string | null;
  to_address: string | null;
  to_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attachments: Array<{
    filename: string;
    content_type: string;
    size: number;
    url?: string;
  }>;
  external_id: string | null;
  external_provider: string | null;
  status: MessageStatus;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  metadata: Record<string, unknown>;
  sent_at: string;
  created_at: string;
}

export interface InboxAssignment {
  id: string;
  org_id: string;
  conversation_id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_from: string | null;
  reason: AssignmentReason | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InboxQuickAction {
  id: string;
  org_id: string;
  conversation_id: string;
  action_type: QuickActionType;
  action_data: Record<string, unknown>;
  result_type: string | null;
  result_id: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface InboxView {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  filters: {
    channel?: InboxChannel[];
    status?: ConversationStatus[];
    assigned_to?: string[];
    tags?: string[];
    priority?: ConversationPriority[];
  };
  sort_by: string;
  sort_direction: 'asc' | 'desc';
  is_default: boolean;
  is_shared: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboxStats {
  total_open: number;
  total_pending: number;
  total_unread: number;
  assigned_to_me: number;
  unassigned: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface ConversationFilters {
  channel?: InboxChannel;
  status?: ConversationStatus;
  priority?: ConversationPriority;
  assigned_to?: string;
  unread_only?: boolean;
  tags?: string[];
  search?: string;
}

export interface ConversationsResult {
  conversations: InboxConversation[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Channel Configuration
// ============================================================================

export const CHANNEL_CONFIG: Record<InboxChannel, { 
  name: string; 
  icon: string; 
  color: string;
  description: string;
}> = {
  email: { 
    name: 'Email', 
    icon: 'mail', 
    color: 'blue',
    description: 'Email conversations',
  },
  sms: { 
    name: 'SMS', 
    icon: 'message-square', 
    color: 'green',
    description: 'Text messages',
  },
  whatsapp: { 
    name: 'WhatsApp', 
    icon: 'message-circle', 
    color: 'emerald',
    description: 'WhatsApp messages',
  },
  phone: { 
    name: 'Phone', 
    icon: 'phone', 
    color: 'amber',
    description: 'Phone calls and voicemails',
  },
  video: { 
    name: 'Video', 
    icon: 'video', 
    color: 'purple',
    description: 'Video meetings',
  },
  chat: { 
    name: 'Chat', 
    icon: 'messages-square', 
    color: 'indigo',
    description: 'Live chat',
  },
  social: { 
    name: 'Social', 
    icon: 'share-2', 
    color: 'pink',
    description: 'Social media messages',
  },
  support: { 
    name: 'Support', 
    icon: 'help-circle', 
    color: 'orange',
    description: 'Support tickets',
  },
};

export const PRIORITY_CONFIG: Record<ConversationPriority, {
  name: string;
  color: string;
}> = {
  low: { name: 'Low', color: 'slate' },
  normal: { name: 'Normal', color: 'blue' },
  high: { name: 'High', color: 'amber' },
  urgent: { name: 'Urgent', color: 'red' },
};

export const STATUS_CONFIG: Record<ConversationStatus, {
  name: string;
  color: string;
}> = {
  open: { name: 'Open', color: 'blue' },
  pending: { name: 'Pending', color: 'amber' },
  snoozed: { name: 'Snoozed', color: 'purple' },
  resolved: { name: 'Resolved', color: 'green' },
  archived: { name: 'Archived', color: 'slate' },
};
