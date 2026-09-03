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
