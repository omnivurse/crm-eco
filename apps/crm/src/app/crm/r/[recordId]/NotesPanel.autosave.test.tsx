// @vitest-environment jsdom
/**
 * The composer persists a non-blank draft after a pause so leaving the page
 * (a phone call) cannot lose an unsaved note. The date/time stamp is always
 * shown at the top of the composer.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NotesPanel } from './NotesPanel';
import { NoteComposeProvider } from '@/components/crm/notes/NoteComposeContext';
import { NOTE_AUTOSAVE_MS } from '@/lib/crm/note-autosave';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

function renderPanel() {
  return render(
    <NoteComposeProvider composeNonce={1} requestCompose={() => {}}>
      <NotesPanel recordId="11111111-1111-4111-8111-111111111111" orgId="org-1" notes={[]} />
    </NoteComposeProvider>,
  );
}

function editor(): HTMLElement {
  const composer = screen.getByTestId('crm-notes-composer');
  const el = composer.querySelector<HTMLElement>('[contenteditable]');
  if (!el) throw new Error('composer has no contentEditable editor');
  return el;
}

beforeEach(() => {
  cleanup();
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'note-1',
        org_id: 'org-1',
        record_id: '11111111-1111-4111-8111-111111111111',
        body: '<p>Called Wendy</p>',
        is_pinned: false,
        note_date: null,
        created_by: 'me',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('NotesPanel autosave', () => {
  it('shows the date and time at the top of a new note', () => {
    renderPanel();
    const composer = screen.getByTestId('crm-notes-composer');
    expect(composer.textContent).toMatch(/·\s\d{1,2}:\d{2}\s[AP]M/);
    expect(composer.textContent).toMatch(/Added to every note automatically/);
  });

  it('POSTs the draft after the autosave pause', async () => {
    renderPanel();
    const el = editor();
    el.innerHTML = '<p>Called Wendy</p>';
    fireEvent.input(el);

    expect(fetch).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(NOTE_AUTOSAVE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/crm/notes');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string).body).toContain('Called Wendy');
    expect(screen.getByTestId('crm-notes-save-status').textContent).toBe('Saved');
  });

  it('persists edits queued while an earlier autosave is in flight', async () => {
    let resolveFirst!: (value: {
      ok: boolean;
      status: number;
      json: () => Promise<Record<string, unknown>>;
    }) => void;
    const firstResponse = new Promise<{
      ok: boolean;
      status: number;
      json: () => Promise<Record<string, unknown>>;
    }>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    renderPanel();
    const el = editor();
    el.innerHTML = '<p>First version</p>';
    fireEvent.input(el);
    await act(async () => {
      vi.advanceTimersByTime(NOTE_AUTOSAVE_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    el.innerHTML = '<p>Newest version</p>';
    fireEvent.input(el);
    await act(async () => {
      vi.advanceTimersByTime(NOTE_AUTOSAVE_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'note-1',
          org_id: 'org-1',
          record_id: '11111111-1111-4111-8111-111111111111',
          body: '<p>First version</p>',
        }),
      });
      await firstResponse;
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/crm/notes/note-1');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((init as RequestInit).body as string).body).toContain('Newest version');
  });

  it('flushes edits before the secondary Done action closes an autosaved draft', async () => {
    renderPanel();
    const el = editor();
    el.innerHTML = '<p>First version</p>';
    fireEvent.input(el);
    await act(async () => {
      vi.advanceTimersByTime(NOTE_AUTOSAVE_MS);
      await Promise.resolve();
    });

    el.innerHTML = '<p>Newest version</p>';
    fireEvent.input(el);
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Done' })[0]!);
      await Promise.resolve();
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/crm/notes/note-1');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((init as RequestInit).body as string).body).toContain('Newest version');
    expect(screen.queryByTestId('crm-notes-composer')).toBeNull();
  });

  it('does not POST a blank draft', async () => {
    renderPanel();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTE_AUTOSAVE_MS);
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
