// @vitest-environment jsdom
/**
 * RP-M1 / D7 — the inline field save voice is the silent emerald check PLUS a
 * polite live region that reads "Saved" (no toast). The region is always
 * mounted (empty until saved) and sits beside, not inside, the role=button
 * display span so assistive tech is not told to ignore it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

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
