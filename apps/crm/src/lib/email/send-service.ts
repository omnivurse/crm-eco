import { createClient, getAuthUser, getAuthProfile } from '@/lib/supabase-server';
import { createLog } from '@/lib/integrations';
import { decrypt } from '@/lib/integrations/adapters/credentials';
import {
  EMAIL_ATTACHMENT_BUCKET,
  buildResendSendPayload,
  resolveOutboundAttachments,
  toSendGridAttachments,
  type InlineOutboundFile,
  type OutboundAttachmentRef,
  type ResolvedOutboundAttachment,
} from '@/lib/email/outbound-attachments';
import { COMMS_FLAGS, isCommsFlagEnabled } from '@/lib/email/comms-flags';
import {
  domainFromEmail,
  generateRfc822MessageId,
  normalizeRfc822Id,
} from '@/lib/email/rfc822';
import {
  enqueueOutbox,
  markOutboxAccepted,
  markOutboxFailed,
  markOutboxSubmitting,
  outboxAlreadyAccepted,
  classifyProviderError,
  createOutboxAdminClient,
  type OutboxRow,
} from '@/lib/email/outbox';
import { persistOutboundInboxMessage } from '@/lib/email/persist-inbox-reply';
import { sanitizeOutboundEmailHtml } from '@/lib/email/email-sanitize';
import { inboundReplyTo } from '@crm-eco/lib/email';

// ============================================================================
// Email Send Service
// Send emails via configured providers and log results
// ============================================================================

/** Strip HTML tags to produce a plain-text fallback for multipart emails */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body_html?: string;
  body_text?: string;
  cc?: string[];
  bcc?: string[];
  /** Registered org sender address (preferred over integration/env default). */
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  template_id?: string;
  template_variables?: Record<string, unknown>;
  linked_contact_id?: string;
  linked_lead_id?: string;
  linked_deal_id?: string;
  /** Stored composer uploads (`email-attachments` bucket). */
  attachments?: OutboundAttachmentRef[];
  /** Raw files from multipart `/api/communications/send`. */
  inline_attachments?: InlineOutboundFile[];
  /** Persist outbound copy on this inbox thread (server-side, not the client). */
  conversation_id?: string;
  to_name?: string;
  rfc822_message_id?: string;
  in_reply_to?: string | null;
  references?: string[];
  persist_inbox?: boolean;
  idempotency_key?: string;
  /** iTIP calendar part (meeting invites) — rides as a text/calendar attachment. */
  calendar?: { method: 'REQUEST' | 'CANCEL'; ics: string; filename?: string };
  /** Stamped into the persisted inbox message metadata so the thread renders a meeting card. */
  calendar_event_id?: string;
}

export interface SendEmailResult {
  success: boolean;
  message_id?: string;
  provider?: string;
  error?: string;
  rfc822_message_id?: string;
  outbox_id?: string;
  inbox_message_id?: string;
}

export interface SendSmsParams {
  to: string;
  body: string;
  linked_contact_id?: string;
  linked_lead_id?: string;
  linked_deal_id?: string;
}

export interface SendSmsResult {
  success: boolean;
  message_id?: string;
  provider?: string;
  error?: string;
}


// ============================================================================
// Email Sending
// ============================================================================

/**
 * Send an email through the configured provider
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const supabase = await createClient() as any;
  
  // Get current user and org using cached auth helpers
  const { user, error: authError } = await getAuthUser();
  if (!user || authError) {
    return { success: false, error: 'User not authenticated' };
  }

  // Get extended profile with email and full_name
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, email, full_name')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return { success: false, error: 'User profile not found' };
  }
  
  // Get organization settings for email
  const { data: org } = await supabase
    .from('organizations')
    .select('name, settings')
    .eq('id', profile.organization_id)
    .single();
  
  // Get email integration connection
  const { data: emailConnection } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('org_id', profile.organization_id)
    .eq('connection_type', 'email')
    .eq('status', 'connected')
    .single();
  
  const toEmails = Array.isArray(params.to) ? params.to : [params.to];
  const fromName =
    params.from_name ||
    process.env.RESEND_FROM_NAME ||
    org?.name ||
    'Pay It Forward Health';

  // Prefer explicit registered sender, then integration/env — never personal user email as FROM
  const integrationFromEmail = emailConnection?.settings?.from_email as string | undefined;
  const fromEmail =
    params.from_email ||
    integrationFromEmail ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.FROM_EMAIL ||
    'noreply@payitforwardhealth.com';
  const replyTo = inboundReplyTo(
    params.reply_to ||
      process.env.SUPPORT_EMAIL ||
      'support@payitforwardhealth.com',
  );

  // Server-owned sanitization: every producer (composer, reply dock, record
  // sends, automations) passes through sendEmail, so raw editor/Source-mode
  // HTML never reaches providers, the outbox, sent_emails, or inbox_messages.
  const bodyHtml = params.body_html ? sanitizeOutboundEmailHtml(params.body_html) : params.body_html;

  // Auto-generate plain text from HTML if not provided (improves deliverability)
  const bodyText = params.body_text || (bodyHtml ? htmlToPlainText(bodyHtml) : undefined);

  let outboundAttachments: ResolvedOutboundAttachment[] = [];
  try {
    outboundAttachments = await resolveOutboundAttachments({
      refs: params.attachments ?? [],
      inline: params.inline_attachments ?? [],
      organizationId: profile.organization_id,
      lookup: async (id) => {
        const { data } = await supabase
          .from('email_attachments')
          .select('file_path, file_name, mime_type, org_id')
          .eq('id', id)
          .eq('org_id', profile.organization_id)
          .maybeSingle();
        return data ?? null;
      },
      download: async (path) => {
        const { data, error } = await supabase.storage
          .from(EMAIL_ATTACHMENT_BUCKET)
          .download(path);
        if (error || !data) {
          throw new Error('Could not read the attached file.');
        }
        return new Uint8Array(await data.arrayBuffer());
      },
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to attach files',
    };
  }

  if (params.calendar) {
    // The iTIP part travels as an attachment whose content type carries the
    // method parameter — Gmail/Outlook parse it and render native RSVP chips.
    outboundAttachments.push({
      filename:
        params.calendar.filename ??
        (params.calendar.method === 'CANCEL' ? 'cancel.ics' : 'invite.ics'),
      contentType: `text/calendar; method=${params.calendar.method}; charset=UTF-8`,
      content: Buffer.from(params.calendar.ics, 'utf8').toString('base64'),
      size: Buffer.byteLength(params.calendar.ics, 'utf8'),
    });
  }

  // Determine provider and send
  let result: SendEmailResult;
  const provider = emailConnection?.provider || 'resend';
  const startTime = Date.now();
  const sendTimeoutMs = outboundAttachments.length > 0 ? 60_000 : 30_000;
  const rfc822MessageId =
    normalizeRfc822Id(params.rfc822_message_id) ||
    generateRfc822MessageId(domainFromEmail(fromEmail));
  const inReplyTo = normalizeRfc822Id(params.in_reply_to);
  const references = (params.references ?? [])
    .map((id) => normalizeRfc822Id(id))
    .filter((id): id is string => Boolean(id));

  try {
    // Get unsubscribe URL from integration settings for RFC 8058 compliance
    const unsubscribeUrl = (emailConnection?.settings?.unsubscribe_url as string | undefined)
      || (org?.settings as Record<string, unknown> | undefined)?.unsubscribe_url as string | undefined;

    const killSwitch = await isCommsFlagEnabled(
      supabase,
      COMMS_FLAGS.killSwitch,
      profile.organization_id,
      false,
    );
    if (killSwitch) {
      return { success: false, error: 'Outbound email is paused (crm.comms.kill_switch).' };
    }

    const useOutbox = await isCommsFlagEnabled(
      supabase,
      COMMS_FLAGS.outboxSend,
      profile.organization_id,
      false,
    );

    let outboxRow: OutboxRow | null = null;
    if (useOutbox) {
      const idempotencyKey =
        params.idempotency_key ||
        (params.conversation_id
          ? `inbox-reply/${params.conversation_id}/${rfc822MessageId}`
          : `crm-send/${profile.id}/${rfc822MessageId}`);
      const outboxAdmin = createOutboxAdminClient();
      const enqueued = await enqueueOutbox(outboxAdmin, {
        organizationId: profile.organization_id,
        idempotencyKey,
        senderAddress: fromEmail,
        fromName,
        replyTo,
        toAddresses: toEmails,
        ccAddresses: params.cc,
        bccAddresses: params.bcc,
        subject: params.subject,
        bodyHtml,
        bodyText,
        conversationId: params.conversation_id ?? null,
        linkedContactId: params.linked_contact_id ?? null,
        linkedLeadId: params.linked_lead_id ?? null,
        linkedDealId: params.linked_deal_id ?? null,
        createdBy: user.id,
        payload: {
          rfc822_message_id: rfc822MessageId,
          in_reply_to: inReplyTo,
          references,
          persist_inbox: params.persist_inbox !== false && Boolean(params.conversation_id),
          to_name: params.to_name ?? null,
          unsubscribe_url: unsubscribeUrl ?? null,
          source: 'communications.send',
          calendar: params.calendar ?? null,
          calendar_event_id: params.calendar_event_id ?? null,
          attachments: outboundAttachments.map((attachment) => ({
            filename: attachment.filename,
            content_type: attachment.contentType,
            size: attachment.size,
          })),
        },
      });
      outboxRow = enqueued.row;
      if (outboxAlreadyAccepted(outboxRow)) {
        return {
          success: true,
          message_id: outboxRow.provider_message_id ?? undefined,
          provider: outboxRow.provider ?? provider,
          rfc822_message_id: rfc822MessageId,
          outbox_id: outboxRow.id,
        };
      }
      await markOutboxSubmitting(outboxAdmin, outboxRow.id, profile.organization_id);
    }

    const threadHeaders = {
      message_id: rfc822MessageId,
      in_reply_to: inReplyTo,
      references,
    };

    if (provider === 'sendgrid' && emailConnection?.api_key_enc) {
      const apiKey = decrypt(emailConnection.api_key_enc);
      result = await sendViaSendGrid(apiKey, {
        from: { email: fromEmail, name: fromName },
        to: toEmails,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: bodyHtml,
        text: bodyText,
        replyTo: replyTo,
        attachments: outboundAttachments,
        calendar: params.calendar,
        timeoutMs: sendTimeoutMs,
        ...threadHeaders,
      });
    } else if (provider === 'resend' && emailConnection?.api_key_enc) {
      const apiKey = decrypt(emailConnection.api_key_enc);
      result = await sendViaResend(apiKey, {
        from: `${fromName} <${fromEmail}>`,
        to: toEmails,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: bodyHtml,
        text: bodyText,
        reply_to: replyTo,
        unsubscribe_url: unsubscribeUrl,
        attachments: outboundAttachments,
        timeoutMs: sendTimeoutMs,
        idempotencyKey: outboxRow?.idempotency_key,
        ...threadHeaders,
      });
    } else if (process.env.RESEND_API_KEY) {
      // Fallback to system Resend API key when no org integration is configured
      result = await sendViaResend(process.env.RESEND_API_KEY, {
        from: `${fromName} <${fromEmail}>`,
        to: toEmails,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: bodyHtml,
        text: bodyText,
        reply_to: replyTo,
        unsubscribe_url: unsubscribeUrl,
        attachments: outboundAttachments,
        timeoutMs: sendTimeoutMs,
        idempotencyKey: outboxRow?.idempotency_key,
        ...threadHeaders,
      });
    } else {
      return {
        success: false,
        error: 'No email provider configured. Set up an email integration in Settings > Integrations.',
        provider: 'none',
      };
    }

    if (outboxRow) {
      const outboxAdmin = createOutboxAdminClient();
      if (result.success && result.message_id) {
        await markOutboxAccepted(
          outboxAdmin,
          outboxRow.id,
          profile.organization_id,
          result.provider || provider,
          result.message_id,
        );
      } else {
        await markOutboxFailed(
          outboxAdmin,
          outboxRow.id,
          profile.organization_id,
          result.error || 'Provider submit failed',
          classifyProviderError(null, result.error),
          (outboxRow.attempt_count ?? 0) + 1,
        );
      }
    }

    result = {
      ...result,
      rfc822_message_id: rfc822MessageId,
      outbox_id: outboxRow?.id,
    };
    
    // Log to sent_emails
    const { error: sentEmailError } = await supabase.from('sent_emails').insert({
      organization_id: profile.organization_id,
      email_type: 'crm_outbound',
      recipient_email: toEmails[0],
      recipient_name: null,
      cc_emails: params.cc || [],
      bcc_emails: params.bcc || [],
      subject: params.subject,
      body_html: bodyHtml,
      body_text: params.body_text,
      from_email: fromEmail,
      from_name: fromName,
      reply_to: replyTo,
      template_id: params.template_id,
      provider: provider,
      provider_message_id: result.message_id,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error,
      sent_at: result.success ? new Date().toISOString() : null,
      metadata: {
        sent_by: profile.id,
        to_emails: toEmails,
        template_variables: params.template_variables,
        linked_contact_id: params.linked_contact_id,
        linked_lead_id: params.linked_lead_id,
        linked_deal_id: params.linked_deal_id,
        attachments: outboundAttachments.map((attachment) => ({
          filename: attachment.filename,
          content_type: attachment.contentType,
          size: attachment.size,
        })),
      },
    });

    if (sentEmailError) {
      console.error('Failed to log sent_email:', sentEmailError);
      return { success: false, error: 'Email sent but failed to log to sent_emails', provider };
    }

    // Log to integration logs
    if (emailConnection) {
      await createLog({
        connection_id: emailConnection.id,
        event_type: 'api_call',
        provider: provider,
        direction: 'outbound',
        method: 'POST',
        endpoint: '/send',
        status: result.success ? 'success' : 'error',
        error_message: result.error,
        duration_ms: Date.now() - startTime,
        entity_type: params.linked_contact_id ? 'contact' : params.linked_lead_id ? 'lead' : undefined,
        entity_id: params.linked_contact_id || params.linked_lead_id,
      });
    }

    // Create CRM activity.
    // crm_activities uses `org_id` (not `organization_id`) and references
    // crm_modules.id via `module_id` (the legacy `module_key` text column
    // never existed). Resolve the module by key for the tenant; fall back
    // to null so the activity still saves if the module is missing.
    if (result.success && (params.linked_contact_id || params.linked_lead_id || params.linked_deal_id)) {
      const moduleKey = params.linked_contact_id ? 'Contacts' : params.linked_lead_id ? 'Leads' : 'Deals';

      const { data: moduleRow } = await supabase
        .from('crm_modules')
        .select('id')
        .eq('org_id', profile.organization_id)
        .eq('key', moduleKey)
        .maybeSingle();

      const { error: activityError } = await supabase.from('crm_activities').insert({
        org_id: profile.organization_id,
        record_id: params.linked_contact_id || params.linked_lead_id || params.linked_deal_id,
        module_id: moduleRow?.id ?? null,
        activity_type: 'email',
        description: `Email sent: ${params.subject}`,
        created_by: profile.id,
        metadata: {
          module_key: moduleKey,
          to: toEmails,
          subject: params.subject,
          provider: provider,
          message_id: result.message_id,
        },
      });

      if (activityError) {
        console.error('Failed to log crm_activity:', activityError);
      }
    }

    if (result.success && params.conversation_id && params.persist_inbox !== false) {
      const inbox = await persistOutboundInboxMessage(createOutboxAdminClient(), {
        organizationId: profile.organization_id,
        conversationId: params.conversation_id,
        fromAddress: fromEmail,
        fromName,
        toAddress: toEmails[0],
        toName: params.to_name ?? null,
        ccAddresses: (params.cc ?? []).map((email) => ({ email })),
        bccAddresses: (params.bcc ?? []).map((email) => ({ email })),
        subject: params.subject,
        bodyHtml,
        bodyText,
        rfc822MessageId,
        calendarEventId: params.calendar_event_id ?? null,
        inReplyTo,
        references,
        provider: result.provider || provider,
        providerMessageId: result.message_id ?? null,
      });
      result = { ...result, inbox_message_id: inbox?.id };
    }

    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SMS Sending
// ============================================================================

/**
 * Send an SMS through Twilio
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const supabase = await createClient() as any;
  
  // Get current user and org using cached auth helpers
  const { user, error: authError } = await getAuthUser();
  if (!user || authError) {
    return { success: false, error: 'User not authenticated' };
  }

  const profile = await getAuthProfile();
  if (!profile) {
    return { success: false, error: 'User profile not found' };
  }
  
  // Get Twilio connection
  const { data: twilioConnection } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('org_id', profile.organization_id)
    .eq('provider', 'twilio')
    .eq('status', 'connected')
    .single();
  
  const startTime = Date.now();
  let result: SendSmsResult;
  
  try {
    if (twilioConnection?.api_key_enc && twilioConnection?.api_secret_enc) {
      const accountSid = decrypt(twilioConnection.api_key_enc);
      const authToken = decrypt(twilioConnection.api_secret_enc);
      result = await sendViaTwilio(
        accountSid,
        authToken,
        twilioConnection.settings?.phone_number as string || '',
        params.to,
        params.body
      );
    } else {
      return {
        success: false,
        error: 'No SMS provider configured. Set up a Twilio integration in Settings > Integrations.',
        provider: 'none',
      };
    }
    
    // Log to sent_sms_log
    await supabase.from('sent_sms_log').insert({
      org_id: profile.organization_id,
      sent_by: profile.id,
      from_number: twilioConnection?.settings?.phone_number,
      to_number: params.to,
      body: params.body,
      provider: 'twilio',
      provider_message_id: result.message_id,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error,
      linked_contact_id: params.linked_contact_id,
      linked_lead_id: params.linked_lead_id,
      linked_deal_id: params.linked_deal_id,
      sent_at: result.success ? new Date().toISOString() : null,
    });
    
    // Log to integration logs
    if (twilioConnection) {
      await createLog({
        connection_id: twilioConnection.id,
        event_type: 'api_call',
        provider: 'twilio',
        direction: 'outbound',
        method: 'POST',
        endpoint: '/messages',
        status: result.success ? 'success' : 'error',
        error_message: result.error,
        duration_ms: Date.now() - startTime,
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Provider Implementations
// ============================================================================

export async function sendViaSendGrid(
  apiKey: string,
  params: {
    from: { email: string; name: string };
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    attachments?: ResolvedOutboundAttachment[];
    calendar?: { method: 'REQUEST' | 'CANCEL'; ics: string };
    timeoutMs?: number;
    message_id?: string;
    in_reply_to?: string | null;
    references?: string[];
  }
): Promise<SendEmailResult> {
  const headers: Array<{ key: string; value: string }> = [];
  if (params.message_id) headers.push({ key: 'Message-ID', value: params.message_id });
  if (params.in_reply_to) headers.push({ key: 'In-Reply-To', value: params.in_reply_to });
  if (params.references?.length) headers.push({ key: 'References', value: params.references.join(' ') });

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    signal: AbortSignal.timeout(params.timeoutMs ?? 30_000),
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: params.to.map(email => ({ email })),
        cc: params.cc?.map(email => ({ email })),
        bcc: params.bcc?.map(email => ({ email })),
      }],
      from: params.from,
      reply_to: params.replyTo ? { email: params.replyTo } : undefined,
      subject: params.subject,
      headers: headers.length > 0 ? Object.fromEntries(headers.map((h) => [h.key, h.value])) : undefined,
      content: [
        params.text ? { type: 'text/plain', value: params.text } : null,
        params.html ? { type: 'text/html', value: params.html } : null,
        // SendGrid builds multipart/alternative from content[] — the
        // text/calendar part is what makes Gmail/Outlook show RSVP chips.
        params.calendar
          ? { type: `text/calendar; method=${params.calendar.method}`, value: params.calendar.ics }
          : null,
      ].filter(Boolean),
      attachments: params.attachments?.length
        ? toSendGridAttachments(params.attachments)
        : undefined,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    return { success: false, error, provider: 'sendgrid' };
  }
  
  const messageId = response.headers.get('X-Message-Id') || `sg_${Date.now()}`;
  return { success: true, message_id: messageId, provider: 'sendgrid' };
}

export async function sendViaResend(
  apiKey: string,
  params: {
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html?: string;
    text?: string;
    reply_to?: string;
    unsubscribe_url?: string;
    attachments?: ResolvedOutboundAttachment[];
    timeoutMs?: number;
    idempotencyKey?: string;
    message_id?: string;
    in_reply_to?: string | null;
    references?: string[];
  }
): Promise<SendEmailResult> {
  const payload = buildResendSendPayload({
    from: params.from,
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    html: params.html,
    text: params.text,
    reply_to: params.reply_to,
    unsubscribe_url: params.unsubscribe_url,
    attachments: params.attachments,
    message_id: params.message_id,
    in_reply_to: params.in_reply_to,
    references: params.references,
  });

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (params.idempotencyKey) {
    headers['Idempotency-Key'] = params.idempotencyKey;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(params.timeoutMs ?? 30_000),
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    return { success: false, error: error.message || 'Resend error', provider: 'resend' };
  }

  const data = await response.json();
  return { success: true, message_id: data.id, provider: 'resend' };
}

async function sendViaTwilio(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  body: string
): Promise<SendSmsResult> {
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: body,
      }).toString(),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    return { success: false, error: error.message || 'Twilio error', provider: 'twilio' };
  }
  
  const data = await response.json();
  return { success: true, message_id: data.sid, provider: 'twilio' };
}
