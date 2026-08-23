import { describe, expect, it } from 'vitest';
import {
  CLINICAL_GENDER_OPTIONS,
  getFieldOptions,
  isClinicalGenderFieldKey,
  optionsWithCurrent,
} from './utils';

describe('getFieldOptions', () => {
  it('parses arrays and JSON strings', () => {
    expect(getFieldOptions(['a', 'b'])).toEqual(['a', 'b']);
    expect(getFieldOptions('["a","b"]')).toEqual(['a', 'b']);
    expect(getFieldOptions('a, b, c')).toEqual(['a', 'b', 'c']);
    expect(getFieldOptions(undefined)).toEqual([]);
  });

  it('forces Male/Female for gender field keys even when options are wider', () => {
    expect(
      getFieldOptions(['Male', 'Female', 'Other', 'Prefer not to say'], 'gender'),
    ).toEqual([...CLINICAL_GENDER_OPTIONS]);
    expect(
      getFieldOptions('["Male","Female","Other"]', 'primary_member_gender'),
    ).toEqual([...CLINICAL_GENDER_OPTIONS]);
  });

  it('does not filter non-gender fields', () => {
    expect(getFieldOptions(['Hot', 'Warm', 'Cold'], 'lead_status')).toEqual([
      'Hot',
      'Warm',
      'Cold',
    ]);
  });
});

describe('isClinicalGenderFieldKey', () => {
  it('matches gender keys', () => {
    expect(isClinicalGenderFieldKey('gender')).toBe(true);
    expect(isClinicalGenderFieldKey('primary_member_gender')).toBe(true);
    expect(isClinicalGenderFieldKey('spouse_gender')).toBe(true);
    expect(isClinicalGenderFieldKey('lead_status')).toBe(false);
  });
});

describe('optionsWithCurrent', () => {
  it('prepends a stored value that is not in the list so a closed Select can display it', () => {
    expect(optionsWithCurrent(['Secure', 'Care Plus'], 'Sedera Access+ (legacy)')).toEqual([
      { value: 'Sedera Access+ (legacy)', label: 'Sedera Access+ (legacy)' },
      { value: 'Secure', label: 'Secure' },
      { value: 'Care Plus', label: 'Care Plus' },
    ]);
  });

  it('adds nothing for a listed, blank or missing current value', () => {
    const base = [
      { value: 'Secure', label: 'Secure' },
      { value: 'Care Plus', label: 'Care Plus' },
    ];
    expect(optionsWithCurrent(['Secure', 'Care Plus'], 'Secure')).toEqual(base);
    expect(optionsWithCurrent(['Secure', 'Care Plus'], '')).toEqual(base);
    expect(optionsWithCurrent(['Secure', 'Care Plus'], '   ')).toEqual(base);
    expect(optionsWithCurrent(['Secure', 'Care Plus'], null)).toEqual(base);
    expect(optionsWithCurrent(['Secure', 'Care Plus'], undefined)).toEqual(base);
    expect(optionsWithCurrent([], 'Only')).toEqual([{ value: 'Only', label: 'Only' }]);
  });
});
