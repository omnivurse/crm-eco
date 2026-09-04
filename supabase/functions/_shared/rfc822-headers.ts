/**
 * RFC 5322 header parsing: `Message-ID`, `In-Reply-To`, `References`, `Date`.
 *
 * Providers disagree on the wire shape. Resend hands us the folded header
 * string for most mail, but a JSON-encoded list (`["<a@x>","<b@y>"]`) when the
 * upstream MTA supplied the header as an array. Splitting that form on
 * whitespace yields a single bogus "id" — the literal `["<a@x>","<b@y>"]` —
 * which matches no stored message. The thread then forks on intake, and the
 * reply we send back carries a References header the recipient's client cannot
 * stitch, so it starts a fresh thread on their side too.
 *
 * Parsing is therefore shape-tolerant and validating: whatever the wrapper,
 * only well-formed addr-spec tokens survive.
 */

/** `<local@domain>` — the only form we trust without a fallback. */
const BRACKETED_ID = /<[^<>\s]+@[^<>\s]+>/g;

/**
 * Collapse any provider representation to one string we can scan.
 * Arrays are flattened recursively because a JSON list of ids sometimes
 * arrives already parsed, and sometimes as a string inside an array.
 */
function flattenHeaderValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(flattenHeaderValue).join(' ');
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return '';
}

/**
 * Extract every message id in a header value.
 *
 * The bracketed scan is deliberately the primary strategy: it ignores JSON
 * punctuation, comma separators, folded whitespace, and display noise in one
 * pass. The unbracketed fallback only runs when the value contains no
 * `<...>` at all, so legacy senders that omit brackets still thread.
 */
function collectMessageIds(raw: unknown): string[] {
  const text = flattenHeaderValue(raw).trim();
  if (!text) return [];

  const bracketed = text.match(BRACKETED_ID);
  if (bracketed) return bracketed;

  return text
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.includes('@') && !token.includes('"') && !token.includes('['));
}

function dedupe(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Parse a `References` header (or a stored `references_ids` column). */
export function parseReferencesHeader(raw: unknown): string[] {
  return dedupe(collectMessageIds(raw));
}

/** Parse a `Message-ID` / `In-Reply-To` header down to a single id. */
export function parseMessageIdHeader(raw: unknown): string | null {
  return collectMessageIds(raw)[0] ?? null;
}

export interface ReferencesChainMessage {
  message_id?: string | null;
  references_ids?: unknown;
}

/**
 * Build the `References` header for a new reply.
 *
 * RFC 5322 §3.6.4 wants the parent's References followed by the parent's
 * Message-ID. We rebuild from the whole thread rather than trusting one row,
 * because a single malformed value used to truncate the chain and orphan the
 * reply. Reading every message means one bad row can no longer break threading.
 *
 * `maxIds` keeps the header inside what mail servers accept on long threads;
 * the root id is always preserved because clients key the thread off it.
 */
export function buildReferencesChain(
  priorMessages: ReferencesChainMessage[],
  inReplyTo: string | null,
  maxIds = 40,
): string[] {
  const chain: string[] = [];

  for (const message of priorMessages) {
    chain.push(...parseReferencesHeader(message.references_ids));
    const own = parseMessageIdHeader(message.message_id);
    if (own) chain.push(own);
  }

  const parent = parseMessageIdHeader(inReplyTo);
  if (parent) chain.push(parent);

  // The parent must terminate the chain: clients read the last entry as the
  // direct antecedent, and it may already appear earlier in the thread.
  const ordered = parent
    ? [...dedupe(chain).filter((id) => id !== parent), parent]
    : dedupe(chain);

  if (ordered.length <= maxIds) return ordered;
  return [ordered[0], ...ordered.slice(ordered.length - (maxIds - 1))];
}

/** A clock skew past this is treated as a bad `Date` rather than the future. */
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

/**
 * When an inbound message was actually sent.
 *
 * Storing webhook arrival time instead of the `Date` header puts a delayed or
 * retried delivery out of order in the thread, which is exactly the confusion
 * this module exists to prevent.
 *
 * `Date` is sender-controlled, so it is validated rather than trusted: an
 * unparseable value, or one more than a day ahead of us, falls back to arrival
 * time. Without that clamp a single bogus far-future date would pin a message
 * to the bottom of its thread permanently. Dates in the past are accepted —
 * a genuinely delayed or forwarded mail is legitimately old.
 */
export function inboundSentAt(rawDate: unknown, receivedAtIso: string): string {
  const text = flattenHeaderValue(rawDate).trim();
  if (!text) return receivedAtIso;

  const parsed = new Date(text);
  const ms = parsed.getTime();
  if (Number.isNaN(ms)) return receivedAtIso;

  const ceiling = new Date(receivedAtIso).getTime() + MAX_FUTURE_SKEW_MS;
  if (Number.isFinite(ceiling) && ms > ceiling) return receivedAtIso;

  return parsed.toISOString();
}
