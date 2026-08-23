// @vitest-environment jsdom
/**
 * RP-M1 / D7 — the inline field save voice is the silent emerald check PLUS a
 * polite live region that reads "Saved" (no toast). The region is always
 * mounted (empty until saved) and sits beside, not inside, the role=button
 * display span so assistive tech is not told to ignore it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type FieldState = { status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'; lastValue?: unknown; error?: string | null };
let fields: Record<string, FieldState> = {};
const save = vi.fn();

vi.mock('@/hooks/useRecordFieldSave', () => ({
  useRecordFieldSave: () => ({ save, fields }),
}));
vi.mock('../InlineEditableRecordForm', () => ({
  serverHasCaughtUp: () => true,
}));
vi.mock('./AiSuggestChip', () => ({ AiSuggestChip: () => null }));

import { InlineFieldEditor } from './InlineFieldEditor';

afterEach(() => {
  cleanup();
  fields = {};
  save.mockClear();
});

describe('InlineFieldEditor saved announcement (RP-M1)', () => {
  it('mounts an empty polite live region at rest', () => {
    fields = {};
    render(<InlineFieldEditor field="preferred_name" value="Wen" ariaLabel="Preferred name" />);
    const status = screen.getByTestId('crm-inline-save-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');
    // The region is a sibling of the role=button span, not nested in it.
    const button = screen.getByRole('button', { name: 'Edit Preferred name' });
    expect(button.contains(status)).toBe(false);
    expect(button.querySelector('svg.lucide-check')).toBeNull();
  });

  it('reads "Saved" next to the emerald check once the field state is saved', () => {
    fields = { preferred_name: { status: 'saved', lastValue: 'Wendy' } };
    render(<InlineFieldEditor field="preferred_name" value="Wendy" ariaLabel="Preferred name" />);
    expect(screen.getByTestId('crm-inline-save-status').textContent).toBe('Saved');
    const button = screen.getByRole('button', { name: 'Edit Preferred name' });
    expect(button.querySelector('svg.lucide-check')).not.toBeNull();
  });

  it('stays silent while saving and on error (the failure voice is the Retry toast)', () => {
    fields = { preferred_name: { status: 'saving', lastValue: 'W' } };
    const { rerender } = render(<InlineFieldEditor field="preferred_name" value="W" />);
    expect(screen.getByTestId('crm-inline-save-status').textContent).toBe('');
    fields = { preferred_name: { status: 'error', lastValue: 'W', error: 'no connection' } };
    rerender(<InlineFieldEditor field="preferred_name" value="W" />);
    expect(screen.getByTestId('crm-inline-save-status').textContent).toBe('');
  });
});

/**
 * A11Y-1 — the click-to-edit affordance is reachable, visibly focused and
 * hands focus BACK when the keyboard leaves edit mode. Dropping focus on
 * <body> after Escape is the classic inline-edit keyboard trap-in-reverse:
 * the next Tab restarts from the top of the document.
 */
describe('InlineFieldEditor keyboard + focus (A11Y-1)', () => {
  it('is a focusable, labelled trigger with a visible focus-visible ring', () => {
    render(<InlineFieldEditor field="preferred_name" value="Wendy" ariaLabel="Preferred name" />);
    const trigger = screen.getByRole('button', { name: 'Edit Preferred name' });
    expect(trigger.getAttribute('tabindex')).toBe('0');
    const cls = trigger.className;
    expect(cls).toContain('focus-visible:ring-2');
    expect(cls).toContain('focus-visible:ring-teal-500');
    // The ring sits on its own offset so it reads on the hover wash / error fill.
    expect(cls).toContain('focus-visible:ring-offset-1');
    expect(cls).toContain('focus-visible:ring-offset-white');
    expect(cls).toContain('dark:focus-visible:ring-offset-slate-950');
    // The outline is only removed where the ring replaces it.
    expect(cls).toContain('focus-visible:outline-none');
  });

  it('opens the editor from the keyboard with Enter and with Space', async () => {
    const user = userEvent.setup();
    render(<InlineFieldEditor field="preferred_name" value="Wendy" ariaLabel="Preferred name" />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Preferred name' }));
    await user.keyboard('{Enter}');
    const input = await screen.findByRole('textbox', { name: 'Preferred name' });
    await waitFor(() => expect(document.activeElement).toBe(input));

    await user.keyboard('{Escape}');
    const trigger = await screen.findByRole('button', { name: 'Edit Preferred name' });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await user.keyboard(' ');
    expect(await screen.findByRole('textbox', { name: 'Preferred name' })).not.toBeNull();
  });

  it('returns focus to the trigger when Escape cancels the edit', async () => {
    const user = userEvent.setup();
    render(<InlineFieldEditor field="preferred_name" value="Wendy" ariaLabel="Preferred name" />);
    const trigger = screen.getByRole('button', { name: 'Edit Preferred name' });
    await user.click(trigger);
    const input = await screen.findByRole('textbox', { name: 'Preferred name' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Preferred name' })));
    expect(document.activeElement).not.toBe(document.body);
    expect(save).not.toHaveBeenCalled();
  });

  it('returns focus to the trigger when Enter commits the edit', async () => {
    const user = userEvent.setup();
    render(<InlineFieldEditor field="preferred_name" value="Wendy" ariaLabel="Preferred name" />);
    await user.click(screen.getByRole('button', { name: 'Edit Preferred name' }));
    const input = await screen.findByRole('textbox', { name: 'Preferred name' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    await user.clear(input);
    await user.type(input, 'Wen');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Preferred name' })));
    expect(save).toHaveBeenCalledWith('preferred_name', 'Wen', undefined);
  });

  it('does not steal focus when the edit is committed by clicking away', async () => {
    const user = userEvent.setup();
    render(
      <>
        <InlineFieldEditor field="preferred_name" value="Wendy" ariaLabel="Preferred name" />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Edit Preferred name' }));
    const input = await screen.findByRole('textbox', { name: 'Preferred name' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    await user.click(elsewhere);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Preferred name' })).toBeNull());
    expect(document.activeElement).toBe(elsewhere);
  });
});

/**
 * A11Y-1 — a widget may not contain focusable descendants (axe
 * `nested-interactive`, serious). The header renders phone/email values as
 * real tel:/mailto: links, so when the value is interactive the wrapper stops
 * claiming to be a button and the pencil becomes the named edit control.
 */
describe('InlineFieldEditor with an interactive display value (A11Y-1)', () => {
  const phoneLink = (v: string | number | null | undefined) => <a href={`tel:${String(v)}`}>{String(v)}</a>;

  it('keeps role=button when the value is plain text', () => {
    render(<InlineFieldEditor field="preferred_name" value="Wendy" ariaLabel="Preferred name" />);
    const trigger = screen.getByRole('button', { name: 'Edit Preferred name' });
    expect(trigger.tagName).toBe('SPAN');
    expect(trigger.querySelector('a')).toBeNull();
  });

  it('drops the wrapper role and exposes a real Edit button when the value is a link', async () => {
    render(<InlineFieldEditor field="phone" value="5550107788" ariaLabel="Phone" display={phoneLink} />);
    const link = await screen.findByRole('link', { name: '5550107788' });
    const editButton = await screen.findByRole('button', { name: 'Edit Phone' });
    expect(editButton.tagName).toBe('BUTTON');
    // The link is NOT inside the button (that is exactly nested-interactive)…
    expect(editButton.contains(link)).toBe(false);
    // …and no ancestor of the link claims a widget role.
    let el: HTMLElement | null = link.parentElement;
    while (el && el !== document.body) {
      expect(el.getAttribute('role')).not.toBe('button');
      el = el.parentElement;
    }
  });

  it('opens the editor from that Edit button', async () => {
    const user = userEvent.setup();
    render(<InlineFieldEditor field="phone" value="5550107788" ariaLabel="Phone" display={phoneLink} />);
    await user.click(await screen.findByRole('button', { name: 'Edit Phone' }));
    expect(await screen.findByRole('textbox', { name: 'Phone' })).not.toBeNull();
  });
});
