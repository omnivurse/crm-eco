import { describe, expect, it } from 'vitest';
import type { EmailAttachment } from '@/components/email/EmailAttachments';
import type { InboxDraft } from '@/lib/inbox/types';
import {
  buildReplyDraftPayload,
  findReplyDraft,
  persistableAttachments,
  replyDraftHasContent,
  replyDraftLabel,
  resolveReplyDraftStatus,
  restoreReplyDraft,
  shouldDeleteReplyDraft,
} from './reply-draft';

function draft(over: Partial<InboxDraft> = {}): InboxDraft {
  return {
    id: 'd1',
    org_id: 'o1',
    conversation_id: 'c1',
    author_id: 'p1',
    to_addresses: [],
    cc_addresses: [],
    bcc_addresses: [],
    subject: null,
    body_html: '<p>Hi</p>',
    body_text: null,
    signature_id: null,
    attachments: [],
    scheduled_at: null,
    is_reply: true,
    reply_mode: 'reply',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...over,
  };
}

function attachment(over: Partial<EmailAttachment> = {}): EmailAttachment {
  return {
    id: 'a1',
    file_name: 'roster.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    file_path: 'org/inbound/x/roster.pdf',
    ...over,
  } as EmailAttachment;
}

describe('replyDraftLabel', () => {
  it('never claims a draft is saved when it only exists in this tab', () => {
    expect(replyDraftLabel('local')).toBe('Draft kept in this tab');
    expect(replyDraftLabel('local')).not.toMatch(/saved/i);
  });

  it('promises persistence only once the server acknowledged it', () => {
    expect(replyDraftLabel('saved')).toBe('Draft saved');
    expect(replyDraftLabel('saving')).toBe('Saving draft…');
    expect(replyDraftLabel('empty')).toBeNull();
  });
});

describe('resolveReplyDraftStatus', () => {
  it('is empty with nothing typed', () => {
    expect(
      resolveReplyDraftStatus({ hasContent: false, saving: false, serverMatchesContent: false }),
    ).toBe('empty');
  });

  it('reports local while a write is outstanding or refused', () => {
    expect(
      resolveReplyDraftStatus({ hasContent: true, saving: false, serverMatchesContent: false }),
    ).toBe('local');
  });

  it('reports saved only when the server copy matches what is on screen', () => {
    expect(
      resolveReplyDraftStatus({ hasContent: true, saving: false, serverMatchesContent: true }),
    ).toBe('saved');
  });

  it('shows saving in preference to a stale saved state', () => {
    expect(
      resolveReplyDraftStatus({ hasContent: true, saving: true, serverMatchesContent: true }),
    ).toBe('saving');
  });
});

describe('replyDraftHasContent', () => {
  it('treats an empty editor document as empty', () => {
    expect(replyDraftHasContent('')).toBe(false);
    expect(replyDraftHasContent('<p></p>')).toBe(false);
    expect(replyDraftHasContent(null)).toBe(false);
  });

  it('counts an attachment as content even with no text', () => {
    expect(replyDraftHasContent('<p></p>', [attachment()])).toBe(true);
  });
});

describe('persistableAttachments', () => {
  it('keeps only files that have a stored object', () => {
    const kept = persistableAttachments([
      attachment({ id: 'ok' }),
      attachment({ id: 'no-path', file_path: undefined, bucket_path: undefined }),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].file_path).toBe('org/inbound/x/roster.pdf');
  });

  it('skips files that are still uploading or failed', () => {
    expect(
      persistableAttachments([
        attachment({ id: 'up', is_uploading: true }),
        attachment({ id: 'bad', error: 'too big' }),
      ]),
    ).toHaveLength(0);
  });

  it('falls back to bucket_path when file_path is absent', () => {
    const kept = persistableAttachments([
      attachment({ file_path: undefined, bucket_path: 'org/x/y.pdf' }),
    ]);
    expect(kept[0].file_path).toBe('org/x/y.pdf');
  });
});

describe('buildReplyDraftPayload', () => {
  const base = {
    conversationId: 'c1',
    subject: 'Invoice 10428',
    bodyHtml: '<p>On it</p>',
    toAddress: 'dawn@bank.test',
    toName: 'Dawn',
    ccAddresses: [{ email: 'frank@bank.test' }],
    signatureId: 'sig1',
    attachments: [] as EmailAttachment[],
  };

  it('carries CC only when the reply is a reply-all', () => {
    expect(buildReplyDraftPayload({ ...base, replyMode: 'reply' }).cc_addresses).toEqual([]);
    expect(buildReplyDraftPayload({ ...base, replyMode: 'reply_all' }).cc_addresses).toEqual([
      { email: 'frank@bank.test' },
    ]);
  });

  it('derives a plain-text preview so the Drafts list is readable', () => {
    const payload = buildReplyDraftPayload({
      ...base,
      replyMode: 'reply',
      bodyHtml: '<p>Hello</p><p>there</p>',
    });
    expect(payload.body_text).toBe('Hello there');
  });

  it('always marks the row as a reply so it never opens as new compose', () => {
    const payload = buildReplyDraftPayload({ ...base, replyMode: 'reply' });
    expect(payload.is_reply).toBe(true);
    expect(payload.conversation_id).toBe('c1');
  });

  it('tolerates a thread with no resolvable recipient', () => {
    const payload = buildReplyDraftPayload({ ...base, replyMode: 'reply', toAddress: null });
    expect(payload.to_addresses).toEqual([]);
  });
});

describe('findReplyDraft', () => {
  it('matches only this conversation and only reply drafts', () => {
    const drafts = [
      draft({ id: 'other-thread', conversation_id: 'c2' }),
      draft({ id: 'compose', conversation_id: null, is_reply: false }),
      draft({ id: 'mine' }),
    ];
    expect(findReplyDraft(drafts, 'c1')?.id).toBe('mine');
  });

  it('ignores a scheduled draft so a queued send is never re-opened for editing', () => {
    const drafts = [draft({ id: 'queued', scheduled_at: '2026-09-10T00:00:00Z' })];
    expect(findReplyDraft(drafts, 'c1')).toBeNull();
  });

  it('takes the newest when two tabs raced', () => {
    const drafts = [
      draft({ id: 'older', updated_at: '2026-09-01T00:00:00Z' }),
      draft({ id: 'newer', updated_at: '2026-09-02T00:00:00Z' }),
    ];
    expect(findReplyDraft(drafts, 'c1')?.id).toBe('newer');
  });

  it('returns null when nothing matches', () => {
    expect(findReplyDraft([], 'c1')).toBeNull();
  });
});

describe('restoreReplyDraft', () => {
  it('prefers what is in this tab over the server copy', () => {
    const restored = restoreReplyDraft({
      cached: { html: '<p>typed just now</p>', attachments: [] },
      saved: draft({ body_html: '<p>older server copy</p>' }),
    });
    expect(restored?.html).toBe('<p>typed just now</p>');
    // The row id still travels so the next save updates rather than duplicates.
    expect(restored?.draftId).toBe('d1');
  });

  it('falls back to the server copy after a reload', () => {
    const restored = restoreReplyDraft({ cached: null, saved: draft() });
    expect(restored?.html).toBe('<p>Hi</p>');
    expect(restored?.draftId).toBe('d1');
  });

  it('restores only attachments that can still be sent', () => {
    const restored = restoreReplyDraft({
      cached: null,
      saved: draft({
        attachments: [
          { filename: 'ok.pdf', content_type: 'application/pdf', size: 10, file_path: 'o/1/ok.pdf' },
          { filename: 'dead.pdf', content_type: 'application/pdf', size: 10, file_path: null },
        ],
      }),
    });
    expect(restored?.attachments).toHaveLength(1);
    expect(restored?.attachments[0].file_name).toBe('ok.pdf');
  });

  it('returns null when neither side holds anything worth restoring', () => {
    expect(restoreReplyDraft({ cached: null, saved: null })).toBeNull();
    expect(
      restoreReplyDraft({ cached: { html: '<p></p>', attachments: [] }, saved: null }),
    ).toBeNull();
  });
});

describe('shouldDeleteReplyDraft', () => {
  it('never fires a request when no row exists', () => {
    expect(shouldDeleteReplyDraft({ draftId: null, hasContent: false, sent: true })).toBe(false);
  });

  it('removes the row once the reply is sent', () => {
    expect(shouldDeleteReplyDraft({ draftId: 'd1', hasContent: true, sent: true })).toBe(true);
  });

  it('removes the row when the user cleared the composer', () => {
    expect(shouldDeleteReplyDraft({ draftId: 'd1', hasContent: false, sent: false })).toBe(true);
  });

  it('keeps the row while the user is still writing', () => {
    expect(shouldDeleteReplyDraft({ draftId: 'd1', hasContent: true, sent: false })).toBe(false);
  });
});
