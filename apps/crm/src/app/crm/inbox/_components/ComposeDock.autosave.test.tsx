// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailComposerData } from '@/components/email/EmailComposer';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { ComposeDock } from './ComposeDock';

const LATEST_MESSAGE: EmailComposerData = {
  to: [{ email: 'member@example.com' }],
  cc: [],
  bcc: [],
  subject: 'Latest subject',
  body_html: '<p>Latest body</p>',
  attachments: [],
};

const STALE_MESSAGE: EmailComposerData = {
  ...LATEST_MESSAGE,
  subject: 'Stale subject',
  body_html: '<p>Stale body</p>',
};

vi.mock('@/components/email/EmailComposer', () => ({
  EmailComposer: ({
    onDirtyChange,
    onSave,
  }: {
    onDirtyChange?: (dirty: boolean, data: EmailComposerData) => void;
    onSave?: (data: EmailComposerData) => Promise<void>;
  }) => (
    <div>
      <button type="button" onClick={() => onDirtyChange?.(true, LATEST_MESSAGE)}>
        Edit message
      </button>
      <button type="button" onClick={() => void onSave?.(LATEST_MESSAGE)}>
        Start autosave
      </button>
      <button type="button" onClick={() => void onSave?.(STALE_MESSAGE)}>
        Start stale autosave
      </button>
    </div>
  ),
}));

vi.mock('./TemplatePicker', () => ({
  TemplatePicker: () => null,
}));

vi.mock('@crm-eco/ui/components/confirm-dialog', () => ({
  confirmDialog: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

function renderDock(onOpenChange = vi.fn()) {
  render(
    <ComposeDock
      open
      onOpenChange={onOpenChange}
      authProfile={{
        id: 'profile-1',
        organization_id: 'org-1',
        full_name: 'Staff Member',
      }}
      authUserEmail="staff@example.com"
      onMessageSent={vi.fn()}
      composerKey="compose-1"
      fallbackEmail="staff@example.com"
      fallbackName="Staff Member"
      fallbackReplyTo="inbox@example.com"
    />,
  );
  return onOpenChange;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ComposeDock close persistence', () => {
  it('flushes the latest message before closing with Keep in Drafts', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(true);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ draft: { id: 'draft-1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onOpenChange = renderDock();

    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close message' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/inbox/drafts');
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      subject: 'Latest subject',
      body_html: '<p>Latest body</p>',
    });
  });

  it('waits for an in-flight create before discarding the resulting draft', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(false);
    let finishCreate: ((value: {
      ok: boolean;
      json: () => Promise<{ draft: { id: string } }>;
    }) => void) | undefined;
    const createResponse = new Promise<{
      ok: boolean;
      json: () => Promise<{ draft: { id: string } }>;
    }>((resolve) => {
      finishCreate = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => createResponse)
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const onOpenChange = renderDock();

    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start autosave' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close message' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalled();

    finishCreate?.({
      ok: true,
      json: async () => ({ draft: { id: 'draft-1' } }),
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/inbox/drafts/draft-1', {
      method: 'DELETE',
    });
  });

  it('writes the latest snapshot after an older autosave finishes', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(true);
    let finishCreate: ((value: {
      ok: boolean;
      json: () => Promise<{ draft: { id: string } }>;
    }) => void) | undefined;
    const createResponse = new Promise<{
      ok: boolean;
      json: () => Promise<{ draft: { id: string } }>;
    }>((resolve) => {
      finishCreate = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => createResponse)
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const onOpenChange = renderDock();

    fireEvent.click(screen.getByRole('button', { name: 'Start stale autosave' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close message' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    finishCreate?.({
      ok: true,
      json: async () => ({ draft: { id: 'draft-1' } }),
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/inbox/drafts/draft-1');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toMatchObject({
      subject: 'Latest subject',
      body_html: '<p>Latest body</p>',
    });
  });
});
