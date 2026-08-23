// @vitest-environment jsdom
/**
 * TE-6 — a compose request can carry a prefill (note templates). The prefill
 * travels with its nonce and is cleared by the next plain request, in both the
 * uncontrolled provider and the controlled (V2 shell) mode.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { NoteComposeProvider, noteTemplateBodyToHtml, useNoteComposeRequired } from './NoteComposeContext';

afterEach(() => cleanup());

describe('noteTemplateBodyToHtml', () => {
  it('turns lines into paragraphs and blank lines into empty paragraphs, escaping text', () => {
    expect(noteTemplateBodyToHtml('Called <Wendy> & co\n\nNext step: ')).toBe(
      '<p>Called &lt;Wendy&gt; &amp; co</p><p><br></p><p>Next step: </p>',
    );
  });

  it('passes HTML bodies through untouched and maps empty to empty', () => {
    expect(noteTemplateBodyToHtml('<p>already <b>rich</b></p>')).toBe('<p>already <b>rich</b></p>');
    expect(noteTemplateBodyToHtml('')).toBe('');
  });
});

function Probe() {
  const { composeNonce, composePrefill, requestCompose } = useNoteComposeRequired();
  return (
    <>
      <output data-testid="nonce">{composeNonce}</output>
      <output data-testid="prefill">{composePrefill ?? '(none)'}</output>
      <button type="button" onClick={() => requestCompose()}>
        plain
      </button>
      <button type="button" onClick={() => requestCompose('<p>Voicemail left</p>')}>
        template
      </button>
    </>
  );
}

describe('NoteComposeContext prefill', () => {
  it('uncontrolled: template request sets the prefill with its nonce; a plain request clears it', () => {
    render(
      <NoteComposeProvider>
        <Probe />
      </NoteComposeProvider>,
    );
    expect(screen.getByTestId('nonce').textContent).toBe('0');
    expect(screen.getByTestId('prefill').textContent).toBe('(none)');

    act(() => screen.getByRole('button', { name: 'template' }).click());
    expect(screen.getByTestId('nonce').textContent).toBe('1');
    expect(screen.getByTestId('prefill').textContent).toBe('<p>Voicemail left</p>');

    act(() => screen.getByRole('button', { name: 'plain' }).click());
    expect(screen.getByTestId('nonce').textContent).toBe('2');
    expect(screen.getByTestId('prefill').textContent).toBe('(none)');
  });

  it('controlled: forwards the body to the owner and exposes the owner-provided prefill', () => {
    const requestCompose = vi.fn();
    const { rerender } = render(
      <NoteComposeProvider composeNonce={3} composePrefill="<p>seed</p>" requestCompose={requestCompose}>
        <Probe />
      </NoteComposeProvider>,
    );
    expect(screen.getByTestId('nonce').textContent).toBe('3');
    expect(screen.getByTestId('prefill').textContent).toBe('<p>seed</p>');

    act(() => screen.getByRole('button', { name: 'template' }).click());
    expect(requestCompose).toHaveBeenCalledWith('<p>Voicemail left</p>');
    act(() => screen.getByRole('button', { name: 'plain' }).click());
    expect(requestCompose).toHaveBeenLastCalledWith(undefined);

    // Controlled with no prefill prop reads as "no prefill" (never the internal state).
    rerender(
      <NoteComposeProvider composeNonce={4} requestCompose={requestCompose}>
        <Probe />
      </NoteComposeProvider>,
    );
    expect(screen.getByTestId('prefill').textContent).toBe('(none)');
  });
});
