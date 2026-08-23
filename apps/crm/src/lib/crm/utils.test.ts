import { describe, expect, it } from 'vitest';
import {
  CLINICAL_GENDER_OPTIONS,
  choicesWithCurrent,
  getFieldOptionChoices,
  getFieldOptions,
  isClinicalGenderFieldKey,
  optionsWithCurrent,
} from './utils';

/** The shape Dropdown lists writes to `crm_fields.options` (record_origin, live). */
const CURATED_RECORD_ORIGIN = [
  { label: 'Legacy — Zoho Leads', value: '1_legacy_zoho_leads' },
  { label: 'Legacy — Zoho', value: '2_legacy_zoho' },
  { label: 'CSV Import', value: '3_csv_import' },
  { label: 'Enrollment', value: '4_enrollment' },
  { label: 'Created in CRM', value: '5_native' },
];

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

  // PI-2: `options.map(String)` over the curated object shape produced five
  // identical "[object Object]" entries — five children with the same React
  // key, and five dropdown rows that all wrote "[object Object]" to the record.
  it('reads the curated object shape as values, never "[object Object]"', () => {
    expect(getFieldOptions(CURATED_RECORD_ORIGIN, 'record_origin')).toEqual([
      '1_legacy_zoho_leads',
      '2_legacy_zoho',
      '3_csv_import',
      '4_enrollment',
      '5_native',
    ]);
    expect(getFieldOptions(JSON.stringify(CURATED_RECORD_ORIGIN), 'record_origin')).toEqual([
      '1_legacy_zoho_leads',
      '2_legacy_zoho',
      '3_csv_import',
      '4_enrollment',
      '5_native',
    ]);
  });

  it('coerces bare scalars the way it always did', () => {
    expect(getFieldOptions([1, 2, 3], 'plan_tier')).toEqual(['1', '2', '3']);
  });
});

describe('getFieldOptionChoices', () => {
  it('keeps the label next to the stored value', () => {
    expect(getFieldOptionChoices(CURATED_RECORD_ORIGIN, 'record_origin')).toEqual([
      { value: '1_legacy_zoho_leads', label: 'Legacy — Zoho Leads' },
      { value: '2_legacy_zoho', label: 'Legacy — Zoho' },
      { value: '3_csv_import', label: 'CSV Import' },
      { value: '4_enrollment', label: 'Enrollment' },
      { value: '5_native', label: 'Created in CRM' },
    ]);
  });

  it('reads a legacy plain-string list as value === label', () => {
    expect(getFieldOptionChoices(['Bronze', 'Silver'], 'plan')).toEqual([
      { value: 'Bronze', label: 'Bronze' },
      { value: 'Silver', label: 'Silver' },
    ]);
  });

  // The uniqueness this defect is about: whatever the stored shape, no two
  // offered choices may share a value — that value is the React key AND the
  // thing the picker writes to the record.
  it.each([
    ['curated objects', CURATED_RECORD_ORIGIN],
    ['a legacy list holding one spelling twice', ['Silver PPO', 'Bronze', 'Silver PPO']],
    ['a comma-separated string', 'Bronze, Silver, Bronze'],
    ['a mixed list', [{ value: 'a', label: 'A' }, 'a', 'b']],
  ])('offers unique values for %s', (_label, options) => {
    const values = getFieldOptionChoices(options, 'plan').map((o) => o.value);
    expect(values).toEqual([...new Set(values)]);
    expect(values).not.toContain('[object Object]');
    expect(values.every((v) => v.trim() !== '')).toBe(true);
  });

  it('stops offering options that were curated away, without deleting them', () => {
    expect(
      getFieldOptionChoices(
        [
          { value: 'Secure', label: 'Secure', is_active: true },
          { value: 'Retired Plan', label: 'Retired Plan', is_active: false },
        ],
        'plan',
      ),
    ).toEqual([{ value: 'Secure', label: 'Secure' }]);
  });

  it('still forces Male/Female for gender field keys', () => {
    expect(getFieldOptionChoices([{ value: 'Other', label: 'Other' }], 'spouse_gender')).toEqual([
      { value: 'Male', label: 'Male' },
      { value: 'Female', label: 'Female' },
    ]);
  });

  it('returns an empty list for shapes that offer nothing', () => {
    expect(getFieldOptionChoices(undefined, 'plan')).toEqual([]);
    expect(getFieldOptionChoices(null, 'plan')).toEqual([]);
    expect(getFieldOptionChoices({}, 'plan')).toEqual([]);
    expect(getFieldOptionChoices('', 'plan')).toEqual([]);
  });
});

describe('choicesWithCurrent', () => {
  it('prepends a stored value that the curated list no longer offers', () => {
    expect(
      choicesWithCurrent(getFieldOptionChoices(CURATED_RECORD_ORIGIN), 'legacy_unknown'),
    ).toEqual([
      { value: 'legacy_unknown', label: 'legacy_unknown' },
      { value: '1_legacy_zoho_leads', label: 'Legacy — Zoho Leads' },
      { value: '2_legacy_zoho', label: 'Legacy — Zoho' },
      { value: '3_csv_import', label: 'CSV Import' },
      { value: '4_enrollment', label: 'Enrollment' },
      { value: '5_native', label: 'Created in CRM' },
    ]);
  });

  it('matches on the value, not the label, so a listed code adds nothing', () => {
    const choices = getFieldOptionChoices(CURATED_RECORD_ORIGIN);
    expect(choicesWithCurrent(choices, '2_legacy_zoho')).toEqual(choices);
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
