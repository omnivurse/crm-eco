import { describe, expect, it } from 'vitest';
import {
  CLINICAL_GENDER_OPTIONS,
  getFieldOptions,
  isClinicalGenderFieldKey,
} from './utils';

describe('getFieldOptions', () => {
  it('parses arrays and JSON strings', () => {
    expect(getFieldOptions(['a', 'b'])).toEqual(['a', 'b']);
    expect(getFieldOptions('["a","b"]')).toEqual(['a', 'b']);
    expect(getFieldOptions('a, b, c')).toEqual(['a', 'b', 'c']);
    expect(getFieldOptions(undefined)).toEqual([]);
  });

  it('extracts stored values from labelled database options', () => {
    const options = [
      { label: 'Legacy — Zoho', value: '2_legacy_zoho' },
      { label: 'Enrollment', value: '4_enrollment' },
    ];

    expect(getFieldOptions(options, 'record_origin')).toEqual([
      '2_legacy_zoho',
      '4_enrollment',
    ]);
    expect(getFieldOptions(JSON.stringify(options), 'record_origin')).toEqual([
      '2_legacy_zoho',
      '4_enrollment',
    ]);
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
