const ANGLE = /^<[^>]+>$/;

/**
 * Characters permitted inside a msg-id: visible ASCII except the angle
 * brackets themselves. A msg-id can never contain spaces or control
 * characters — in particular CR/LF, which would otherwise flow verbatim from
 * client-supplied In-Reply-To/References values into raw provider header
 * maps (SMTP header injection). Invalid input returns null and the caller
 * generates a fresh id instead.
 */
const MSG_ID_BODY = /^[!-;=?-~]+$/;

export function normalizeRfc822Id(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const body = ANGLE.test(trimmed) ? trimmed.slice(1, -1) : trimmed.replace(/^<|>$/g, '');
  if (!body || !MSG_ID_BODY.test(body)) return null;
  return `<${body}>`;
}

export function generateRfc822MessageId(domain = 'payitforwardhealth.com'): string {
  const host = domain.replace(/^@/, '').toLowerCase() || 'payitforwardhealth.com';
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `<${id}@${host}>`;
}

export function domainFromEmail(email: string | null | undefined): string {
  const at = email?.lastIndexOf('@') ?? -1;
  if (!email || at < 0) return 'payitforwardhealth.com';
  return email.slice(at + 1).toLowerCase() || 'payitforwardhealth.com';
}

export function buildReplyReferences(
  parentMessageId: string | null | undefined,
  parentReferences: string[] | null | undefined,
): { inReplyTo: string | null; references: string[] } {
  const inReplyTo = normalizeRfc822Id(parentMessageId);
  const existing = (parentReferences ?? [])
    .map((id) => normalizeRfc822Id(id))
    .filter((id): id is string => Boolean(id));
  const references = inReplyTo
    ? [...existing.filter((id) => id !== inReplyTo), inReplyTo]
    : existing;
  return { inReplyTo, references };
}

export function referencesHeaderValue(ids: string[]): string | undefined {
  return ids.length > 0 ? ids.join(' ') : undefined;
}
