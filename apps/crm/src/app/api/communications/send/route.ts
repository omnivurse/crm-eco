import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getAuthProfile, createClient } from '@/lib/supabase-server';
import { sendEmail, sendSms } from '@/lib/email/send-service';
import { rateLimitDurable, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';
import {
  collectJsonAttachmentRefs,
  fileToInline,
  splitRecipientField,
  type InlineOutboundFile,
  type OutboundAttachmentRef,
} from '@/lib/email/outbound-attachments';

/**
 * Deliberately loose e-mail shape check: one @, no whitespace/control chars,
 * a dot in the domain. Tight enough to stop header-breaking garbage without
 * rejecting valid unusual addresses.
 */
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+[.][^@\s]+$/;

const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/communications/send
 * Send an email or SMS through configured providers
 */
export async function POST(request: NextRequest) {
  try {
    // Auth guard
    const { user } = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const profile = await getAuthProfile();

    // Two limits guard outbound sends, because each catches what the other misses.
    //
    // The atomic one comes first: counting sent_emails rows is a read, so N
    // concurrent requests can all observe a count under the cap and all proceed.
    // It also keys off the caller rather than the profile, so a request without a
    // resolvable profile is still metered instead of being unlimited.
    const rl = await rateLimitDurable(`communications_send_${profile?.id ?? user.id}`, {
      limit: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_MS / 1000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} emails per hour.` },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // The row count stays as the ground-truth backstop: it reflects sends that
    // actually happened, so it still holds if the counter is ever reset or lost.
    if (profile) {
      const supabase = await createClient();
      const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      const { count } = await supabase
        .from('sent_emails')
        .select('id', { count: 'exact', head: true })
        .eq('metadata->>sent_by', profile.id)
        .gte('sent_at', oneHourAgo);

      if (count !== null && count >= RATE_LIMIT_MAX) {
        return NextResponse.json(
          { error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} emails per hour.` },
          { status: 429 }
        );
      }
    }

    // Parse body — handle both JSON and FormData
    let body: Record<string, unknown>;
    let attachmentRefs: OutboundAttachmentRef[] = [];
    let inlineAttachments: InlineOutboundFile[] = [];
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {};
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') {
          if (key === 'to' || key === 'cc' || key === 'bcc') {
            body[key] = splitRecipientField(value);
          } else if (key !== 'attachments') {
            body[key] = value;
          }
          continue;
        }
        if (value instanceof File && (key === 'attachments' || key === 'attachment')) {
          inlineAttachments.push(await fileToInline(value));
        }
      }
    } else {
      body = await request.json();
      attachmentRefs = collectJsonAttachmentRefs(body.attachments);
    }

    // Multipart form fields arrive as strings — 'false' is truthy, so a
    // FormData caller could never opt out of inbox persistence.
    if (typeof body.persist_inbox === 'string') {
      body.persist_inbox = body.persist_inbox !== 'false' && body.persist_inbox !== '0';
    }
    if (typeof body.references === 'string') {
      body.references = splitRecipientField(body.references);
    }

    const { channel, ...params } = body;

    if (!channel) {
      return NextResponse.json(
        { error: 'Missing required field: channel (email or sms)' },
        { status: 400 }
      );
    }
    
    if (channel === 'email') {
      // Validate email params
      if (!params.to || !params.subject) {
        return NextResponse.json(
          { error: 'Missing required fields for email: to, subject' },
          { status: 400 }
        );
      }
      
      if (!params.body_html && !params.body_text) {
        return NextResponse.json(
          { error: 'Email must have body_html or body_text' },
          { status: 400 }
        );
      }

      // Recipient hygiene: this 1:1 path previously accepted any strings and
      // any count — a single request could bulk-mail thousands via bcc,
      // bypassing every campaign throttle. Cap matches Resend's 50-recipient
      // per-message limit; real bulk belongs in campaigns.
      const toList = Array.isArray(params.to) ? (params.to as string[]) : [params.to as string];
      const ccList = (params.cc as string[] | undefined) ?? [];
      const bccList = (params.bcc as string[] | undefined) ?? [];
      const allRecipients = [...toList, ...ccList, ...bccList];
      if (allRecipients.length > 50) {
        return NextResponse.json(
          { error: 'Too many recipients (max 50 across to/cc/bcc). Use a campaign for bulk sends.' },
          { status: 400 }
        );
      }
      const invalidRecipient = allRecipients.find(
        (addr) => typeof addr !== 'string' || !EMAIL_SHAPE.test(addr.trim())
      );
      if (invalidRecipient !== undefined) {
        return NextResponse.json(
          { error: `Invalid recipient address: "${String(invalidRecipient).slice(0, 100)}"` },
          { status: 400 }
        );
      }
      
      const result = await sendEmail({
        to: params.to as string | string[],
        subject: params.subject as string,
        body_html: params.body_html as string | undefined,
        body_text: params.body_text as string | undefined,
        cc: params.cc as string[] | undefined,
        bcc: params.bcc as string[] | undefined,
        from_email: params.from_email as string | undefined,
        from_name: params.from_name as string | undefined,
        reply_to: params.reply_to as string | undefined,
        template_id: params.template_id as string | undefined,
        template_variables: params.template_variables as Record<string, unknown> | undefined,
        linked_contact_id: params.linked_contact_id as string | undefined,
        linked_lead_id: params.linked_lead_id as string | undefined,
        linked_deal_id: params.linked_deal_id as string | undefined,
        attachments: attachmentRefs,
        inline_attachments: inlineAttachments,
        conversation_id: params.conversation_id as string | undefined,
        to_name: params.to_name as string | undefined,
        rfc822_message_id: params.rfc822_message_id as string | undefined,
        in_reply_to: params.in_reply_to as string | undefined,
        references: params.references as string[] | undefined,
        persist_inbox: params.persist_inbox !== false,
        idempotency_key:
          (params.idempotency_key as string | undefined) ||
          request.headers.get('Idempotency-Key') ||
          undefined,
      });
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send email' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        channel: 'email',
        message_id: result.message_id,
        provider: result.provider,
        rfc822_message_id: result.rfc822_message_id,
        outbox_id: result.outbox_id,
        inbox_message_id: result.inbox_message_id,
      });
    }
    
    if (channel === 'sms') {
      // Validate SMS params
      if (!params.to || !params.body) {
        return NextResponse.json(
          { error: 'Missing required fields for SMS: to, body' },
          { status: 400 }
        );
      }
      
      const result = await sendSms({
        to: params.to as string,
        body: params.body as string,
        linked_contact_id: params.linked_contact_id as string | undefined,
        linked_lead_id: params.linked_lead_id as string | undefined,
        linked_deal_id: params.linked_deal_id as string | undefined,
      });
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send SMS' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        channel: 'sms',
        message_id: result.message_id,
        provider: result.provider,
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid channel. Must be "email" or "sms"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/communications/send:', error);
    return NextResponse.json(
      { error: 'Failed to send communication' },
      { status: 500 }
    );
  }
}
