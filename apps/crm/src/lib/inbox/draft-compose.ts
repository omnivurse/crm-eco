import type { EmailAttachment } from '@/components/email/EmailAttachments';
import type { InboxDraft, InboxDraftAttachment } from './types';

export interface DraftComposerSeed {
  to: InboxDraft['to_addresses'];
  cc: InboxDraft['cc_addresses'];
  bcc: InboxDraft['bcc_addresses'];
  subject?: string;
  body?: string;
  attachments: EmailAttachment[];
}

/**
 * Hydrate every delivery-relevant draft field when the composer is reopened.
 * Omitting a field here causes the next save or send to silently replace it
 * with the composer's empty default.
 */
export function inboxDraftToComposerSeed(draft: InboxDraft): DraftComposerSeed {
  return {
    to: draft.to_addresses,
    cc: draft.cc_addresses,
    bcc: draft.bcc_addresses,
    subject: draft.subject ?? undefined,
    body: draft.body_html ?? draft.body_text ?? undefined,
    attachments: draft.attachments.map((attachment, index) => ({
      id: attachment.id ?? `draft-${draft.id}-${index}`,
      file_name: attachment.filename,
      file_size: attachment.size,
      mime_type: attachment.content_type,
      file_path: attachment.file_path,
      bucket_path: attachment.bucket_path,
      public_url: attachment.url,
    })),
  };
}

/**
 * Keep durable storage locators in the draft. Display-only metadata cannot be
 * used to reconstruct an attachment after the composer is remounted.
 */
export function composerAttachmentsToDraft(
  attachments: EmailAttachment[],
): InboxDraftAttachment[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    filename: attachment.file_name,
    content_type: attachment.mime_type,
    size: attachment.file_size,
    file_path: attachment.file_path,
    bucket_path: attachment.bucket_path,
    url: attachment.public_url,
  }));
}
