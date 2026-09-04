/**
 * Shared-mailbox resolution for inbound email.
 *
 * Resend receives for the whole domain, so a single inbound message can be
 * addressed to several recipients (direct To, plus Cc from a forward chain).
 * The shared inbox needs exactly one of them as the owning mailbox so agents
 * can filter to "billing@" or "enrollment@" and see only that queue.
 *
 * Selection order matters: an org-owned To recipient always wins over an
 * org-owned Cc recipient, because being Cc'd does not make a mailbox the
 * addressee. Only when no recipient belongs to the org do we fall back to the
 * first To — that keeps mail visible instead of silently unfiled.
 */

export function normalizeMailboxAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Accepts both "Name <a@b.com>" and bare "a@b.com".
  const angle = raw.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : raw).trim().toLowerCase();
  return candidate.includes('@') ? candidate : null;
}

export function mailboxDomain(address: string): string {
  return address.split('@')[1] || '';
}

/**
 * Domains to try, in order, when resolving which org owns an inbound message.
 *
 * Recipient case is sender-controlled: DocuSign addresses envelopes in block
 * capitals, so `WENDY@PAYITFORWARDHEALTH.COM` arrives for a domain stored
 * lowercase. The org lookup is an exact text match, so an unnormalized domain
 * finds nothing and the mail is refused as unroutable. Normalizing here keeps
 * that decision on one code path instead of at each call site.
 */
export function inboundLookupDomains(
  addresses: Array<string | null | undefined>,
): string[] {
  const domains: string[] = [];
  for (const raw of addresses) {
    const normalized = normalizeMailboxAddress(raw);
    if (!normalized) continue;
    const domain = mailboxDomain(normalized);
    if (domain && !domains.includes(domain)) domains.push(domain);
  }
  return domains;
}

/**
 * Collapse a forwarded address onto the registered mailbox it belongs to.
 *
 * Mail forwarded from an apex role address into the CRM's receiving subdomain
 * arrives as `billing@mail.example.com`, but the queue agents work is the
 * registered `billing@example.com`. Filing them separately would silently
 * split one queue into two, and the second would not appear in the sidebar at
 * all because it is not in the sender registry.
 *
 * The shortest matching domain wins, which prefers the apex over any
 * `mail.`/`info.` receiving subdomain without hardcoding those names.
 */
export function canonicalizeMailbox(address: string, registeredAddresses: string[]): string {
  const registered = registeredAddresses
    .map(normalizeMailboxAddress)
    .filter((a): a is string => a !== null);

  if (registered.includes(address)) return address;

  const local = address.split('@')[0];
  const sameLocalPart = registered
    .filter((candidate) => candidate.split('@')[0] === local)
    .sort((a, b) => mailboxDomain(a).length - mailboxDomain(b).length);

  return sameLocalPart[0] ?? address;
}

export function resolveMailboxAddress(
  to: Array<string | null | undefined>,
  cc: Array<string | null | undefined>,
  ownedDomains: string[],
  /** Verified sender registry; enables collapsing forwarded subdomain mail. */
  registeredAddresses: string[] = [],
): string | null {
  const owned = new Set(ownedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean));

  const normalizedTo = to.map(normalizeMailboxAddress).filter((a): a is string => a !== null);
  const normalizedCc = cc.map(normalizeMailboxAddress).filter((a): a is string => a !== null);

  for (const group of [normalizedTo, normalizedCc]) {
    const match = group.find((addr) => owned.has(mailboxDomain(addr)));
    if (match) return canonicalizeMailbox(match, registeredAddresses);
  }

  const fallback = normalizedTo[0];
  return fallback ? canonicalizeMailbox(fallback, registeredAddresses) : null;
}
