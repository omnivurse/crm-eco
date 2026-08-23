// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import { NoteRichArea } from './NoteRichArea';

afterEach(cleanup);

function editorOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[contenteditable]');
  if (!el) throw new Error('no editor');
  return el;
}

describe('NoteRichArea focus', () => {
  it('does not steal focus by default', () => {
    const { container } = render(<NoteRichArea value="" onChange={() => {}} />);
    expect(document.activeElement).not.toBe(editorOf(container));
  });

  it('autoFocus focuses the editor on mount with the seeded draft in place', () => {
    const { container } = render(<NoteRichArea value="<p>seed</p>" onChange={() => {}} autoFocus />);
    const el = editorOf(container);
    expect(document.activeElement).toBe(el);
    expect(el.innerHTML).toBe('<p>seed</p>');
  });

  it('a focusSignal bump re-focuses the mounted editor without touching its content', () => {
    const onChange = vi.fn();
    const view = render(<NoteRichArea value="" onChange={onChange} autoFocus focusSignal={0} />);
    const el = editorOf(view.container);
    el.innerHTML = '<p>draft</p>';
    fireEvent.input(el);
    expect(onChange).toHaveBeenLastCalledWith('<p>draft</p>');
    act(() => el.blur());
    expect(document.activeElement).not.toBe(el);

    view.rerender(<NoteRichArea value="<p>draft</p>" onChange={onChange} autoFocus focusSignal={1} />);
    expect(editorOf(view.container)).toBe(el);
    expect(el.innerHTML).toBe('<p>draft</p>');
    expect(document.activeElement).toBe(el);
  });
});
