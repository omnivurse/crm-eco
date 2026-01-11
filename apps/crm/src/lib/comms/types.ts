/**
 * CRM Communications - Type Definitions
 * Email/SMS orchestration with SendGrid and Twilio
 */

// ============================================================================
// Message Channel & Direction
// ============================================================================

export type MessageChannel = 'email' | 'sms';
export type MessageDirection = 'outbound' | 'inbound';
export type MessageStatus = 
  | 'queued' 
  | 'sending' 
  | 'sent' 
  | 'delivered' 
  | 'failed' 
  | 'bounced' 
  | 'unsubscribed' 
  | 'blocked'
  | 'spam';

export type ProviderType = 'sendgrid' | 'twilio';

// ============================================================================
// Message Provider
// ============================================================================

export interface ProviderConfig {
  from_email?: string;
  from_name?: string;
  from_phone?: string;
  reply_to?: string;
  footer_text?: string;
  unsubscribe_url?: string;
}

export interface CrmMessageProvider {
  id: string;
  org_id: string;
  type: ProviderType;
  name: string;
  config: ProviderConfig;
  is_default: boolean;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Message Template
// ============================================================================

export interface TemplateMeta {
  category?: string;
  tags?: string[];
  preview_text?: string;  // Email preview text
}

export interface CrmMessageTemplate {
  id: string;
  org_id: string;
  module_id: string | null;
  channel: MessageChannel;
  name: string;
  subject: string | null;  // Email only
  body: string;  // Supports {{merge.fields}}
  meta: TemplateMeta;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Message Thread
// ============================================================================

export interface CrmMessageThread {
  id: string;
  org_id: string;
  record_id: string;
  channel: MessageChannel;
  external_thread_id: string | null;
  subject: string | null;
  participant_address: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Message
// ============================================================================

export interface MessageMeta {
  template_name?: string;
  merge_context?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size: number;
    url?: string;
  }>;
  headers?: Record<string, string>;
  tracking?: {
    opens?: boolean;
    clicks?: boolean;
  };
}

export interface CrmMessage {
  id: string;
  org_id: string;
  record_id: string;
  thread_id: string | null;
  template_id: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  to_address: string;
  from_address: string | null;
  subject: string | null;
  body: string;
  status: MessageStatus;
  provider: string | null;
  provider_message_id: string | null;
  error: string | null;
  retry_count: number;
  next_retry_at: string | null;
  meta: MessageMeta;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Message Event
// ============================================================================

export type MessageEventType = 
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'dropped'
  | 'deferred'
  | 'spam'
  | 'unsubscribed'
  | 'failed';

export interface CrmMessageEvent {
  id: string;
  org_id: string;
  message_id: string;
  event: MessageEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Contact Preferences
// ============================================================================

export type PreferredChannel = 'email' | 'sms' | 'phone';
export type EmailFrequency = 'all' | 'important' | 'none';

export interface CrmContactPreferences {
  id: string;
  org_id: string;
  record_id: string;
  do_not_email: boolean;
  do_not_sms: boolean;
  do_not_call: boolean;
  unsubscribed_at: string | null;
  unsubscribe_reason: string | null;
  preferred_channel: PreferredChannel | null;
  email_frequency: EmailFrequency | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Send Message Request
// ============================================================================

export interface SendMessageRequest {
  recordId: string;
  channel: MessageChannel;
  templateId?: string;
  subject?: string;  // Email only, overrides template
  body?: string;     // Overrides template
  to?: string;       // Override recipient
  dryRun?: boolean;
  scheduledAt?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  status: MessageStatus;
  error?: string;
  blocked?: boolean;
  blockReason?: string;
}

// ============================================================================
// Provider Send Request/Response
// ============================================================================

export interface ProviderSendRequest {
  to: string;
  from: string;
  fromName?: string;
  subject?: string;  // Email only
  body: string;
  replyTo?: string;
  messageId: string;
  meta?: Record<string, unknown>;
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// Merge Field Context
// ============================================================================

export interface MergeFieldContext {
  system: {
    org_name?: string;
    org_id?: string;
    date?: string;
    time?: string;
    datetime?: string;
    year?: string;
    month?: string;
    day?: string;
  };
  record: Record<string, unknown>;
  data: Record<string, unknown>;
  owner?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  member?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  custom?: Record<string, unknown>;
}

// ============================================================================
// Webhook Payloads
// ============================================================================

export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event: string;
  sg_event_id: string;
  sg_message_id: string;
  reason?: string;
  status?: string;
  url?: string;
  useragent?: string;
  ip?: string;
  bounce_classification?: string;
}

export interface TwilioStatusWebhook {
  SmsSid: string;
  SmsStatus: string;
  MessageStatus: string;
  To: string;
  From: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

export interface TwilioInboundWebhook {
  MessageSid: string;
  SmsSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  NumSegments: string;
}
