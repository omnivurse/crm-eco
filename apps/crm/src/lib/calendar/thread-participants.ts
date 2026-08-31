/**
 * Pure helper for prefilling a meeting's attendee list from an inbox thread.
 *
 * Collects the conversation contact plus every from/to/cc address across the
 * thread's messages, normalizes and dedupes them, and drops org-owned
 * addresses (shared mailboxes, sending identities) so only external
 * participants remain.
 */

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const MAX_PARTICIPANTS = 50;

export interface ThreadParticipant {
  email: string;
  name?: string;
}

export function participantsFromThread(input: {
  conversation: { contact_email?: string | null; contact_name?: string | null } | null;
  messages: Array<{
    direction?: string | null;
    from_address?: string | null;
    from_name?: string | null;
    to_address?: string | null;
    cc_addresses?: Array<{ email: string; name?: string }> | null;
  }>;
  /** Org-owned addresses (shared mailboxes, senders) to exclude, any casing. */
  excludeEmails: string[];
}): ThreadParticipant[] {
  const excluded = new Set(
    input.excludeEmails.map((email) => email.trim().toLowerCase()),
  );

  // First occurrence wins ordering; a later duplicate that carries a name
  // donates it when the kept entry has none.
  const byEmail = new Map<string, ThreadParticipant>();

  const add = (rawEmail: string | null | undefined, rawName?: string | null) => {
    const email = rawEmail?.trim().toLowerCase();
    if (!email || !EMAIL_PATTERN.test(email) || excluded.has(email)) return;

    const name = rawName?.trim() || undefined;
    const existing = byEmail.get(email);
    if (existing) {
      if (!existing.name && name) existing.name = name;
      return;
    }
    byEmail.set(email, name ? { email, name } : { email });
  };

  add(input.conversation?.contact_email, input.conversation?.contact_name);

  for (const message of input.messages) {
    add(message.from_address, message.from_name);
    add(message.to_address);
    for (const cc of message.cc_addresses ?? []) {
      add(cc.email, cc.name);
    }
  }

  return Array.from(byEmail.values()).slice(0, MAX_PARTICIPANTS);
}
