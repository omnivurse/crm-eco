import { describe, expect, it } from 'vitest';
import { fieldOffersOptionChoices, labelForFieldOption } from './utils';

describe('fieldOffersOptionChoices', () => {
  it('is true for select/picklist/multiselect', () => {
    expect(fieldOffersOptionChoices({ type: 'select', options: [] })).toBe(true);
    expect(fieldOffersOptionChoices({ type: 'picklist', options: ['A'] })).toBe(true);
    expect(fieldOffersOptionChoices({ type: 'multiselect', options: [] })).toBe(true);
  });

  it('is true for text fields that carry curated options', () => {
    expect(
      fieldOffersOptionChoices({
        type: 'text',
        options: [{ value: 'a', label: 'A', is_active: true }],
      }),
    ).toBe(true);
  });

  it('is false for plain text without options', () => {
    expect(fieldOffersOptionChoices({ type: 'text', options: [] })).toBe(false);
    expect(fieldOffersOptionChoices({ type: 'text', options: undefined })).toBe(false);
  });
});

describe('labelForFieldOption', () => {
  it('resolves curated labels', () => {
    expect(
      labelForFieldOption(
        [{ value: '2_legacy', label: 'Legacy — Zoho', is_active: true }],
        '2_legacy',
      ),
    ).toBe('Legacy — Zoho');
  });

  it('falls back to the raw value', () => {
    expect(labelForFieldOption(['A', 'B'], 'C')).toBe('C');
  });
});
