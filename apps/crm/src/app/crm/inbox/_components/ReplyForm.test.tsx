// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxConversation, InboxMessage } from '@/lib/inbox/types';
import { ReplyForm } from './ReplyForm';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

vi.mock('@/components/email/LazyEmailEditor', () => ({
  LazyEmailEditor: ({
    content,
    onChange,
  }: {
    content: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Type your reply..."
      value={content}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock('@/components/email/EmailAttachments', () => ({
  EmailAttachments: () => <div data-testid="attachments" />,
}));

const conversation = {
  id: 'conv-1',
  mailbox_address: 'wendy@payitforwardhealth.com',
  contact_email: 'kitty@example.com',
  contact_name: 'Kitty',
  subject: 'Requested',
} as InboxConversation;

const authProfile = {
  id: 'p1',
  organization_id: 'org-1',
  full_name: 'Maximus',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ReplyForm dock', () => {
  it('starts collapsed so the thread has the pane, then opens from the tab', () => {
    render(
      <ReplyForm
        selectedConversation={conversation}
        messages={[]}
        authProfile={authProfile}
        authUserEmail="omnivurse@gmail.com"
        mailboxes={[
          {
            email: 'wendy@payitforwardhealth.com',
            name: 'Wendy',
            label: 'Wendy',
            isDefault: true,
            unreadCount: 0,
          },
        ]}
        onReplySent={vi.fn()}
      />,
    );

    const tab = screen.getByRole('button', { expanded: false });
    expect(screen.queryByLabelText('Type your reply...')).toBeNull();

    fireEvent.click(tab);
    expect(screen.getByRole('button', { expanded: true })).toBeTruthy();
    expect(screen.getByLabelText('Type your reply...')).toBeTruthy();
    expect(document.getElementById('inbox-reply-composer')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Give reply more space' }));
    expect(screen.getByRole('button', { name: 'Shrink reply', pressed: true })).toBeTruthy();
  });

  it('opens compose immediately when Forward is clicked', () => {
    const onForward = vi.fn();
    const inbound = {
      id: 'm1',
      direction: 'inbound',
      from_name: 'Kitty',
      from_address: 'kitty@example.com',
      subject: 'Requested',
      body_html: '<p>Line one</p><p>Line two</p>',
      body_text: 'Line one',
      sent_at: '2026-09-01T12:00:00.000Z',
      attachments: [],
    } as InboxMessage;

    render(
      <ReplyForm
        selectedConversation={conversation}
        messages={[inbound]}
        authProfile={authProfile}
        authUserEmail="omnivurse@gmail.com"
        onReplySent={vi.fn()}
        onForward={onForward}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open reply' }));
    fireEvent.click(screen.getByRole('button', { name: /^forward$/i }));

    expect(onForward).toHaveBeenCalledTimes(1);
    expect(onForward.mock.calls[0][0]).toBe('Fwd: Requested');
    expect(onForward.mock.calls[0][1]).toContain('Forwarded message');
    expect(onForward.mock.calls[0][1]).toContain('Line two');
  });

  it('addresses and threads a message-scoped reply against the selected message', async () => {
    const selectedMessage = {
      id: 'm1',
      conversation_id: conversation.id,
      direction: 'inbound',
      from_name: 'Case Manager',
      from_address: 'case-manager@example.com',
      reply_to_address: 'case-replies@example.com',
      to_address: 'wendy@payitforwardhealth.com',
      message_id: '<first@example.com>',
      references_ids: ['<root@example.com>'],
      cc_addresses: [],
      subject: 'Requested',
      body_html: '<p>First request</p>',
      body_text: 'First request',
      sent_at: '2026-09-01T12:00:00.000Z',
      attachments: [],
    } as InboxMessage;
    const latestMessage = {
      ...selectedMessage,
      id: 'm2',
      from_name: 'Broker',
      from_address: 'broker@example.com',
      reply_to_address: null,
      message_id: '<latest@example.com>',
      references_ids: ['<other-root@example.com>'],
      sent_at: '2026-09-01T13:00:00.000Z',
    } as InboxMessage;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ReplyForm
        selectedConversation={conversation}
        messages={[selectedMessage, latestMessage]}
        replyTargetMessage={selectedMessage}
        authProfile={authProfile}
        authUserEmail="omnivurse@gmail.com"
        mailboxes={[
          {
            email: 'wendy@payitforwardhealth.com',
            name: 'Wendy',
            label: 'Wendy',
            isDefault: true,
            unreadCount: 0,
          },
        ]}
        onReplySent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open reply' }));
    fireEvent.change(screen.getByLabelText('Type your reply...'), {
      target: { value: '<p>Private response</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(request.body as string);
    expect(payload).toMatchObject({
      to: 'case-replies@example.com',
      to_name: 'Case Manager',
      in_reply_to: '<first@example.com>',
      references: ['<root@example.com>', '<first@example.com>'],
    });
  });
});
