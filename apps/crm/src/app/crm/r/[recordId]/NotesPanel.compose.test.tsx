// @vitest-environment jsdom
/**
 * TE-1 / RP-2 — the in-pane composer focuses its editor when it opens and a
 * repeat compose request (header button, `n`, deep link) never wipes a draft.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NotesPanel } from './NotesPanel';
import { NoteComposeProvider } from '@/components/crm/notes/NoteComposeContext';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

function renderPanel(nonce: number) {
  const ui = (n: number) => (
    <NoteComposeProvider composeNonce={n} requestCompose={() => {}}>
      <NotesPanel recordId="rec-1" orgId="org-1" notes={[]} />
    </NoteComposeProvider>
  );
  const result = render(ui(nonce));
  return { ...result, setNonce: (n: number) => result.rerender(ui(n)) };
}

function editor(): HTMLElement {
  const composer = screen.getByTestId('crm-notes-composer');
  const el = composer.querySelector<HTMLElement>('[contenteditable]');
  if (!el) throw new Error('composer has no contentEditable editor');
  return el;
}

function typeDraft(el: HTMLElement, html: string) {
  el.innerHTML = html;
  fireEvent.input(el);
}

beforeEach(() => {
  cleanup();
});

describe('NotesPanel composer (TE-1)', () => {
  it('a fresh open from the pane button focuses the editor', () => {
    renderPanel(0);
    expect(screen.queryByTestId('crm-notes-composer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /add note/i }));
    const el = editor();
    expect(document.activeElement).toBe(el);
    expect(el.innerHTML).toBe('');
  });

  it('a compose request (nonce) opens and focuses; two more with a draft keep the draft and re-focus', () => {
    const { setNonce } = renderPanel(0);
    act(() => setNonce(1));
    const el = editor();
    expect(document.activeElement).toBe(el);

    typeDraft(el, '<p>half-typed</p>');
    act(() => el.blur());
    expect(document.activeElement).not.toBe(el);

    act(() => setNonce(2));
    expect(editor()).toBe(el); // no remount
    expect(el.innerHTML).toBe('<p>half-typed</p>');
    expect(document.activeElement).toBe(el);

    act(() => el.blur());
    act(() => setNonce(3));
    expect(editor()).toBe(el);
    expect(el.innerHTML).toBe('<p>half-typed</p>');
    expect(document.activeElement).toBe(el);
    // Save is still armed by the surviving draft
    expect((screen.getByTestId('crm-notes-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('cancel then compose again starts a clean, focused editor', () => {
    const { setNonce } = renderPanel(0);
    act(() => setNonce(1));
    const first = editor();
    typeDraft(first, '<p>discard me</p>');
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByTestId('crm-notes-composer')).toBeNull();

    act(() => setNonce(2));
    const second = editor();
    expect(second).not.toBe(first); // remounted (epoch bump)
    expect(second.innerHTML).toBe('');
    expect(document.activeElement).toBe(second);
  });
});
