// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftsList } from './DraftsList';
import type { InboxDraft } from '@/lib/inbox/types';

afterEach(() => {
  cleanup();
});

function makeDraft(id: string, overrides: Partial<InboxDraft> = {}): InboxDraft {
  return {
    id,
    org_id: 'org-1',
    conversation_id: null,
    author_id: 'user-1',
    to_addresses: [{ email: `${id}@outside.test`, name: `Recipient ${id}` }],
    cc_addresses: [],
    bcc_addresses: [],
    subject: `Subject ${id}`,
    body_html: `<p>Body ${id}</p>`,
    body_text: `Body ${id}`,
    signature_id: null,
    attachments: [],
    scheduled_at: null,
    is_reply: false,
    reply_mode: null,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('DraftsList', () => {
  it('opens a draft from the row without deleting it', () => {
    const onSelectDraft = vi.fn();
    const onDeleteDraft = vi.fn();
    const draft = makeDraft('a');
    render(
      <DraftsList
        drafts={[draft]}
        onSelectDraft={onSelectDraft}
        onDeleteDraft={onDeleteDraft}
        mobileView="list"
      />,
    );

    fireEvent.click(screen.getByText('Recipient a'));
    expect(onSelectDraft).toHaveBeenCalledTimes(1);
    expect(onSelectDraft).toHaveBeenCalledWith(draft);
    expect(onDeleteDraft).not.toHaveBeenCalled();
  });

  it('deletes from the trash control without opening the draft', () => {
    const onSelectDraft = vi.fn();
    const onDeleteDraft = vi.fn();
    const first = makeDraft('a');
    const second = makeDraft('b', { subject: 'Invoice 10428' });
    render(
      <DraftsList
        drafts={[first, second]}
        onSelectDraft={onSelectDraft}
        onDeleteDraft={onDeleteDraft}
        mobileView="list"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete draft: Invoice 10428' }));
    expect(onDeleteDraft).toHaveBeenCalledTimes(1);
    expect(onDeleteDraft).toHaveBeenCalledWith(second);
    expect(onSelectDraft).not.toHaveBeenCalled();
  });

  it('names an untitled draft so delete is still findable', () => {
    render(
      <DraftsList
        drafts={[makeDraft('empty', { subject: '   ' })]}
        onSelectDraft={vi.fn()}
        onDeleteDraft={vi.fn()}
        mobileView="list"
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete draft: (No subject)' })).toBeTruthy();
  });
});
