// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmailComposerData } from '@/components/email/EmailComposer';
import type { EmailAttachment } from '@/components/email/EmailAttachments';
import { ComposeModal } from './ComposeModal';

const { composerSpy } = vi.hoisted(() => ({
  composerSpy: vi.fn(),
}));

vi.mock('@/components/email/EmailComposer', async () => {
  const React = await import('react');
  return {
    EmailComposer: (props: Record<string, unknown>) => {
      const [mountedSubject] = React.useState(() => String(props.initialSubject ?? ''));
      composerSpy(props);
      return <div data-testid="email-composer">{mountedSubject}</div>;
    },
  };
});

vi.mock('./TemplatePicker', () => ({
  TemplatePicker: ({
    onSelect,
  }: {
    onSelect: (template: { subject: string; body_html: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSelect({
        subject: 'Template subject',
        body_html: '<p>Template body</p>',
      })}
    >
      Apply test template
    </button>
  ),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: vi.fn() },
}));

afterEach(() => {
  cleanup();
  composerSpy.mockClear();
  vi.restoreAllMocks();
});

const attachment: EmailAttachment = {
  id: '22222222-2222-4222-8222-222222222222',
  file_name: 'benefits.pdf',
  file_size: 4096,
  mime_type: 'application/pdf',
  file_path: 'org-1/benefits.pdf',
  bucket_path: 'org-1/benefits.pdf',
};

function renderResumedDraft() {
  render(
    <ComposeModal
      open
      onOpenChange={vi.fn()}
      authProfile={{
        id: 'profile-1',
        organization_id: 'org-1',
        full_name: 'Advisor',
      }}
      authUserEmail="advisor@example.com"
      onMessageSent={vi.fn()}
      initialTo={[{ email: 'to@example.com' }]}
      initialCc={[{ email: 'cc@example.com' }]}
      initialBcc={[{ email: 'bcc@example.com' }]}
      initialSubject="Benefits"
      initialBody="<p>Please review.</p>"
      initialAttachments={[attachment]}
      initialDraftId="draft-1"
      composerKey="compose-1"
    />,
  );

  return composerSpy.mock.calls.at(-1)?.[0] as {
    initialCc: Array<{ email: string }>;
    initialBcc: Array<{ email: string }>;
    initialAttachments: EmailAttachment[];
    autoSelectDefaultSignature: boolean;
    onSave: (data: EmailComposerData) => Promise<void>;
    onSchedule: (data: EmailComposerData, scheduledAt: Date) => Promise<void>;
  };
}

describe('ComposeModal resumed drafts', () => {
  it('passes every delivery-relevant field back into the composer', () => {
    const props = renderResumedDraft();

    expect(props.initialCc).toEqual([{ email: 'cc@example.com' }]);
    expect(props.initialBcc).toEqual([{ email: 'bcc@example.com' }]);
    expect(props.initialAttachments).toEqual([attachment]);
    expect(props.autoSelectDefaultSignature).toBe(false);
  });

  it('refuses to schedule attachments while the worker cannot restore them', async () => {
    const props = renderResumedDraft();

    await expect(
      props.onSchedule(
        {
          to: [{ email: 'to@example.com' }],
          cc: [],
          bcc: [],
          subject: 'Benefits',
          body_html: '<p>Please review.</p>',
          attachments: [attachment],
        },
        new Date('2026-09-02T10:00:00.000Z'),
      ),
    ).rejects.toThrow('Scheduled emails do not support attachments yet');
  });

  it('surfaces a failed update instead of claiming the draft was saved', async () => {
    const props = renderResumedDraft();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'write failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      props.onSave({
        to: [{ email: 'to@example.com' }],
        cc: [{ email: 'cc@example.com' }],
        bcc: [{ email: 'bcc@example.com' }],
        subject: 'Benefits',
        body_html: '<p>Please review.</p>',
        attachments: [attachment],
      }),
    ).rejects.toThrow('write failed');
  });

  it('remounts the editor with the selected template content', () => {
    renderResumedDraft();
    expect(screen.getByTestId('email-composer').textContent).toBe('Benefits');

    fireEvent.click(
      screen.getByRole('button', { name: 'Apply test template', hidden: true }),
    );

    expect(screen.getByTestId('email-composer').textContent).toBe('Template subject');
  });
});
