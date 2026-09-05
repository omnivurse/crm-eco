/**
 * Printing a thread.
 *
 * Printing the app would print the app: three panes of chrome, a nav rail and
 * a clipped iframe per message. This builds a plain document of the thread —
 * headers then bodies, in reading order — and hands it to a new window, so the
 * printed page is the correspondence and nothing else.
 *
 * Bodies are already-sanitized HTML supplied by the caller (the reading pane's
 * `sanitizeEmailForReading`, which runs DOMPurify). Every other value is
 * escaped here, because a display name is attacker-controlled text.
 */

export interface PrintableMessage {
  id: string;
  direction: string;
  from_name?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  cc_addresses?: Array<{ email: string; name?: string }> | null;
  subject?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  sent_at?: string | null;
  attachments?: Array<{ filename?: string | null }> | null;
}

export interface PrintableConversation {
  subject?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatStamp(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '';
}

function senderLine(message: PrintableMessage): string {
  const name = message.from_name?.trim();
  const address = message.from_address?.trim();
  if (name && address) return `${name} <${address}>`;
  return name || address || (message.direction === 'outbound' ? 'You' : 'Unknown sender');
}

/**
 * @param sanitizeHtml the reading pane's sanitizer, injected so this module
 *   stays pure and testable without a DOM.
 */
export function buildPrintDocument(
  conversation: PrintableConversation,
  messages: readonly PrintableMessage[],
  sanitizeHtml: (html: string) => string,
): string {
  const title = conversation.subject?.trim() || '(No subject)';

  const blocks = messages
    .map((message) => {
      const cc = (message.cc_addresses ?? [])
        .map((recipient) => recipient?.name || recipient?.email)
        .filter(Boolean)
        .join(', ');
      const files = (message.attachments ?? [])
        .map((attachment) => attachment?.filename)
        .filter(Boolean)
        .join(', ');

      // Prefer the HTML the reader saw; fall back to text in a <pre> so a
      // plain-text email keeps its line breaks on paper.
      const body = message.body_html
        ? sanitizeHtml(message.body_html)
        : `<pre class="text">${escapeHtml(message.body_text ?? '')}</pre>`;

      return `<article class="msg">
  <header>
    <div class="from">${escapeHtml(senderLine(message))}</div>
    <dl>
      <dt>Sent</dt><dd>${escapeHtml(formatStamp(message.sent_at))}</dd>
      ${message.to_address ? `<dt>To</dt><dd>${escapeHtml(message.to_address)}</dd>` : ''}
      ${cc ? `<dt>Cc</dt><dd>${escapeHtml(cc)}</dd>` : ''}
      ${message.subject ? `<dt>Subject</dt><dd>${escapeHtml(message.subject)}</dd>` : ''}
      ${files ? `<dt>Attachments</dt><dd>${escapeHtml(files)}</dd>` : ''}
    </dl>
  </header>
  <div class="body">${body}</div>
</article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 16mm; }
  body { font: 12pt/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 16pt; margin: 0 0 4pt; }
  .thread-meta { color: #555; font-size: 10pt; margin-bottom: 16pt; }
  /* Never split a message across pages when it can be avoided. */
  .msg { border-top: 1px solid #ccc; padding-top: 10pt; margin-top: 10pt; break-inside: avoid; }
  .from { font-weight: 600; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 0 8pt; margin: 4pt 0 10pt; font-size: 10pt; color: #444; }
  dt { font-weight: 600; }
  dd { margin: 0; }
  .body img { max-width: 100%; }
  .text { white-space: pre-wrap; font: inherit; margin: 0; }
  a { color: #0b6; word-break: break-word; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="thread-meta">${escapeHtml(
    [conversation.contact_name, conversation.contact_email].filter(Boolean).join(' · '),
  )} · ${messages.length} message${messages.length === 1 ? '' : 's'}</div>
${blocks}
</body>
</html>`;
}

/**
 * Hand a built document to the browser's print dialog.
 *
 * Written into a blank window rather than an offscreen iframe so images and
 * remote styles resolve the way the reader saw them, and so a blocked popup
 * fails loudly (returns false) instead of silently printing nothing. Printing
 * is deferred to `load` so images are measured before pagination.
 */
export function openPrintWindow(html: string): boolean {
  if (typeof window === 'undefined') return false;
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => {
    win.focus();
    win.print();
  });
  return true;
}
