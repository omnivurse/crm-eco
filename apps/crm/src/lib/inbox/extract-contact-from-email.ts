/**
 * Deterministic contact guess from an inbox participant + their latest message.
 *
 * Used by the inbox “Add contact” sheet (instant prefill) and re-run on the
 * server so a client cannot invent a person who was never on the thread.
 * Never calls an LLM — email bodies stay in-process.
 */

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'live.com',
  'msn.com',
  'ymail.com',
  'googlemail.com',
]);

const TITLE_HINT =
  /\b(director|manager|founder|advisor|president|officer|specialist|analyst|coordinator|consultant|attorney|cpa|banker|relationship|vice president|\bvp\b|ceo|coo|cfo|principal|partner|associate|executive|head of|lead )\b/i;

const COMPANY_HINT =
  /\b(bank|health|llc|l\.l\.c|inc\.?|corp\.?|company|credit union|partners|group|clinic|hospital|llp|ltd\.?|\bpc\b|holdings|services|capital|financial|mortgage|lending)\b/i;

const DISCLAIMER =
  /\b(confidential|privileged|unsubscribe|intended (solely|only) for|virus|please consider the environment|this email and any attachments)\b/i;

const TRACKING_HOST =
  /unsubscribe|list-manage|constantcontact|sentry\.io|google\.com\/url|mandrillapp|sendgrid|mailchimp|click\.|track\./i;

const US_PHONE =
  /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const INBOX_CONTACT_CATEGORIES = [
  'Partner Contact',
  'Support Contact',
  'Vendor',
  'Other',
] as const;

export type InboxContactCategory = (typeof INBOX_CONTACT_CATEGORIES)[number];

export function isInboxContactCategory(value: string | null | undefined): value is InboxContactCategory {
  return !!value && (INBOX_CONTACT_CATEGORIES as readonly string[]).includes(value);
}

export interface ExtractedInboxContact {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  title: string;
  company: string;
  website: string;
}

export interface InboxMessageForExtract {
  direction?: string | null;
  from_address?: string | null;
  from_name?: string | null;
  body_text?: string | null;
  body_html?: string | null;
}

/** Title-case an email local-part: `frank.burnham` → `Frank Burnham`. */
export function displayNameFromEmail(email: string | null | undefined): string {
  const addr = (email ?? '').trim();
  if (!addr) return '';
  const local = addr.split('@')[0] ?? '';
  const titled = local.replace(/[._+]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!titled) return '';
  return titled.replace(/\b([a-zA-Z])/g, (c) => c.toUpperCase());
}

/** `"Wendy Scipione"` → first / last. A single token is first name only. */
export function splitPersonName(raw: string | null | undefined): { first_name: string; last_name: string } {
  const cleaned = (raw ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\S+@\S+/g, ' ')
    .replace(/["']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return { first_name: '', last_name: '' };
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 1) return { first_name: parts[0]!, last_name: '' };
  return { first_name: parts[0]!, last_name: parts.slice(1).join(' ') };
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function lastNonEmptyLines(text: string, count: number): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !DISCLAIMER.test(l));
  return lines.slice(-count);
}

/**
 * Signature-ish block: after a `--` delimiter, or the lines above
 * “Sent from my …”, else the last dozen non-empty lines.
 */
export function signatureBlock(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  const dashParts = normalized.split(/\n--[ \t]*\n/);
  if (dashParts.length > 1) {
    return dashParts[dashParts.length - 1]!.trim();
  }
  const sentFrom = normalized.search(/\nSent from my /i);
  if (sentFrom >= 0) {
    return lastNonEmptyLines(normalized.slice(0, sentFrom), 12).join('\n');
  }
  return lastNonEmptyLines(normalized, 12).join('\n');
}

export function extractPhone(text: string, html?: string | null): string {
  const tel = html?.match(/href=["']tel:([^"']+)["']/i);
  if (tel?.[1]) {
    const digits = tel[1].replace(/\D/g, '');
    if (digits.length >= 10) return tel[1].replace(/^tel:/i, '').trim();
  }
  const match = text.match(US_PHONE);
  return match?.[0]?.trim() ?? '';
}

export function extractWebsite(text: string, html?: string | null): string {
  const fromHtml = html?.match(/href=["'](https?:\/\/[^"']+)["']/gi) ?? [];
  for (const raw of fromHtml) {
    const url = raw.replace(/^href=["']|["']$/gi, '');
    if (url && !TRACKING_HOST.test(url) && !/^mailto:/i.test(url)) return url;
  }
  const fromText = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (const url of fromText) {
    if (!TRACKING_HOST.test(url)) return url.replace(/[.,);]+$/, '');
  }
  return '';
}

/** `bank-of-colorado.com` → `Bank Of Colorado`. Mashed labels stay one word. */
/** Guess a partner-industry picklist value from company / email. */
export function inferPartnerIndustry(company: string, email: string): string {
  const hay = `${company} ${email}`.toLowerCase();
  if (/\bcredit union\b/.test(hay) || /\bbank\b/.test(hay) || /bankof|bank-of/.test(hay)) {
    return 'Banking / Credit Union';
  }
  if (/\bmortgage\b|\blending\b|\blender\b/.test(hay)) return 'Mortgage / Lending';
  if (/\bcpa\b|\baccount/.test(hay)) return 'CPA / Accounting / Bookkeeping';
  if (/\battorney\b|\blaw\b|\blegal\b/.test(hay)) return 'Attorney / Legal';
  return '';
}

export function companyFromEmailDomain(email: string): string {
  const domain = (email.split('@')[1] ?? '').trim().toLowerCase();
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return '';
  const labels = domain.split('.').filter((p) => p && p !== 'www' && p !== 'mail' && p !== 'email');
  const registrable = labels.length >= 2 ? labels[labels.length - 2]! : labels[0];
  if (!registrable || registrable.length < 3) return '';
  return registrable
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function looksLikeNameLine(line: string, first: string, last: string): boolean {
  const n = line.toLowerCase();
  const full = `${first} ${last}`.trim().toLowerCase();
  if (full && n === full) return true;
  if (first && n.startsWith(first.toLowerCase()) && last && n.includes(last.toLowerCase())) return true;
  return false;
}

export function extractTitleAndCompany(
  block: string,
  names: { first_name: string; last_name: string },
): { title: string; company: string } {
  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !DISCLAIMER.test(l) && !EMAIL_RE.test(l) && !US_PHONE.test(l) && !/^https?:/i.test(l));

  let title = '';
  let company = '';
  const candidates = lines.filter((l) => !looksLikeNameLine(l, names.first_name, names.last_name));

  for (const line of candidates) {
    if (!title && TITLE_HINT.test(line) && line.length < 80) title = line;
    else if (!company && COMPANY_HINT.test(line) && line.length < 80) company = line;
    if (title && company) break;
  }

  // Common two-line signature under the name: title then org, even if one line
  // missed the keyword lists.
  if ((!title || !company) && candidates.length >= 2) {
    const [a, b] = candidates;
    if (!title && a && a.length < 60 && !COMPANY_HINT.test(a)) title = title || a;
    if (!company && b && b.length < 80) company = company || b;
  }

  return { title, company };
}

export function lastMessageFromAddress(
  messages: InboxMessageForExtract[],
  email: string,
): InboxMessageForExtract | null {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]!;
    const from = (msg.from_address ?? '').trim().toLowerCase();
    if (from === key && msg.direction === 'inbound') return msg;
  }
  return null;
}

export function proposeContactFromParticipant(input: {
  participant: { email: string; name?: string | null };
  messages: InboxMessageForExtract[];
}): ExtractedInboxContact {
  const email = input.participant.email.trim().toLowerCase();
  const last = lastMessageFromAddress(input.messages, email);
  const display =
    input.participant.name?.trim() ||
    last?.from_name?.trim() ||
    displayNameFromEmail(email);
  const names = splitPersonName(display);

  const html = last?.body_html ?? '';
  const text = (last?.body_text ?? '').trim() || (html ? htmlToPlainText(html) : '');
  const block = signatureBlock(text);
  const phone = extractPhone(block || text, html);
  const website = extractWebsite(block || text, html);
  const { title, company: fromSig } = extractTitleAndCompany(block, names);
  const company = fromSig || companyFromEmailDomain(email);

  return {
    email,
    first_name: names.first_name,
    last_name: names.last_name,
    phone,
    title,
    company,
    website,
  };
}

/** Prefill the conversation note. The user keeps or replaces this line. */
export function emailConversationNotePrefix(
  subject: string | null | undefined,
  when: Date | string | null | undefined,
): string {
  const sub = (subject ?? '').replace(/^(re|fwd|fw):\s*/i, '').trim() || 'No subject';
  if (!when) return `Email: “${sub}”`;
  const d = typeof when === 'string' ? new Date(when) : when;
  if (Number.isNaN(d.getTime())) return `Email: “${sub}”`;
  const stamped = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Email: “${sub}” — ${stamped}`;
}

/** True when the box is empty or still only the automatic email header. */
export function isConversationNoteBlank(body: string, prefix: string): boolean {
  const t = body.trim();
  return t === '' || t === prefix.trim();
}
