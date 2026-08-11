import { describe, it, expect } from 'vitest';
import { isKnownInsuranceCarrier, isKnownSharingEntity } from '@/lib/crm/coverage-carriers';

// Values taken verbatim from live PIF-ECO-V2 data->>'carrier' with record counts.
const INSURERS: [string, number][] = [
  ['Cigna', 185], ['Coventry', 111], ['Anthem', 91], ['Humana', 86], ['BC/BS', 76],
  ['United Healthcare', 54], ['Kaiser', 50], ['BCBSFL', 18], ['Molina', 15],
  ['Ambetter', 15], ['Bright Health', 15], ['Anthem BCBS - Georgia', 14],
  ['CO Health OP', 12], ['Aetna', 10],
];
const MINISTRIES: [string, number][] = [
  ['Zion Health', 6439], ['Sedera HealthShare', 2383], ['Liberty HealthShare', 1421],
  ['ARM/MPB', 108], ['MPowering Benefits (Essentials)', 62], ['MPB', 58],
];

describe('carrier classification against live PIFH values', () => {
  it.each(INSURERS)('classifies %s (%i records) as insurance', (name) => {
    expect(isKnownInsuranceCarrier(name)).toBe(true);
    expect(isKnownSharingEntity(name)).toBe(false);
  });
  it.each(MINISTRIES)('classifies %s (%i records) as health sharing', (name) => {
    expect(isKnownSharingEntity(name)).toBe(true);
    expect(isKnownInsuranceCarrier(name)).toBe(false);
  });
  it('leaves genuinely ambiguous values unclassified', () => {
    for (const v of ['Other', 'To Be Determined', '', null, undefined]) {
      expect(isKnownInsuranceCarrier(v)).toBe(false);
      expect(isKnownSharingEntity(v)).toBe(false);
    }
  });
});
