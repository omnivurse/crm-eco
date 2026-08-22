import type { OutboxPayload } from './outbox';

type LooseClient = {
  from: (table: string) => any;
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
};

export async function persistOutboundInboxMessage(
  supabase: LooseClient,
  input: PersistOutboundInboxInput,
): Promise<{ id: string } | null> {
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
      metadata: {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[email] persist outbound inbox message failed', {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
    });
    return null;
  }

  return data as { id: string };
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
  };
}
