// @vitest-environment jsdom
/**
 * A curated picklist stores a CODE and shows a LABEL. `Dropdown lists` writes
 * `[{ id, value, label, is_active }]` into `crm_fields.options`, and every
 * picker has to read the pair — the select cell already did, this one was still
 * being handed `getFieldOptions()` (bare values), so a curated multiselect
 * would have offered raw codes in the picker AND printed them in the chips.
 *
 * These tests pin both halves: what the user reads is the label, what the
 * record stores is the code, and a value whose option was curated away is still
 * legible and removable rather than vanishing from the chip row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const save = vi.fn();
vi.mock('@/hooks/useRecordFieldSave', () => ({
  useRecordFieldSave: () => ({ save, fields: {} }),
}));
vi.mock('@/hooks/useRecordFieldLocks', () => ({
  useRecordFieldLocks: () => ({
    acquireFieldLock: vi.fn().mockResolvedValue(true),
    releaseFieldLock: vi.fn().mockResolvedValue(undefined),
  }),
  useFieldLockOwner: () => null,
}));

import { InlineMultiSelectField } from './InlineMultiSelectField';

const OPTIONS = [
  { value: '2_legacy_zoho', label: 'Legacy — Zoho' },
  { value: '3_enrollment', label: 'Enrollment' },
  { value: '4_native', label: 'Native' },
];

afterEach(() => {
  cleanup();
  save.mockClear();
});

describe('InlineMultiSelectField — curated value/label picklists', () => {
  it('shows the LABEL on a selected chip, not the stored code', () => {
    render(
      <InlineMultiSelectField
        field="record_origin_tags"
        value={['2_legacy_zoho']}
        options={OPTIONS}
        ariaLabel="Record origin"
      />,
    );
    expect(screen.getByText('Legacy — Zoho')).toBeTruthy();
    expect(screen.queryByText('2_legacy_zoho')).toBeNull();
    // The remove control names what the user sees, not the code.
    expect(screen.getByRole('button', { name: 'Remove Legacy — Zoho' })).toBeTruthy();
  });

  it('offers labels in the picker and saves the code', async () => {
    const user = userEvent.setup();
    render(
      <InlineMultiSelectField
        field="record_origin_tags"
        value={[]}
        options={OPTIONS}
        ariaLabel="Record origin"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Edit Record origin' }));

    expect(screen.getByText('Enrollment')).toBeTruthy();
    expect(screen.queryByText('3_enrollment')).toBeNull();

    await user.click(screen.getByText('Enrollment'));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toEqual(['3_enrollment']);
  });

  it('keeps a value whose option was curated away legible and removable', () => {
    render(
      <InlineMultiSelectField
        field="record_origin_tags"
        value={['9_retired_code']}
        options={OPTIONS}
        ariaLabel="Record origin"
      />,
    );
    // No label to show: the code itself is better than an empty chip the user
    // cannot see, let alone clear.
    expect(screen.getByText('9_retired_code')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove 9_retired_code' })).toBeTruthy();
  });

  it('says so when the field has no options at all', async () => {
    const user = userEvent.setup();
    render(
      <InlineMultiSelectField
        field="record_origin_tags"
        value={[]}
        options={[]}
        ariaLabel="Record origin"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Edit Record origin' }));
    expect(screen.getByText('No options defined')).toBeTruthy();
  });
});
