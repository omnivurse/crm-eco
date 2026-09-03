import type { OutboxPayload } from './outbox';
import { mailboxAddressForOutbound } from '@/lib/inbox/compose-mailbox';
import type { OutboundAttachmentRef } from './outbound-attachments';

type LooseClient = {
  from: (table: string) => any;
};

/** Inbox-shaped attachment chip — MessageThread signs via file_path. */
export type InboxPersistedAttachment = {
  filename: string;
  content_type: string;
  size: number;
  file_path: string;
};

export type PersistOutboundInboxInput = {
  organizationId: string;
  conversationId: string;
  fromAddress: string;
  fromName: string | null;
  toAddress: string;
  toName?: string | null;
  ccAddresses?: Array<{ email: string; name?: string }>;
  bccAddresses?: Array<{ email: string; name?: string }>;
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  rfc822MessageId: string;
  inReplyTo?: string | null;
  references?: string[];
  provider?: string | null;
  providerMessageId?: string | null;
  /** When set, the thread renders a meeting card for this message. */
  calendarEventId?: string | null;
  attachments?: InboxPersistedAttachment[];
};

function orgScopedPath(path: string | undefined, organizationId: string): string | null {
  if (!path) return null;
  return path.startsWith(`${organizationId}/`) ? path : null;
}

/**
 * Keep only attachments that can be signed later. Metadata-only rows render
 * as "Unavailable" chips — skip them rather than persist a dead handle.
 */
export function inboxAttachmentsFromRefs(
  refs: Array<{
    filename?: string;
    file_name?: string;
    content_type?: string;
    mime_type?: string;
    size?: number;
    file_size?: number;
    file_path?: string;
    bucket_path?: string;
  }> | undefined,
  organizationId: string,
): InboxPersistedAttachment[] {
  if (!refs?.length) return [];
  const out: InboxPersistedAttachment[] = [];
  for (const ref of refs) {
    const file_path = orgScopedPath(ref.file_path || ref.bucket_path, organizationId);
    if (!file_path) continue;
    const filename = (ref.filename || ref.file_name || 'attachment').trim() || 'attachment';
    out.push({
      filename,
      content_type: ref.content_type || ref.mime_type || 'application/octet-stream',
      size: typeof ref.size === 'number' ? ref.size : typeof ref.file_size === 'number' ? ref.file_size : 0,
      file_path,
    });
  }
  return out;
}

export function inboxAttachmentsFromOutboundRefs(
  refs: OutboundAttachmentRef[] | undefined,
  organizationId: string,
): InboxPersistedAttachment[] {
  return inboxAttachmentsFromRefs(refs, organizationId);
}

export async function persistOutboundInboxMessage(
  supabase: LooseClient,
  input: PersistOutboundInboxInput,
): Promise<{ id: string } | null> {
  // Tenant guard: conversation_id arrives from the request body and this
  // insert runs with the service-role client, whose AFTER INSERT trigger then
  // updates the referenced inbox_conversations row (counters, preview) with
  // no org check of its own. Never write to a conversation outside the
  // sender's organization.
  const { data: conversation, error: conversationError } = await supabase
    .from('inbox_conversations')
    .select('id')
    .eq('id', input.conversationId)
    .eq('org_id', input.organizationId)
    .maybeSingle();

  if (conversationError || !conversation) {
    console.error('[email] refusing outbound persist: conversation not found in org', {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      error: conversationError?.message ?? null,
    });
    return null;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('inbox_messages')
    .insert({
      org_id: input.organizationId,
      organization_id: input.organizationId,
      conversation_id: input.conversationId,
      channel: 'email',
      direction: 'outbound',
      from_name: input.fromName,
      from_address: input.fromAddress,
      to_address: input.toAddress,
      to_name: input.toName ?? null,
      subject: input.subject,
      body_html: input.bodyHtml ?? null,
      body_text: input.bodyText ?? null,
      cc_addresses: input.ccAddresses ?? [],
      bcc_addresses: input.bccAddresses ?? [],
      message_id: input.rfc822MessageId,
      in_reply_to: input.inReplyTo ?? null,
      references_ids: input.references && input.references.length > 0 ? input.references : null,
      status: 'sent',
      sent_at: now,
      external_id: input.providerMessageId ?? null,
      external_provider: input.provider ?? null,
      attachments: input.attachments ?? [],
      metadata: input.calendarEventId ? { calendar_event_id: input.calendarEventId } : {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[email] persist outbound inbox message failed', {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      error: error.message ?? String(error),
      code: error.code ?? null,
      details: error.details ?? null,
    });
    return null;
  }

  return data as { id: string };
}

export type PersistNewOutboundThreadInput = Omit<PersistOutboundInboxInput, 'conversationId'> & {
  assignedTo?: string | null;
};

export async function persistNewOutboundThread(
  supabase: LooseClient,
  input: PersistNewOutboundThreadInput,
): Promise<{ conversationId: string; messageId: string } | null> {
  const now = new Date().toISOString();
  const plainPreview = (input.bodyText || input.bodyHtml || '')
    .replace(/<[^>]*>/g, '')
    .slice(0, 200);

  const { data: conv, error: convError } = await supabase
    .from('inbox_conversations')
    .insert({
      org_id: input.organizationId,
      organization_id: input.organizationId,
      channel: 'email',
      thread_id: input.rfc822MessageId,
      subject: input.subject || null,
      preview: plainPreview,
      contact_email: input.toAddress,
      contact_name: input.toName ?? null,
      status: 'open',
      priority: 'normal',
      mailbox_address: mailboxAddressForOutbound(input.fromAddress),
      assigned_to: input.assignedTo ?? null,
      assigned_at: input.assignedTo ? now : null,
      unread_count: 0,
      message_count: 1,
      last_message_at: now,
      first_message_at: now,
      tags: [],
      labels: [],
      metadata: {},
    })
    .select('id')
    .single();

  if (convError || !conv) {
    console.error('[email] refusing new outbound thread: conversation insert failed', {
      organizationId: input.organizationId,
      error: convError?.message ?? null,
    });
    return null;
  }

  const message = await persistOutboundInboxMessage(supabase, {
    ...input,
    conversationId: conv.id,
  });
  if (!message) return null;
  return { conversationId: conv.id, messageId: message.id };
}

export function persistInputFromOutboxPayload(
  organizationId: string,
  row: {
    conversation_id: string | null;
    sender_address: string | null;
    from_name: string | null;
    to_addresses: string[];
    cc_addresses: string[];
    bcc_addresses: string[];
    subject: string;
    body_html: string | null;
    body_text: string | null;
    payload: OutboxPayload;
    provider?: string | null;
    provider_message_id?: string | null;
  },
): PersistOutboundInboxInput | null {
  if (!row.conversation_id || !row.sender_address || !row.to_addresses[0]) return null;
  if (row.payload.persist_inbox === false) return null;
  return {
    organizationId,
    conversationId: row.conversation_id,
    fromAddress: row.sender_address,
    fromName: row.from_name,
    toAddress: row.to_addresses[0],
    toName: row.payload.to_name ?? null,
    ccAddresses: (row.cc_addresses ?? []).map((email) => ({ email })),
    bccAddresses: (row.bcc_addresses ?? []).map((email) => ({ email })),
    subject: row.subject,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    rfc822MessageId: row.payload.rfc822_message_id ?? '',
    inReplyTo: row.payload.in_reply_to ?? null,
    references: row.payload.references ?? [],
    provider: row.provider ?? null,
    providerMessageId: row.provider_message_id ?? null,
    calendarEventId: row.payload.calendar_event_id ?? null,
    attachments: inboxAttachmentsFromRefs(row.payload.attachments, organizationId),
  };
}
