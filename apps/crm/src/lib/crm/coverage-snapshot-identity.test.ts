import { describe, expect, it } from 'vitest';
import {
  filterHeroCarrierCandidatesByPlanType,
  filterHeroStartDateCandidatesByPlanType,
  isAmbiguousCarrierValue,
  isResolvableCarrierValue,
  selectHeroSharingField,
} from './coverage-snapshot-identity';

const SEDERA_UUID = 'b9c60010-7541-4e66-b3ba-1d3eb5a84781';

// Candidate order mirrors DynamicRecordForm.heroSharingField.
const candidates = [
  { key: 'sharing_entity' },
  { key: 'health_insurance_carrier' },
  { key: 'insurance_carrier' },
  { key: 'carrier' },
  { key: 'carrier_name' },
  { key: 'coverage_option' },
];

describe('isAmbiguousCarrierValue', () => {
  it('treats Other / blank / N/A as ambiguous', () => {
    expect(isAmbiguousCarrierValue('Other')).toBe(true);
    expect(isAmbiguousCarrierValue('  other ')).toBe(true);
    expect(isAmbiguousCarrierValue('')).toBe(true);
    expect(isAmbiguousCarrierValue(null)).toBe(true);
    expect(isAmbiguousCarrierValue('N/A')).toBe(true);
  });

  it('treats real names / UUIDs as non-ambiguous', () => {
    expect(isAmbiguousCarrierValue('Sedera')).toBe(false);
    expect(isAmbiguousCarrierValue(SEDERA_UUID)).toBe(false);
  });
});

describe('isResolvableCarrierValue', () => {
  it('resolves UUIDs and real names', () => {
    expect(isResolvableCarrierValue(SEDERA_UUID)).toBe(true);
    expect(isResolvableCarrierValue('Zion Health')).toBe(true);
  });

  it('does not resolve placeholders / blanks', () => {
    expect(isResolvableCarrierValue('Other')).toBe(false);
    expect(isResolvableCarrierValue('')).toBe(false);
    expect(isResolvableCarrierValue(undefined)).toBe(false);
  });
});

describe('selectHeroSharingField', () => {
  it('prefers a resolvable sharing_entity UUID over a legacy carrier "Other" (Patricia case)', () => {
    const field = selectHeroSharingField({
      candidates,
      values: {
        sharing_entity: SEDERA_UUID,
        carrier: 'Other',
      },
    });
    expect(field?.key).toBe('sharing_entity');
  });

  it('does not let an ambiguous carrier win even when it comes earlier and sharing_entity is a name', () => {
    const field = selectHeroSharingField({
      candidates: [{ key: 'carrier' }, { key: 'sharing_entity' }],
      values: { carrier: 'Other', sharing_entity: 'Sedera' },
    });
    expect(field?.key).toBe('sharing_entity');
  });

  it('falls back to an ambiguous value when nothing resolvable exists', () => {
    const field = selectHeroSharingField({
      candidates,
      values: { carrier: 'Other' },
    });
    expect(field?.key).toBe('carrier');
  });

  it('returns the first candidate when every value is blank (edit placeholder)', () => {
    const field = selectHeroSharingField({
      candidates,
      values: {},
    });
    expect(field?.key).toBe('sharing_entity');
  });

  it('keeps candidate priority among multiple resolvable values', () => {
    const field = selectHeroSharingField({
      candidates,
      values: {
        sharing_entity: SEDERA_UUID,
        health_insurance_carrier: 'Aetna',
      },
    });
    expect(field?.key).toBe('sharing_entity');
  });

  it('returns undefined for no candidates', () => {
    expect(selectHeroSharingField({ candidates: [], values: {} })).toBeUndefined();
  });
});

describe('filterHeroCarrierCandidatesByPlanType', () => {
  it('drops sharing_entity on insurance records so leftover ministry UUIDs cannot win', () => {
    const filtered = filterHeroCarrierCandidatesByPlanType(candidates, 'insurance');
    expect(filtered.map((c) => c.key)).not.toContain('sharing_entity');
    expect(filtered.map((c) => c.key)).toContain('health_insurance_carrier');
  });

  it('drops insurance carrier keys on healthshare records', () => {
    const filtered = filterHeroCarrierCandidatesByPlanType(candidates, 'healthshare');
    expect(filtered.map((c) => c.key)).not.toContain('health_insurance_carrier');
    expect(filtered.map((c) => c.key)).toContain('sharing_entity');
  });

  it('keeps the full list when type is unknown', () => {
    expect(filterHeroCarrierCandidatesByPlanType(candidates, 'unknown')).toEqual(candidates);
  });
});

describe('filterHeroStartDateCandidatesByPlanType', () => {
  const dates = [
    { key: 'sharing_effective_date' },
    { key: 'health_insurance_start_date' },
    { key: 'effective_date' },
  ];

  it('prefers insurance start dates on insurance records', () => {
    expect(filterHeroStartDateCandidatesByPlanType(dates, 'insurance').map((d) => d.key)).toEqual([
      'health_insurance_start_date',
      'effective_date',
    ]);
  });

  it('prefers sharing start dates on healthshare records', () => {
    expect(filterHeroStartDateCandidatesByPlanType(dates, 'healthshare').map((d) => d.key)).toEqual([
      'sharing_effective_date',
      'effective_date',
    ]);
  });
});
