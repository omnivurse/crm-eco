// @vitest-environment jsdom
/**
 * Curated picklists can RETIRE an option (`is_active: false`), and
 * `getFieldOptionChoices` stopped offering those. That is right for a new pick
 * and wrong for a record that already holds one: with no matching `<option>`,
 * a native `<select>` silently falls back to the empty placeholder, so a field
 * that is NOT empty reads as "nothing chosen" — and one careless save would
 * then write that emptiness back.
 *
 * The retired value is re-attached to the offered list, disabled so it cannot
 * be chosen again and labelled so it can be read. Nothing here depends on what
 * production's `crm_fields` happens to hold today.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

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

import { InlineSelectField } from './InlineSelectField';

const LIVE = [
  { value: '3_enrollment', label: 'Enrollment' },
  { value: '4_native', label: 'Native' },
];

afterEach(() => {
  cleanup();
  save.mockClear();
});

function selectEl(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: 'Record origin' }) as HTMLSelectElement;
}

describe('InlineSelectField — a stored value the curator retired', () => {
  it('still selects it, instead of falling back to the placeholder', () => {
    render(
      <InlineSelectField
        field="record_origin"
        value="2_legacy_zoho"
        options={LIVE}
        ariaLabel="Record origin"
        placeholder="Select record origin"
      />,
    );
    expect(selectEl().value).toBe('2_legacy_zoho');
  });

  it('offers it disabled, so it can be read but never re-chosen', () => {
    render(
      <InlineSelectField
        field="record_origin"
        value="2_legacy_zoho"
        options={LIVE}
        ariaLabel="Record origin"
        placeholder="Select record origin"
      />,
    );
    const retired = [...selectEl().options].find((o) => o.value === '2_legacy_zoho');
    expect(retired).toBeDefined();
    expect(retired!.disabled).toBe(true);
    // The live options are untouched and still pickable.
    const live = [...selectEl().options].filter((o) => o.value && !o.disabled);
    expect(live.map((o) => o.value)).toEqual(['3_enrollment', '4_native']);
  });

  it('adds nothing when the stored value is still on the list', () => {
    render(
      <InlineSelectField
        field="record_origin"
        value="4_native"
        options={LIVE}
        ariaLabel="Record origin"
        placeholder="Select record origin"
      />,
    );
    // placeholder + the two live options, no phantom third.
    expect(selectEl().options.length).toBe(3);
    expect(selectEl().value).toBe('4_native');
  });

  it('adds nothing when the field is genuinely empty', () => {
    render(
      <InlineSelectField
        field="record_origin"
        value={null}
        options={LIVE}
        ariaLabel="Record origin"
        placeholder="Select record origin"
      />,
    );
    expect(selectEl().options.length).toBe(3);
    expect(selectEl().value).toBe('');
  });
});
