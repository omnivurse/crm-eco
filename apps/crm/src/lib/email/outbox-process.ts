import { decrypt } from '@/lib/integrations/adapters/credentials';
import { COMMS_FLAGS, isCommsFlagEnabled } from '@/lib/email/comms-flags';
import {
  claimOutboxBatch,
  classifyProviderError,
  markOutboxAccepted,
  markOutboxFailed,
  markOutboxSubmitting,
  type OutboxRow,
} from '@/lib/email/outbox';
import { persistInputFromOutboxPayload, persistOutboundInboxMessage } from '@/lib/email/persist-inbox-reply';
import { sendViaResend, sendViaSendGrid } from '@/lib/email/send-service';
import {
  EMAIL_ATTACHMENT_BUCKET,
  requireOutboxAttachmentRefs,
  resolveOutboundAttachments,
  type ResolvedOutboundAttachment,
} from '@/lib/email/outbound-attachments';

type LooseClient = {
  from: (table: string) => any;
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{ data: Blob | null; error: { message?: string } | null }>;
    };
  };
};

type ResolvedProvider = {
  provider: 'resend' | 'sendgrid';
  apiKey: string;
};

async function resolveProvider(
  supabase: LooseClient,
  organizationId: string,
): Promise<ResolvedProvider | { error: string }> {
  const { data: connection } = await supabase
    .from('integration_connections')
    .select('provider, api_key_enc, status')
    .eq('org_id', organizationId)
    .eq('connection_type', 'email')
    .eq('status', 'connected')
    .maybeSingle();

  if (connection?.provider === 'sendgrid' && connection.api_key_enc) {
    return { provider: 'sendgrid', apiKey: decrypt(connection.api_key_enc) };
  }
  if (connection?.provider === 'resend' && connection.api_key_enc) {
    return { provider: 'resend', apiKey: decrypt(connection.api_key_enc) };
  }
  if (process.env.RESEND_API_KEY) {
    return { provider: 'resend', apiKey: process.env.RESEND_API_KEY };
  }
  return { error: 'No email provider configured' };
}

export async function submitOutboxRow(
  supabase: LooseClient,
  row: OutboxRow,
  resolvedProvider?: ResolvedProvider,
): Promise<{ success: boolean; messageId?: string; provider?: string; error?: string }> {
  const resolved = resolvedProvider ?? await resolveProvider(supabase, row.organization_id);
  if ('error' in resolved) {
    return { success: false, error: resolved.error };
  }

  const payload = row.payload ?? {};
  const fromName = row.from_name || 'Pay It Forward Health';
  const fromEmail = row.sender_address || process.env.RESEND_FROM_EMAIL || 'noreply@payitforwardhealth.com';

  let storedAttachments: ResolvedOutboundAttachment[];
  try {
    const refs = requireOutboxAttachmentRefs(payload.attachments);
    storedAttachments = await resolveOutboundAttachments({
      refs,
      inline: [],
      organizationId: row.organization_id,
      lookup: async (id) => {
        const { data } = await supabase
          .from('email_attachments')
          .select('file_path, file_name, mime_type, org_id')
          .eq('id', id)
          .eq('org_id', row.organization_id)
          .maybeSingle();
        return data ?? null;
      },
      download: async (path) => {
        const { data, error } = await supabase.storage
          .from(EMAIL_ATTACHMENT_BUCKET)
          .download(path);
        if (error || !data) {
          throw new Error(error?.message || 'Could not read the queued attachment.');
        }
        return new Uint8Array(await data.arrayBuffer());
      },
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not restore queued attachments.',
    };
  }

  // Rebuild the iTIP calendar part byte-identically from the stored payload so
  // worker retries send the same invite the first attempt did.
  const calendarAttachment = payload.calendar
    ? [{
        filename:
          payload.calendar.filename ??
          (payload.calendar.method === 'CANCEL' ? 'cancel.ics' : 'invite.ics'),
        contentType: `text/calendar; method=${payload.calendar.method}; charset=UTF-8`,
        content: Buffer.from(payload.calendar.ics, 'utf8').toString('base64'),
        size: Buffer.byteLength(payload.calendar.ics, 'utf8'),
      }]
    : undefined;
  const attachments = [
    ...storedAttachments,
    ...(calendarAttachment ?? []),
  ];

  if (resolved.provider === 'sendgrid') {
    const result = await sendViaSendGrid(resolved.apiKey, {
      from: { email: fromEmail, name: fromName },
      to: row.to_addresses,
      cc: row.cc_addresses,
      bcc: row.bcc_addresses,
      subject: row.subject,
      html: row.body_html ?? undefined,
      text: row.body_text ?? undefined,
      replyTo: row.reply_to ?? undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      calendar: payload.calendar ?? undefined,
      message_id: payload.rfc822_message_id,
      in_reply_to: payload.in_reply_to,
      references: payload.references,
    });
    return {
      success: result.success,
      messageId: result.message_id,
      provider: result.provider,
      error: result.error,
    };
  }

  const result = await sendViaResend(resolved.apiKey, {
    from: `${fromName} <${fromEmail}>`,
    to: row.to_addresses,
    cc: row.cc_addresses,
    bcc: row.bcc_addresses,
    subject: row.subject,
    html: row.body_html ?? undefined,
    text: row.body_text ?? undefined,
    reply_to: row.reply_to ?? undefined,
    unsubscribe_url: payload.unsubscribe_url ?? undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    idempotencyKey: row.idempotency_key,
    message_id: payload.rfc822_message_id,
    in_reply_to: payload.in_reply_to,
    references: payload.references,
  });
  return {
    success: result.success,
    messageId: result.message_id,
    provider: result.provider,
    error: result.error,
  };
}

async function logSentEmail(supabase: LooseClient, row: OutboxRow, result: {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}): Promise<void> {
  await supabase.from('sent_emails').insert({
    organization_id: row.organization_id,
    email_type: row.payload.email_type || row.payload.source || 'outbox',
    recipient_email: row.to_addresses[0],
    recipient_name: row.payload.to_name ?? null,
    cc_emails: row.cc_addresses,
    bcc_emails: row.bcc_addresses,
    subject: row.subject,
    body_html: row.body_html,
    body_text: row.body_text,
    from_email: row.sender_address,
    from_name: row.from_name,
    reply_to: row.reply_to,
    provider: result.provider,
    provider_message_id: result.messageId,
    status: result.success ? 'sent' : 'failed',
    error_message: result.error ?? null,
    sent_at: result.success ? new Date().toISOString() : null,
    enrollment_id: row.payload.enrollment_id ?? null,
    metadata: {
      outbox_id: row.id,
      campaign_id: row.payload.campaign_id,
      recipient_id: row.payload.recipient_id,
      sequence_id: row.payload.sequence_id,
      step_id: row.payload.step_id,
    },
  });
}

export async function processEmailOutbox(
  supabase: LooseClient,
  limit = 25,
): Promise<{ claimed: number; sent: number; failed: number; skipped: number }> {
  const claimed = await claimOutboxBatch(supabase, limit);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of claimed) {
    const kill = await isCommsFlagEnabled(supabase, COMMS_FLAGS.killSwitch, row.organization_id, false);
    if (kill) {
      skipped += 1;
      await markOutboxFailed(
        supabase,
        row.id,
        row.organization_id,
        'Outbound email is paused (crm.comms.kill_switch).',
        'transient',
        row.attempt_count,
      );
      continue;
    }

    const resolvedProvider = await resolveProvider(supabase, row.organization_id);
    if ('error' in resolvedProvider) {
      await markOutboxFailed(
        supabase,
        row.id,
        row.organization_id,
        resolvedProvider.error,
        'permanent',
        row.attempt_count + 1,
      );
      failed += 1;
      continue;
    }

    await markOutboxSubmitting(
      supabase,
      row.id,
      row.organization_id,
      resolvedProvider.provider,
    );
    const result = await submitOutboxRow(supabase, row, resolvedProvider);
    if (result.success && result.messageId) {
      await markOutboxAccepted(
        supabase,
        row.id,
        row.organization_id,
        result.provider || 'resend',
        result.messageId,
      );
      await logSentEmail(supabase, row, result);
      const persist = persistInputFromOutboxPayload(row.organization_id, {
        ...row,
        provider: result.provider,
        provider_message_id: result.messageId,
      });
      if (persist?.rfc822MessageId) {
        await persistOutboundInboxMessage(supabase, persist);
      }
      sent += 1;
    } else {
      await markOutboxFailed(
        supabase,
        row.id,
        row.organization_id,
        result.error || 'Provider submit failed',
        classifyProviderError(null, result.error),
        row.attempt_count + 1,
      );
      failed += 1;
    }
  }

  return { claimed: claimed.length, sent, failed, skipped };
}
