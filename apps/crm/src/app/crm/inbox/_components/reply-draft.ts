/**
 * Reply-draft persistence rules.
 *
 * A half-written reply used to live only in a module-level Map while the dock
 * label claimed "Draft saved in this thread". A reload, a sign-out, or a tab
 * crash threw the work away and the UI had already said it was safe. These
 * helpers decide what to persist, when, and — just as importantly — what the
 * label is allowed to claim.
 *
 * Server persistence is an UPGRADE, not a replacement: the in-memory cache
 * still covers the moment between keystroke and debounce, and covers the case
 * where the server refuses the write (`inbox_drafts` RLS is repaired by
 * 20260904210000, which may not be applied yet). The label degrades with it
 * rather than lying.
 *
 * Pure on purpose — ReplyForm owns the effects.
 */

import type { EmailAttachment } from '@/components/email/EmailAttachments';
import type { InboxDraft } from '@/lib/inbox/types';
import { replyHasUserContent } from './inbox-reply';

/** Matches the debounce the list preferences use, so saves feel identical. */
export const REPLY_DRAFT_DEBOUNCE_MS = 800;

/**
 * What the dock is allowed to tell the user.
 *
 * `local` is the honest state for "typed, but the server has not confirmed
 * anything yet" — including a server that refuses the write. Only `saved`
 * promises the reply would survive a reload.
 */
export type ReplyDraftStatus = 'empty' | 'local' | 'saving' | 'saved';

export function replyDraftLabel(status: ReplyDraftStatus): string | null {
  switch (status) {
    case 'saved':
      return 'Draft saved';
    case 'saving':
      return 'Saving draft…';
    case 'local':
      // Deliberately not "saved": this copy exists only in this tab.
      return 'Draft kept in this tab';
    default:
      return null;
  }
}

export function replyDraftHasContent(
  html: string | null | undefined,
  attachments: ReadonlyArray<unknown> = [],
): boolean {
  return replyHasUserContent(html ?? '') || attachments.length > 0;
}

/**
 * Resolve the status from what we know. `persistedAt` is set only after the
 * server has acknowledged a write that matches the current content.
 */
export function resolveReplyDraftStatus(input: {
  hasContent: boolean;
  saving: boolean;
  /** True when the last acknowledged save matches the current content. */
  serverMatchesContent: boolean;
}): ReplyDraftStatus {
  if (!input.hasContent) return 'empty';
  if (input.saving) return 'saving';
  return input.serverMatchesContent ? 'saved' : 'local';
}

export interface ReplyDraftPayload {
  conversation_id: string;
  is_reply: true;
  reply_mode: 'reply' | 'reply_all';
  subject: string | null;
  body_html: string;
  body_text: string;
  to_addresses: Array<{ email: string; name?: string }>;
  cc_addresses: Array<{ email: string; name?: string }>;
  signature_id: string | null;
  attachments: Array<{
    filename: string;
    content_type: string;
    size: number;
    file_path: string | null;
  }>;
}

/**
 * Only attachments with a stored object survive a reload — a metadata-only row
 * would restore as a chip that can never be sent. Same rule the compose draft
 * path applies.
 */
export function persistableAttachments(
  attachments: ReadonlyArray<EmailAttachment>,
): ReplyDraftPayload['attachments'] {
  return attachments
    .filter((att) => !att.is_uploading && !att.error && (att.file_path || att.bucket_path))
    .map((att) => ({
      filename: att.file_name,
      content_type: att.mime_type || 'application/octet-stream',
      size: att.file_size ?? 0,
      file_path: att.file_path || att.bucket_path || null,
    }));
}

export function buildReplyDraftPayload(input: {
  conversationId: string;
  replyMode: 'reply' | 'reply_all';
  subject: string | null | undefined;
  bodyHtml: string;
  toAddress: string | null | undefined;
  toName?: string | null;
  ccAddresses: ReadonlyArray<{ email: string; name?: string }>;
  signatureId: string | null | undefined;
  attachments: ReadonlyArray<EmailAttachment>;
}): ReplyDraftPayload {
  return {
    conversation_id: input.conversationId,
    is_reply: true,
    reply_mode: input.replyMode,
    subject: input.subject?.trim() || null,
    body_html: input.bodyHtml,
    // Stored so the Drafts list has something to preview without parsing HTML.
    body_text: input.bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    to_addresses: input.toAddress ? [{ email: input.toAddress, name: input.toName ?? undefined }] : [],
    cc_addresses: input.replyMode === 'reply_all' ? [...input.ccAddresses] : [],
    signature_id: input.signatureId || null,
    attachments: persistableAttachments(input.attachments),
  };
}

/**
 * The saved reply draft for a thread, if the drafts the page already loaded
 * contain one. Avoids a per-thread fetch: page.tsx holds the list anyway.
 *
 * Newest wins — a duplicate can only exist if two tabs raced, and the later
 * write is the one the user saw last.
 */
export function findReplyDraft(
  drafts: ReadonlyArray<InboxDraft>,
  conversationId: string,
): InboxDraft | null {
  let best: InboxDraft | null = null;
  for (const draft of drafts) {
    if (!draft.is_reply || draft.conversation_id !== conversationId) continue;
    // A scheduled draft is a queued send, not an in-progress reply; restoring
    // it into the composer would double-send it.
    if (draft.scheduled_at) continue;
    if (!best || draft.updated_at > best.updated_at) best = draft;
  }
  return best;
}

/**
 * What to seed the composer with when a thread opens.
 *
 * The in-tab copy wins over the server copy: it is what the user typed most
 * recently, and it may not have been flushed yet. The server copy is the
 * fallback that survives reloads.
 */
export function restoreReplyDraft(input: {
  cached?: { html: string; attachments: EmailAttachment[] } | null;
  saved?: InboxDraft | null;
}): { html: string; attachments: EmailAttachment[]; draftId: string | null } | null {
  const cached = input.cached;
  if (cached && replyDraftHasContent(cached.html, cached.attachments)) {
    return { html: cached.html, attachments: cached.attachments, draftId: input.saved?.id ?? null };
  }

  const saved = input.saved;
  if (saved && replyDraftHasContent(saved.body_html, saved.attachments ?? [])) {
    return {
      html: saved.body_html ?? '',
      attachments: (saved.attachments ?? [])
        .filter((att) => att.file_path)
        .map((att, i) => ({
          id: `reply-draft-${saved.id}-${i}`,
          file_name: att.filename,
          file_size: att.size ?? 0,
          mime_type: att.content_type || 'application/octet-stream',
          file_path: att.file_path as string,
        })),
      draftId: saved.id,
    };
  }

  return null;
}

/**
 * Whether a saved draft row should be removed.
 *
 * After a successful send the draft is redundant. If the user simply cleared
 * the box, the row is stale too — but only delete when we know a row exists,
 * so an empty composer never fires a request.
 */
export function shouldDeleteReplyDraft(input: {
  draftId: string | null | undefined;
  hasContent: boolean;
  sent: boolean;
}): boolean {
  if (!input.draftId) return false;
  return input.sent || !input.hasContent;
}
