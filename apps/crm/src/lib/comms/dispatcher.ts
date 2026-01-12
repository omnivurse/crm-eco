/**
 * CRM Communications - Message Dispatcher
 * Handles message queuing, sending, retries, and preference checks
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendMessage } from './providers';
import { renderTemplate, buildMergeContext } from './mergeFields';
import { isValidEmail } from './providers/sendgrid';
import { isValidPhoneNumber, normalizePhoneNumber } from './providers/twilio';
import type {
  MessageChannel,
  CrmMessage,
  CrmContactPreferences,
  CrmMessageTemplate,
  CrmMessageProvider,
  SendMessageRequest,
  SendMessageResult,
  MergeFieldContext,
} from './types';

// ============================================================================
// Supabase Client
// ============================================================================

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context
          }
        },
      },
    }
  );
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRY_COUNT = 3;
const RETRY_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min

// ============================================================================
// Preference Checking
// ============================================================================

async function getContactPreferences(
  recordId: string
): Promise<CrmContactPreferences | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_contact_preferences')
    .select('*')
    .eq('record_id', recordId)
    .single();
  
  return data as CrmContactPreferences | null;
}

function checkPreferences(
  preferences: CrmContactPreferences | null,
  channel: MessageChannel
): { allowed: boolean; reason?: string } {
  if (!preferences) {
    return { allowed: true };
  }
  
  if (channel === 'email') {
    if (preferences.do_not_email) {
      return { allowed: false, reason: 'Contact has do_not_email flag set' };
    }
    if (preferences.unsubscribed_at) {
      return { allowed: false, reason: 'Contact has unsubscribed from emails' };
    }
    if (preferences.email_frequency === 'none') {
      return { allowed: false, reason: 'Contact email frequency is set to none' };
    }
  } else if (channel === 'sms') {
    if (preferences.do_not_sms) {
      return { allowed: false, reason: 'Contact has do_not_sms flag set' };
    }
  }
  
  return { allowed: true };
}

// ============================================================================
// Record & Provider Loading
// ============================================================================

interface RecordWithOwner {
  id: string;
  org_id: string;
  module_id: string;
  title: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  stage: string | null;
  data: Record<string, unknown>;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  owner?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

async function getRecord(recordId: string): Promise<RecordWithOwner | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_records')
    .select(`
      *,
      owner:profiles!crm_records_owner_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq('id', recordId)
    .single();
  
  return data as RecordWithOwner | null;
}

async function getDefaultProvider(
  orgId: string,
  channel: MessageChannel
): Promise<CrmMessageProvider | null> {
  const supabase = await createClient();
  
  const providerType = channel === 'email' ? 'sendgrid' : 'twilio';
  
  const { data } = await supabase
    .from('crm_message_providers')
    .select('*')
    .eq('org_id', orgId)
    .eq('type', providerType)
    .eq('is_enabled', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .single();
  
  return data as CrmMessageProvider | null;
}

async function getTemplate(
  templateId: string
): Promise<CrmMessageTemplate | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_message_templates')
    .select('*')
    .eq('id', templateId)
    .single();
  
  return data as CrmMessageTemplate | null;
}

// ============================================================================
// Message Creation
// ============================================================================

async function createMessage(
  message: Omit<CrmMessage, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmMessage> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('crm_messages')
    .insert(message)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create message: ${error.message}`);
  }
  
  return data as CrmMessage;
}

async function updateMessageStatus(
  messageId: string,
  status: string,
  updates?: Partial<CrmMessage>
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('crm_messages')
    .update({
      status,
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId);
}

async function createMessageEvent(
  orgId: string,
  messageId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();
  
  await supabase.from('crm_message_events').insert({
    org_id: orgId,
    message_id: messageId,
    event,
    payload,
  });
}

// ============================================================================
// Thread Management
// ============================================================================

async function getOrCreateThread(
  orgId: string,
  recordId: string,
  channel: MessageChannel,
  participantAddress: string,
  subject?: string
): Promise<string> {
  const supabase = await createClient();
  
  // Try to find existing thread
  const { data: existing } = await supabase
    .from('crm_message_threads')
    .select('id')
    .eq('record_id', recordId)
    .eq('channel', channel)
    .eq('participant_address', participantAddress)
    .single();
  
  if (existing) {
    return existing.id;
  }
  
  // Create new thread
  const { data: newThread, error } = await supabase
    .from('crm_message_threads')
    .insert({
      org_id: orgId,
      record_id: recordId,
      channel,
      participant_address: participantAddress,
      subject,
    })
    .select('id')
    .single();
  
  if (error) {
    throw new Error(`Failed to create thread: ${error.message}`);
  }
  
  return newThread.id;
}

// ============================================================================
// Main Send Function
// ============================================================================

/**
 * Queue and optionally send a message
 */
export async function dispatchMessage(
  request: SendMessageRequest,
  profileId?: string
): Promise<SendMessageResult> {
  const { recordId, channel, templateId, subject, body, to, dryRun } = request;
  
  // 1. Load record
  const record = await getRecord(recordId);
  if (!record) {
    return {
      success: false,
      status: 'failed',
      error: 'Record not found',
    };
  }
  
  // 2. Check preferences
  const preferences = await getContactPreferences(recordId);
  const prefCheck = checkPreferences(preferences, channel);
  
  if (!prefCheck.allowed) {
    return {
      success: false,
      status: 'blocked',
      blocked: true,
      blockReason: prefCheck.reason,
    };
  }
  
  // 3. Determine recipient address
  let recipientAddress = to;
  if (!recipientAddress) {
    if (channel === 'email') {
      recipientAddress = record.email || (record.data?.email as string);
    } else {
      recipientAddress = record.phone || (record.data?.phone as string) || (record.data?.mobile as string);
    }
  }
  
  if (!recipientAddress) {
    return {
      success: false,
      status: 'failed',
      error: `No ${channel === 'email' ? 'email address' : 'phone number'} found for record`,
    };
  }
  
  // 4. Validate address
  if (channel === 'email') {
    if (!isValidEmail(recipientAddress)) {
      return {
        success: false,
        status: 'failed',
        error: 'Invalid email address format',
      };
    }
  } else {
    if (!isValidPhoneNumber(recipientAddress)) {
      return {
        success: false,
        status: 'failed',
        error: 'Invalid phone number format',
      };
    }
    recipientAddress = normalizePhoneNumber(recipientAddress);
  }
  
  // 5. Get provider config
  const provider = await getDefaultProvider(record.org_id, channel);
  if (!provider) {
    return {
      success: false,
      status: 'failed',
      error: `No ${channel} provider configured`,
    };
  }
  
  // 6. Load template if provided
  let template: CrmMessageTemplate | null = null;
  if (templateId) {
    template = await getTemplate(templateId);
    if (!template) {
      return {
        success: false,
        status: 'failed',
        error: 'Template not found',
      };
    }
  }
  
  // 7. Build merge context and render content
  const mergeContext: MergeFieldContext = buildMergeContext(record as unknown as Record<string, unknown>, {
    orgId: record.org_id,
    owner: record.owner
      ? {
          id: record.owner.id,
          name: record.owner.full_name,
          email: record.owner.email,
        }
      : undefined,
  });
  
  const finalSubject = renderTemplate(subject || template?.subject || '', mergeContext);
  const finalBody = renderTemplate(body || template?.body || '', mergeContext);
  
  if (!finalBody) {
    return {
      success: false,
      status: 'failed',
      error: 'Message body is empty',
    };
  }
  
  // 8. Get or create thread
  const threadId = await getOrCreateThread(
    record.org_id,
    recordId,
    channel,
    recipientAddress,
    channel === 'email' ? finalSubject : undefined
  );
  
  // 9. Determine from address
  const fromAddress = channel === 'email'
    ? provider.config.from_email || process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com'
    : provider.config.from_phone || process.env.TWILIO_FROM_PHONE || '';
  
  // 10. Create message record
  const message = await createMessage({
    org_id: record.org_id,
    record_id: recordId,
    thread_id: threadId,
    template_id: templateId || null,
    channel,
    direction: 'outbound',
    to_address: recipientAddress,
    from_address: fromAddress,
    subject: channel === 'email' ? finalSubject : null,
    body: finalBody,
    status: 'queued',
    provider: provider.type,
    provider_message_id: null,
    error: null,
    retry_count: 0,
    next_retry_at: null,
    meta: {
      template_name: template?.name,
      merge_context: mergeContext as unknown as Record<string, unknown>,
    },
    created_by: profileId || null,
    sent_at: null,
  });
  
  // 11. If dry run, stop here
  if (dryRun) {
    return {
      success: true,
      messageId: message.id,
      status: 'queued',
    };
  }
  
  // 12. Send immediately
  const result = await sendMessageNow(message, provider);
  
  return result;
}

/**
 * Send a message immediately
 */
export async function sendMessageNow(
  message: CrmMessage,
  provider?: CrmMessageProvider
): Promise<SendMessageResult> {
  // Update status to sending
  await updateMessageStatus(message.id, 'sending');
  await createMessageEvent(message.org_id, message.id, 'sending', {});
  
  // Get provider if not provided
  if (!provider) {
    provider = await getDefaultProvider(message.org_id, message.channel) ?? undefined;
    if (!provider) {
      await updateMessageStatus(message.id, 'failed', { error: 'No provider configured' });
      return {
        success: false,
        messageId: message.id,
        status: 'failed',
        error: 'No provider configured',
      };
    }
  }
  
  // Send via provider
  const result = await sendMessage(message.channel, {
    to: message.to_address,
    from: message.from_address || '',
    fromName: provider.config.from_name,
    subject: message.subject || undefined,
    body: message.body,
    replyTo: provider.config.reply_to,
    messageId: message.id,
  });
  
  if (result.success) {
    await updateMessageStatus(message.id, 'sent', {
      provider_message_id: result.providerMessageId,
      sent_at: new Date().toISOString(),
    });
    await createMessageEvent(message.org_id, message.id, 'sent', {
      provider_message_id: result.providerMessageId,
    });
    
    return {
      success: true,
      messageId: message.id,
      status: 'sent',
    };
  } else {
    // Handle failure with retry logic
    const newRetryCount = message.retry_count + 1;
    
    if (newRetryCount < MAX_RETRY_COUNT) {
      const retryDelay = RETRY_DELAYS[newRetryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
      
      await updateMessageStatus(message.id, 'queued', {
        retry_count: newRetryCount,
        next_retry_at: nextRetryAt,
        error: result.error,
      });
      
      await createMessageEvent(message.org_id, message.id, 'retry_scheduled', {
        retry_count: newRetryCount,
        next_retry_at: nextRetryAt,
        error: result.error,
      });
      
      return {
        success: false,
        messageId: message.id,
        status: 'queued',
        error: result.error,
      };
    } else {
      await updateMessageStatus(message.id, 'failed', {
        error: result.error,
      });
      
      await createMessageEvent(message.org_id, message.id, 'failed', {
        error: result.error,
        retry_count: newRetryCount,
      });
      
      return {
        success: false,
        messageId: message.id,
        status: 'failed',
        error: result.error,
      };
    }
  }
}

// ============================================================================
// Queue Processing
// ============================================================================

/**
 * Process queued messages that are ready to send
 */
export async function processMessageQueue(limit: number = 50): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const supabase = await createClient();
  
  // Get queued messages ready for send/retry
  const { data: messages, error } = await supabase
    .from('crm_messages')
    .select('*')
    .in('status', ['queued'])
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(limit);
  
  if (error || !messages) {
    return { processed: 0, sent: 0, failed: 0 };
  }
  
  let sent = 0;
  let failed = 0;
  
  for (const message of messages) {
    const result = await sendMessageNow(message as CrmMessage);
    if (result.status === 'sent' || result.status === 'delivered') {
      sent++;
    } else if (result.status === 'failed') {
      failed++;
    }
  }
  
  return {
    processed: messages.length,
    sent,
    failed,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { getContactPreferences, checkPreferences };
