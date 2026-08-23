// @vitest-environment jsdom
/**
 * TE-6 — note templates land in the in-pane composer through the compose
 * context prefill, and the TE-1 guard still holds: a prefill seeds a closed or
 * blank composer, but never overwrites a non-empty draft.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NotesPanel, isBlankNoteHtml } from './NotesPanel';
import { NoteComposeProvider } from '@/components/crm/notes/NoteComposeContext';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

function renderPanel(nonce: number, prefill: string | null = null) {
  const ui = (n: number, p: string | null) => (
    <NoteComposeProvider composeNonce={n} composePrefill={p} requestCompose={() => {}}>
      <NotesPanel recordId="rec-1" orgId="org-1" notes={[]} />
    </NoteComposeProvider>
  );
  const result = render(ui(nonce, prefill));
  return { ...result, compose: (n: number, p: string | null = null) => result.rerender(ui(n, p)) };
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

beforeEach(() => cleanup());

describe('isBlankNoteHtml', () => {
  it('treats empty, whitespace, <p><br></p> and &nbsp; as blank; text as not blank', () => {
    expect(isBlankNoteHtml('')).toBe(true);
    expect(isBlankNoteHtml('   ')).toBe(true);
    expect(isBlankNoteHtml('<p><br></p>')).toBe(true);
    expect(isBlankNoteHtml('<p>&nbsp;</p>')).toBe(true);
    expect(isBlankNoteHtml('<p>x</p>')).toBe(false);
  });
});

describe('NotesPanel composer prefill (TE-6)', () => {
  it('a template request on a closed composer opens it seeded + focused; Save is armed', () => {
    const { compose } = renderPanel(0);
    expect(screen.queryByTestId('crm-notes-composer')).toBeNull();
    act(() => compose(1, '<p>Voicemail left for Wendy</p>'));
    const el = editor();
    expect(el.innerHTML).toBe('<p>Voicemail left for Wendy</p>');
    expect(document.activeElement).toBe(el);
    expect((screen.getByTestId('crm-notes-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('a template request on an open-but-blank composer seeds it (fresh focused editor, picked date kept)', () => {
    const { compose } = renderPanel(0);
    act(() => compose(1));
    const first = editor();
    expect(first.innerHTML).toBe('');
    const date = screen.getByLabelText('Note date') as HTMLInputElement;
    fireEvent.change(date, { target: { value: '2026-07-04' } });
    act(() => compose(2, '<p>Discovery call</p>'));
    const seeded = editor();
    expect(seeded.innerHTML).toBe('<p>Discovery call</p>');
    expect(document.activeElement).toBe(seeded);
    expect((screen.getByLabelText('Note date') as HTMLInputElement).value).toBe('2026-07-04');
  });

  it('a template request never overwrites a non-empty draft — it only re-focuses', () => {
    const { compose } = renderPanel(0);
    act(() => compose(1));
    const el = editor();
    typeDraft(el, '<p>half-typed</p>');
    act(() => el.blur());
    act(() => compose(2, '<p>Discovery call</p>'));
    expect(editor()).toBe(el);
    expect(el.innerHTML).toBe('<p>half-typed</p>');
    expect(document.activeElement).toBe(el);
  });

  it('a plain request after a template keeps the seeded draft (prefill is one-shot)', () => {
    const { compose } = renderPanel(0);
    act(() => compose(1, '<p>Follow-up required</p>'));
    const el = editor();
    act(() => el.blur());
    act(() => compose(2, null));
    expect(editor()).toBe(el);
    expect(el.innerHTML).toBe('<p>Follow-up required</p>');
    expect(document.activeElement).toBe(el);
  });
});
