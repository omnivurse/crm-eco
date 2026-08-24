import { describe, expect, it } from 'vitest';
import { flagRateOutliers, tickIdentity } from './outliers';
import type { CashRateRow } from './types';

function row(partial: Partial<CashRateRow> & Pick<CashRateRow, 'id' | 'rate'>): CashRateRow {
  return {
    hospitalId: 1,
    facilityName: 'Rose Medical Center',
    city: 'Denver',
    state: 'Colorado',
    msaName: 'Denver-Boulder-Greeley',
    procedureCode: '27447',
    codeDescription: 'TKA',
    category: 'Inpatient',
    codeType: 'CPT',
    paymentMethod: 'facility only',
    carrier: 'Aetna',
    planName: 'Aetna',
    lob: 'Commercial',
    product: 'PPO',
    cmsRelativity: 1,
    cmsRate: 13077,
    grossCharges: 711,
    address: null,
    zip: '80020',
    phone: null,
    website: null,
    npi: null,
    latitude: 39.73,
    longitude: -104.98,
    hospitalType: 'Acute Care Hospitals',
    healthsystemType: null,
    corporateEntity: null,
    additionalPayerNotes: null,
    methodology: null,
    ...partial,
  };
}

describe('flagRateOutliers', () => {
  it('hides the 0.14× CMS self-pay fragment and keeps the $11–20k band', () => {
    const junk = row({ id: 1, rate: 1759, cmsRelativity: 0.14, carrier: 'Self Pay', lob: 'Self Pay' });
    const aetna = row({ id: 2, rate: 11083, cmsRelativity: 0.88 });
    const workers = row({
      id: 3,
      rate: 20337,
      cmsRelativity: 1.61,
      carrier: 'Workers Comp',
      lob: 'Commercial',
    });
    const flagged = flagRateOutliers([junk, aetna, workers]);
    expect(flagged.has(tickIdentity(junk))).toBe(true);
    expect(flagged.has(tickIdentity(aetna))).toBe(false);
    expect(flagged.has(tickIdentity(workers))).toBe(false);
  });
});
