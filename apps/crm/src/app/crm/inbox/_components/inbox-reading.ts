/**
 * Pure helpers for the inbox reading pane.
 * Kept out of the React components so file-size and iframe measure
 * can be tested without mounting the thread.
 */

import createDOMPurify from 'dompurify';
import { INBOUND_BLOCKED_TAGS } from '@/lib/email/email-html-policy';

export function attachmentByteSize(att: {
  size?: unknown;
  file_size?: unknown;
}): unknown {
  return att.size ?? att.file_size;
}

/** Human size, or null when the inbound payload has no usable number. */
export function formatInboxFileSize(bytes: unknown): string | null {
  if (bytes == null || bytes === '') return null;
  const n = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** srcDoc preview: parent can measure this document. Never include allow-scripts. */
export const EMAIL_IFRAME_SANDBOX =
  'allow-popups allow-popups-to-escape-sandbox allow-same-origin';

let readingPurifier: ReturnType<typeof createDOMPurify> | null = null;

/**
 * Inbound rows are often a full HTML document (`<!DOCTYPE>…<body>…`). Putting
 * that inside our srcDoc wrapper nests `<html>` and leaves `<script>` in
 * `<head>` — Chrome then logs "Blocked script execution in about:srcdoc"
 * and the inner document collapses to a one-line iframe.
 */
export function extractEmailBodyFragment(html: string): string {
  if (!html) return '';
  const trimmed = html.trim();
  const body = trimmed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (body?.[1] != null) return body[1].trim();
  return trimmed
    .replace(/^<!DOCTYPE[^>]*>/i, '')
    .replace(/^<html\b[^>]*>/i, '')
    .replace(/<\/html>\s*$/i, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, '')
    .trim();
}

/** Belt-and-suspenders before DOMPurify so srcDoc never contains a `<script>`. */
export function stripExecutableMarkup(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '');
}

/**
 * Defense-in-depth in front of the sandboxed iframe: unwrap the document,
 * strip scripts, then DOMPurify. Never add allow-scripts to the sandbox —
 * Chrome's "Blocked script execution" warning is the success case for
 * leftover vectors, not a reason to loosen the frame.
 */
export function sanitizeEmailForReading(html: string): string {
  const fragment = stripExecutableMarkup(extractEmailBodyFragment(html));
  if (typeof window === 'undefined') return fragment;
  if (!readingPurifier) {
    readingPurifier = createDOMPurify(window);
    readingPurifier.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }
  return readingPurifier.sanitize(fragment, {
    FORBID_TAGS: [...INBOUND_BLOCKED_TAGS],
    // DOMPurify's default scheme list plus cid: and data: for inline images.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|callto|sms|cid|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

export function measureEmailDocument(doc: {
  body?: { scrollHeight?: number; offsetHeight?: number } | null;
  documentElement?: { scrollHeight?: number; offsetHeight?: number } | null;
}): number {
  const body = doc.body;
  const html = doc.documentElement;
  const height = Math.max(
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    html?.scrollHeight ?? 0,
    html?.offsetHeight ?? 0,
  );
  return Math.max(80, height + 16);
}

/**
 * Message cards size to their CONTENT, like Gmail. A per-message pane floor
 * used to inflate every card to ~92% of the pane, so a one-line reply became
 * a screen-tall white void and a four-message thread was unreadable — the
 * only guard left is a small floor that keeps a failed measure readable.
 */
export function emailIframeHeight(measuredPx: number): number {
  const measured = Number.isFinite(measuredPx) ? measuredPx : 80;
  return Math.max(80, Math.ceil(measured));
}

/**
 * An iframe whose CSS height is already 80px reports an 80px document —
 * the viewport, not the email. Shrink to 1px first so scrollHeight is
 * content height, then the caller sets the real height.
 */
export function unconstrainedIframeMeasureHeight(iframe: {
  style: { height: string };
  contentDocument: Parameters<typeof measureEmailDocument>[0] | null;
}): number {
  iframe.style.height = '1px';
  try {
    const doc = iframe.contentDocument;
    return emailIframeHeight(doc ? measureEmailDocument(doc) : 80);
  } catch {
    return emailIframeHeight(80);
  }
}

/**
 * Whether the thread pane should follow new messages to the bottom.
 * True when the reader is already near the end (or the pane doesn't
 * scroll); false when they've scrolled up to read history — yanking
 * them down mid-read would lose their place.
 */
export function shouldFollowNewMessages(pane: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): boolean {
  const distanceFromBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight;
  return distanceFromBottom < 200;
}

/** Human sender when intake stored an empty from_name (Outlook often does). */
export function displaySenderName(
  fromName: string | null | undefined,
  fromAddress: string | null | undefined,
): string {
  const name = fromName?.trim();
  if (name) return name;
  const email = fromAddress?.trim();
  if (!email) return 'Unknown';
  const local = email.split('@')[0] ?? '';
  const titled = local.replace(/[._+]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!titled) return email;
  return titled.replace(/\b([a-zA-Z])/g, (c) => c.toUpperCase());
}

/**
 * Outlook / Word HTML is tens or hundreds of KB of VML + spacer tables.
 * Putting it in the iframe as the default reading view hides the real
 * letter (and the attachment chips below it) inside a tiny pane.
 */
export function isHeavyEmailHtml(html: string | null | undefined): boolean {
  if (!html) return false;
  if (html.length > 40_000) return true;
  return /schemas-microsoft-com|WordSection|xmlns:v=/i.test(html);
}

export function shouldReadAsPlainText(
  html: string | null | undefined,
  text: string | null | undefined,
): boolean {
  const plain = text?.trim() ?? '';
  if (plain.length < 40) return false;
  return isHeavyEmailHtml(html);
}

export type ThreadFace = {
  name: string;
  email: string | null;
  others: Array<{ name: string; email: string }>;
};

/** Latest inbound sender is the face of the thread — not the first person who wrote. */
export function threadFaceFromMessages(
  messages: Array<{
    direction: string;
    from_name?: string | null;
    from_address?: string | null;
  }>,
  fallback: { contact_name?: string | null; contact_email?: string | null },
): ThreadFace {
  const inbound = messages.filter((m) => m.direction === 'inbound' && m.from_address?.trim());
  const latest = inbound[inbound.length - 1];
  const email = latest?.from_address?.trim() || fallback.contact_email?.trim() || null;
  const name = latest
    ? displaySenderName(latest.from_name, latest.from_address)
    : fallback.contact_name?.trim() || (email ? displaySenderName(null, email) : 'Unknown Contact');

  const latestKey = email?.toLowerCase() ?? '';
  const seen = new Set<string>(latestKey ? [latestKey] : []);
  const others: Array<{ name: string; email: string }> = [];
  for (const m of inbound) {
    const addr = m.from_address!.trim();
    const key = addr.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    others.push({ name: displaySenderName(m.from_name, addr), email: addr });
  }

  return { name, email, others };
}

export function isLatestInbound(
  messages: Array<{ id: string; direction: string }>,
  messageId: string,
): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].direction === 'inbound') return messages[i].id === messageId;
  }
  return false;
}

export function defaultMessageExpanded(
  index: number,
  total: number,
  latestInbound: boolean,
): boolean {
  if (total <= 2) return true;
  return index === total - 1 || latestInbound;
}
