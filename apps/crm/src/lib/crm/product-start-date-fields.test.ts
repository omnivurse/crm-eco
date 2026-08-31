import { describe, expect, it } from 'vitest';
import {
  CANONICAL_START_DATE_KEY,
  LEGACY_START_DATE_MIRROR_KEYS,
  isLegacyStartDateMirrorKey,
  shouldShowStartDateFieldInForm,
} from './product-start-date-fields';

describe('isLegacyStartDateMirrorKey', () => {
  it('covers only the two retired spellings', () => {
    for (const k of LEGACY_START_DATE_MIRROR_KEYS) expect(isLegacyStartDateMirrorKey(k)).toBe(true);
    expect(isLegacyStartDateMirrorKey(CANONICAL_START_DATE_KEY)).toBe(false);
    expect(isLegacyStartDateMirrorKey('current_year_start_date')).toBe(false);
    expect(isLegacyStartDateMirrorKey('sharing_effective_date')).toBe(false);
  });
});

describe('shouldShowStartDateFieldInForm', () => {
  it('never narrows the two keepers', () => {
    expect(shouldShowStartDateFieldInForm({ fieldKey: 'original_start_date', values: {} })).toBe(true);
    expect(shouldShowStartDateFieldInForm({ fieldKey: 'current_year_start_date', values: {} })).toBe(true);
  });

  it('hides the mirror on the 5,553 records where it agrees', () => {
    expect(
      shouldShowStartDateFieldInForm({
        fieldKey: 'start_date',
        values: { start_date: '2025-10-01', original_start_date: '2025-10-01' },
      }),
    ).toBe(false);
  });

  it('ignores format and time when comparing', () => {
    expect(
      shouldShowStartDateFieldInForm({
        fieldKey: 'start_date',
        values: { start_date: '2025-10-01T00:00:00Z', original_start_date: '2025-10-01' },
      }),
    ).toBe(false);
  });

  it('keeps the 11 disagreements visible', () => {
    // Real rows: hiding these would strand the older legacy value.
    const wendy = { start_date: '2018-01-01', original_start_date: '2022-01-01' };
    const merryl = { start_date: '2025-02-01', original_start_date: '2023-01-01' };
    expect(shouldShowStartDateFieldInForm({ fieldKey: 'start_date', values: wendy })).toBe(true);
    expect(shouldShowStartDateFieldInForm({ fieldKey: 'start_date', values: merryl })).toBe(true);
  });

  it('keeps the mirror when it is the only value present', () => {
    expect(
      shouldShowStartDateFieldInForm({ fieldKey: 'start_date', values: { start_date: '2019-06-01' } }),
    ).toBe(true);
  });

  it('hides an unset mirror', () => {
    expect(shouldShowStartDateFieldInForm({ fieldKey: 'start_date', values: {} })).toBe(false);
    expect(shouldShowStartDateFieldInForm({ fieldKey: 'start_date', values: { start_date: '' } })).toBe(false);
    expect(shouldShowStartDateFieldInForm({ fieldKey: 'start_date', values: null })).toBe(false);
  });

  it('retires insurance_effective_date on the same rule', () => {
    expect(
      shouldShowStartDateFieldInForm({
        fieldKey: 'insurance_effective_date',
        values: { insurance_effective_date: '2025-10-01', original_start_date: '2025-10-01' },
      }),
    ).toBe(false);
    expect(
      shouldShowStartDateFieldInForm({
        fieldKey: 'insurance_effective_date',
        values: { insurance_effective_date: '2024-03-01', original_start_date: '2025-10-01' },
      }),
    ).toBe(true);
  });

  it('resolves itself: once reconciled, the mirror disappears', () => {
    const before = { start_date: '2018-01-01', original_start_date: '2022-01-01' };
    expect(shouldShowStartDateFieldInForm({ fieldKey: 'start_date', values: before })).toBe(true);
    const after = { ...before, start_date: '2022-01-01' };
    expect(shouldShowStartDateFieldInForm({ fieldKey: 'start_date', values: after })).toBe(false);
  });
});
