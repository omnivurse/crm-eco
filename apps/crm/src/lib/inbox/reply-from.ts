/**
 * Which address a shared-inbox reply goes out as.
 *
 * Getting this wrong is visible to members: mail sent to `billing@` must be
 * answered by `billing@`, not by the org default. It also has to be answered by
 * an address the org actually controls, or the reply lands in spam.
 *
 * The conversation's `mailbox_address` is authoritative because it was decided
 * once at intake from the real recipients. Per-message `to_address` is only a
 * fallback for threads that predate mailbox tagging.
 */

export interface ReplyFromCandidate {
  email: string;
  isDefault: boolean;
}

export interface ResolveReplyFromInput {
  /** inbox_conversations.mailbox_address — set by intake. */
  conversationMailbox?: string | null;
  /** Recipient of the most recent inbound message. */
  lastInboundTo?: string | null;
  /** Reply-To the sender asked us to use. */
  lastInboundReplyTo?: string | null;
  /** Verified sender registry for the org. */
  senders: ReplyFromCandidate[];
  /** Verified domains the org can send from. */
  verifiedDomains: string[];
}

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const angle = value.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : value).trim().toLowerCase();
  return candidate.includes('@') ? candidate : null;
}

function localPart(address: string): string {
  return address.split('@')[0] ?? '';
}

function domainOf(address: string): string {
  return address.split('@')[1] ?? '';
}

/**
 * Resolve a candidate to something we may legitimately send as.
 *
 * Exact registry match wins. Otherwise we try the same local part on the
 * default sender's domain — that is what makes a thread received on
 * `mail.example.com` reply from the apex `example.com` without hardcoding
 * either domain. Only if neither exists do we accept the raw address, and only
 * when its domain is verified.
 */
function toSendableAddress(
  candidate: string | null,
  senders: ReplyFromCandidate[],
  verifiedDomains: Set<string>,
  defaultDomain: string | null,
): string | null {
  if (!candidate) return null;

  const registry = new Set(senders.map((s) => s.email));
  if (registry.has(candidate)) return candidate;

  if (defaultDomain) {
    const onDefaultDomain = `${localPart(candidate)}@${defaultDomain}`;
    if (registry.has(onDefaultDomain)) return onDefaultDomain;
  }

  // Catch-all addresses (never registered as senders) are still sendable when
  // the domain itself is verified — better a correct From than a wrong one.
  if (verifiedDomains.has(domainOf(candidate))) return candidate;

  return null;
}

export function resolveReplyFromAddress(input: ResolveReplyFromInput): string | null {
  const senders = input.senders
    .map((s) => ({ email: normalize(s.email), isDefault: s.isDefault }))
    .filter((s): s is ReplyFromCandidate => s.email !== null);

  const verifiedDomains = new Set(
    input.verifiedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean),
  );
  // Registry domains are verified by construction; include them so a correct
  // reply is still possible when the caller cannot supply a domain list.
  for (const sender of senders) verifiedDomains.add(domainOf(sender.email));

  const defaultSender = senders.find((s) => s.isDefault) ?? senders[0] ?? null;
  const defaultDomain = defaultSender ? domainOf(defaultSender.email) : null;

  const ordered = [
    input.conversationMailbox,
    input.lastInboundTo,
    input.lastInboundReplyTo,
  ];

  for (const raw of ordered) {
    const sendable = toSendableAddress(normalize(raw), senders, verifiedDomains, defaultDomain);
    if (sendable) return sendable;
  }

  return defaultSender?.email ?? null;
}
