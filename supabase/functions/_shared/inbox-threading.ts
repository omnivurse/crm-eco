/**
 * Shared-mailbox threading.
 *
 * RFC822 In-Reply-To / References still locate a candidate thread. We then
 * refuse to join when the sender is a new person: Outlook Reply-All on a
 * bank thread otherwise buries Frank under Dawn, and the inbox list never
 * shows a new unread row. A conversation here is one counterpart, not a
 * whole CC circus.
 */

export function normalizeThreadEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function shouldJoinThreadedConversation(opts: {
  fromEmail: string;
  conversationContactEmail: string | null | undefined;
  priorInboundFrom: Array<string | null | undefined>;
}): boolean {
  const from = normalizeThreadEmail(opts.fromEmail);
  if (!from) return false;

  const known = new Set<string>();
  const contact = normalizeThreadEmail(opts.conversationContactEmail);
  if (contact) known.add(contact);
  for (const addr of opts.priorInboundFrom) {
    const normalized = normalizeThreadEmail(addr);
    if (normalized) known.add(normalized);
  }
  return known.has(from);
}

export function pickSenderOwnedConversation(opts: {
  fromEmail: string;
  mailboxAddress?: string | null;
  candidates: Array<{
    id: string;
    contact_email?: string | null;
    mailbox_address?: string | null;
    last_message_at?: string | null;
  }>;
  inboundByConversation: Record<string, Array<string | null | undefined>>;
}): string | null {
  const from = normalizeThreadEmail(opts.fromEmail);
  if (!from) return null;
  const mailbox = normalizeThreadEmail(opts.mailboxAddress);

  const matches = opts.candidates.filter((candidate) => {
    if (
      mailbox
      && candidate.mailbox_address
      && normalizeThreadEmail(candidate.mailbox_address) !== mailbox
    ) {
      return false;
    }
    if (normalizeThreadEmail(candidate.contact_email) === from) return true;
    return (opts.inboundByConversation[candidate.id] ?? []).some(
      (addr) => normalizeThreadEmail(addr) === from,
    );
  });

  if (matches.length === 0) return null;
  return [...matches].sort((a, b) =>
    (b.last_message_at || '').localeCompare(a.last_message_at || ''),
  )[0].id;
}
