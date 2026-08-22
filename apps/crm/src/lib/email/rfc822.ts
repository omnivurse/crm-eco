const ANGLE = /^<[^>]+>$/;

export function normalizeRfc822Id(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return ANGLE.test(trimmed) ? trimmed : `<${trimmed.replace(/^<|>$/g, '')}>`;
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
