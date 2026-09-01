import type { EmailAttachment } from '@/components/email/EmailAttachments';
import type { InboxMessage } from '@/lib/inbox/types';
import { extractEmailBodyFragment } from './inbox-reading';

export function escapeForwardHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function forwardSubject(subject: string | null | undefined): string {
  const raw = (subject || '(no subject)').trim() || '(no subject)';
  return /^fwd:\s/i.test(raw) ? raw : `Fwd: ${raw}`;
}

/**
 * Prefer the message that still has stored files; otherwise the last inbound,
 * otherwise the last message in the thread.
 */
export function pickForwardSource(messages: InboxMessage[]): InboxMessage | null {
  return (
    [...messages].reverse().find((m) =>
      (m.attachments ?? []).some((a) => a.file_path || a.resend_id),
    )
    ?? [...messages].reverse().find((m) => m.direction === 'inbound')
    ?? messages[messages.length - 1]
    ?? null
  );
}

export function forwardableAttachments(
  msg: InboxMessage | null,
  extra: EmailAttachment[] = [],
): EmailAttachment[] {
  const sourceFiles: EmailAttachment[] = (msg?.attachments ?? [])
    .filter((att) => att.file_path)
    .map((att, i) => ({
      id: `fwd-${msg?.id ?? 'msg'}-${i}`,
      file_name: att.filename,
      file_size: att.size ?? 0,
      mime_type: att.content_type || 'application/octet-stream',
      file_path: att.file_path as string,
    }));
  const readyDock = extra.filter((a) => !a.is_uploading && !a.error);
  return [...sourceFiles, ...readyDock];
}

export function unforwardableAttachmentCount(
  msg: InboxMessage | null,
  extra: EmailAttachment[] = [],
): number {
  const stored = (msg?.attachments ?? []).filter((att) => att.file_path).length;
  const readyDock = extra.filter((a) => !a.is_uploading && !a.error).length;
  return (msg?.attachments ?? []).length - stored + (extra.length - readyDock);
}

/** Quoted fragment TipTap can load — never a nested full HTML document. */
export function buildForwardedBody(msg: InboxMessage | null, userContent: string): string {
  if (!msg) return userContent;

  const fromLine = msg.from_name
    ? `${escapeForwardHtml(msg.from_name)} &lt;${escapeForwardHtml(msg.from_address || '')}&gt;`
    : escapeForwardHtml(msg.from_address || '');
  const date = escapeForwardHtml(new Date(msg.sent_at).toLocaleString());
  const quoted = msg.body_html
    ? extractEmailBodyFragment(msg.body_html)
    : `<p>${escapeForwardHtml(msg.body_text || '')}</p>`;

  return `${userContent}
<br/><br/>
<div data-crm-quote="1" style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #555;">
  <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">
    ---------- Forwarded message ----------<br/>
    From: ${fromLine}<br/>
    Date: ${date}<br/>
    Subject: ${escapeForwardHtml(msg.subject || '(no subject)')}
  </p>
  ${quoted}
</div>`;
}
