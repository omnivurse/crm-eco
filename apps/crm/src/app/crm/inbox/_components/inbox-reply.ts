import type { InboxMessage } from '@/lib/inbox/types';
import { resolveReplyFromAddress } from '@/lib/inbox/reply-from';
import {
  buildReferencesChain,
  parseMessageIdHeader,
} from '../../../../../../../supabase/functions/_shared/rfc822-headers';
import { escapeForwardHtml } from './inbox-forward';
import { extractEmailBodyFragment, shouldReadAsPlainText } from './inbox-reading';

export type ComposerSignature = {
  id: string;
  name: string;
  content_html: string;
  is_default: boolean;
  include_in_replies?: boolean;
  include_in_new?: boolean;
};

export function pickSignatureForCompose(
  signatures: ComposerSignature[],
  purpose: 'reply' | 'new',
): ComposerSignature | null {
  const eligible = signatures.filter((s) =>
    purpose === 'reply' ? s.include_in_replies !== false : s.include_in_new !== false,
  );
  return eligible.find((s) => s.is_default) ?? eligible[0] ?? null;
}

export function appendSignatureHtml(body: string, signatureHtml: string | null | undefined): string {
  const sig = signatureHtml?.trim();
  if (!sig) return body;
  return `${body}<br/><br/>--<br/>${sig}`;
}

/** True when the agent typed something besides the quoted inbound block. */
export function replyHasUserContent(html: string): boolean {
  const withoutQuote = html
    .replace(/<div[^>]*data-crm-quote="1"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutQuote.length > 0;
}

/**
 * Quoted last-inbound for the reply editor. Prefer stored text for Outlook
 * Word HTML so the dock does not swallow a 600KB document.
 */
export function buildReplyQuotedHtml(msg: InboxMessage | null): string {
  if (!msg) return '';

  const fromLine = msg.from_name
    ? `${escapeForwardHtml(msg.from_name)} &lt;${escapeForwardHtml(msg.from_address || '')}&gt;`
    : escapeForwardHtml(msg.from_address || '');
  const date = escapeForwardHtml(new Date(msg.sent_at).toLocaleString());
  const preferText = shouldReadAsPlainText(msg.body_html, msg.body_text);
  const quoted = preferText && msg.body_text?.trim()
    ? `<p>${escapeForwardHtml(msg.body_text).replace(/\n/g, '<br/>')}</p>`
    : msg.body_html
      ? extractEmailBodyFragment(msg.body_html)
      : `<p>${escapeForwardHtml(msg.body_text || '')}</p>`;

  return `<p></p>
<div data-crm-quote="1" style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #555;">
  <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">
    On ${date}, ${fromLine} wrote:
  </p>
  ${quoted}
</div>`;
}

export type InboxReplyMode = 'reply' | 'reply_all';

export interface InboxReplyConversation {
  id: string;
  subject: string | null;
  contact_email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  mailbox_address: string | null;
}

export interface InboxReplyMailbox {
  email: string;
  name?: string | null;
  isDefault: boolean;
}

export interface InboxReplyComposeInput {
  mode: InboxReplyMode;
  conversation: InboxReplyConversation;
  messages: InboxMessage[];
  authUserEmail: string;
  mailboxes: InboxReplyMailbox[];
  verifiedDomains: string[];
}

export interface InboxReplyCompose {
  kind: 'reply';
  mode: InboxReplyMode;
  to: Array<{ email: string; name?: string }>;
  cc: Array<{ email: string; name?: string }>;
  subject: string;
  body: string;
  conversationId: string;
  inReplyTo: string | null;
  references: string[];
  fromEmail: string | null;
  fromName: string;
}

/** Keep a single Re: even when the thread subject already has one. */
export function replySubject(subject?: string | null): string {
  const raw = (subject || '').trim();
  if (!raw) return 'Re:';
  return /^re:\s/i.test(raw) ? raw : `Re: ${raw}`;
}

export function lastInboundMessage(messages: InboxMessage[]): InboxMessage | null {
  const inbound = messages.filter((m) => m.direction === 'inbound');
  return inbound.length > 0 ? inbound[inbound.length - 1] : null;
}

/**
 * Honour Reply-To first: send-on-behalf systems set it because From is a
 * black hole. Then the visible sender, then the conversation contact.
 */
export function replyRecipient(
  lastInbound: InboxMessage | null,
  conversation: InboxReplyConversation,
): { email: string; name?: string } | null {
  const email =
    lastInbound?.reply_to_address ||
    lastInbound?.from_address ||
    conversation.contact_email ||
    conversation.contact_phone;
  if (!email) return null;
  const name = lastInbound?.from_name ?? conversation.contact_name ?? undefined;
  return { email, name: name || undefined };
}

export function replyAllCc(
  lastInbound: InboxMessage | null,
  opts: { authUserEmail: string; fromEmail: string | null },
): Array<{ email: string; name?: string }> {
  if (!lastInbound) return [];
  const skip = new Set(
    [opts.authUserEmail, opts.fromEmail]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );
  return (lastInbound.cc_addresses || []).filter((addr) => !skip.has(addr.email.toLowerCase()));
}

/**
 * Everything the right-hand compose dock needs to open a reply the way
 * Forward already does — recipients, quoted body, and RFC822 thread headers.
 */
export function buildInboxReplyCompose(input: InboxReplyComposeInput): InboxReplyCompose | null {
  const lastInbound = lastInboundMessage(input.messages);
  const lastMessage = input.messages.length > 0 ? input.messages[input.messages.length - 1] : null;
  const to = replyRecipient(lastInbound, input.conversation);
  if (!to) return null;

  const fromEmail = resolveReplyFromAddress({
    conversationMailbox: input.conversation.mailbox_address,
    lastInboundTo: lastInbound?.to_address,
    lastInboundReplyTo: lastInbound?.reply_to_address,
    senders: input.mailboxes.map((mailbox) => ({
      email: mailbox.email,
      isDefault: mailbox.isDefault,
    })),
    verifiedDomains: input.verifiedDomains,
  });
  const fromName =
    input.mailboxes.find((mailbox) => mailbox.email === fromEmail)?.name || 'Pay It Forward Health';

  const inReplyTo = parseMessageIdHeader(lastMessage?.message_id);
  const references = buildReferencesChain(input.messages, inReplyTo);

  return {
    kind: 'reply',
    mode: input.mode,
    to: [to],
    cc:
      input.mode === 'reply_all'
        ? replyAllCc(lastInbound, { authUserEmail: input.authUserEmail, fromEmail })
        : [],
    subject: replySubject(input.conversation.subject),
    body: buildReplyQuotedHtml(lastInbound),
    conversationId: input.conversation.id,
    inReplyTo,
    references,
    fromEmail,
    fromName,
  };
}
