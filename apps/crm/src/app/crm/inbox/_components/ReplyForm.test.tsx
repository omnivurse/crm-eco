// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxConversation } from '@/lib/inbox/types';
import { ReplyForm } from './ReplyForm';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/components/email/LazyEmailEditor', () => ({
  LazyEmailEditor: () => <textarea aria-label="Type your reply..." />,
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
});
