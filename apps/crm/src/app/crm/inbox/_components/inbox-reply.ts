import type { InboxMessage } from '@/lib/inbox/types';
import { escapeForwardHtml } from './inbox-forward';
import { extractEmailBodyFragment, shouldReadAsPlainText } from './inbox-reading';

export type ComposerSignature = {
  id: string;
  name: string;
  content_html: string;
  is_default: boolean;
  include_in_replies?: boolean;
  include_in_new?: boolean;
};

export function pickSignatureForCompose(
  signatures: ComposerSignature[],
  purpose: 'reply' | 'new',
): ComposerSignature | null {
  const eligible = signatures.filter((s) =>
    purpose === 'reply' ? s.include_in_replies !== false : s.include_in_new !== false,
  );
  return eligible.find((s) => s.is_default) ?? eligible[0] ?? null;
}

export function appendSignatureHtml(body: string, signatureHtml: string | null | undefined): string {
  const sig = signatureHtml?.trim();
  if (!sig) return body;
  return `${body}<br/><br/>--<br/>${sig}`;
}

/** True when the agent typed something besides the quoted inbound block. */
export function replyHasUserContent(html: string): boolean {
  const withoutQuote = html
    .replace(/<div[^>]*data-crm-quote="1"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutQuote.length > 0;
}

/**
 * Quoted last-inbound for the reply editor. Prefer stored text for Outlook
 * Word HTML so the dock does not swallow a 600KB document.
 */
export function buildReplyQuotedHtml(msg: InboxMessage | null): string {
  if (!msg) return '';

  const fromLine = msg.from_name
    ? `${escapeForwardHtml(msg.from_name)} &lt;${escapeForwardHtml(msg.from_address || '')}&gt;`
    : escapeForwardHtml(msg.from_address || '');
  const date = escapeForwardHtml(new Date(msg.sent_at).toLocaleString());
  const preferText = shouldReadAsPlainText(msg.body_html, msg.body_text);
  const quoted = preferText && msg.body_text?.trim()
    ? `<p>${escapeForwardHtml(msg.body_text).replace(/\n/g, '<br/>')}</p>`
    : msg.body_html
      ? extractEmailBodyFragment(msg.body_html)
      : `<p>${escapeForwardHtml(msg.body_text || '')}</p>`;

  return `<p></p>
<div data-crm-quote="1" style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #555;">
  <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">
    On ${date}, ${fromLine} wrote:
  </p>
  ${quoted}
</div>`;
}
