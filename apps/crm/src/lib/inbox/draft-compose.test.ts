import { describe, expect, it } from 'vitest';
import type { InboxDraft } from './types';
import {
  composerAttachmentsToDraft,
  inboxDraftToComposerSeed,
} from './draft-compose';

const draft: InboxDraft = {
  id: 'draft-1',
  org_id: 'org-1',
  conversation_id: null,
  author_id: 'profile-1',
  to_addresses: [{ email: 'to@example.com', name: 'To' }],
  cc_addresses: [{ email: 'cc@example.com', name: 'CC' }],
  bcc_addresses: [{ email: 'bcc@example.com', name: 'BCC' }],
  subject: 'Benefits',
  body_html: '<p>Please review.</p>',
  body_text: 'Please review.',
  signature_id: null,
  attachments: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      filename: 'benefits.pdf',
      content_type: 'application/pdf',
      size: 4096,
      file_path: 'org-1/benefits.pdf',
      bucket_path: 'org-1/benefits.pdf',
    },
  ],
  scheduled_at: null,
  is_reply: false,
  reply_mode: null,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
};

describe('draft composer hydration', () => {
  it('restores CC, BCC, and durable attachment locators', () => {
    const seed = inboxDraftToComposerSeed(draft);

    expect(seed).toMatchObject({
      to: draft.to_addresses,
      cc: draft.cc_addresses,
      bcc: draft.bcc_addresses,
      subject: draft.subject,
      body: draft.body_html,
      attachments: [
        {
          id: draft.attachments[0]?.id,
          file_name: 'benefits.pdf',
          file_path: 'org-1/benefits.pdf',
          bucket_path: 'org-1/benefits.pdf',
        },
      ],
    });
  });

  it('round-trips attachment storage references when the draft is saved again', () => {
    const [attachment] = inboxDraftToComposerSeed(draft).attachments;

    expect(composerAttachmentsToDraft(attachment ? [attachment] : [])).toEqual(
      draft.attachments,
    );
  });
});
