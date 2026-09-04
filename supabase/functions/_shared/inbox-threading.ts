/**
 * Shared-mailbox threading.
 *
 * RFC822 In-Reply-To / References locate a candidate thread. We then decide
 * whether this sender belongs on it.
 *
 * The test is participation, not identity. Anyone already on the thread —
 * the counterpart, a previous inbound sender, or someone we addressed or
 * CC'd — is continuing a conversation they were part of, so their reply
 * belongs in that thread. A multi-party business thread (a banker loops in a
 * colleague, both reply) must stay one thread; splitting it strands half the
 * history in a second row with the same subject and leaves the reader unable
 * to follow the order.
 *
 * A sender who was never on the thread is a genuinely new counterpart and
 * still gets their own row, which is what keeps a stranger who guesses a
 * Message-ID — or a mailing list blast — out of someone else's conversation.
 */

export function normalizeThreadEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function shouldJoinThreadedConversation(opts: {
  fromEmail: string;
  conversationContactEmail: string | null | undefined;
  priorInboundFrom: Array<string | null | undefined>;
  /**
   * Everyone already addressed on the thread: To/Cc of prior messages, in
   * either direction. A CC'd colleague replying is a participant, not a
   * stranger.
   */
  threadParticipants?: Array<string | null | undefined>;
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
  for (const addr of opts.threadParticipants ?? []) {
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
