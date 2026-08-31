import { describe, expect, it } from 'vitest';
import { discardedStorageKey, readDiscardedIds, serializeDiscardedIds } from './discard';
import { flagHighExtremes, flagRateOutliers, mergeHidden, tickIdentity } from './outliers';
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

  it('does not auto-hide a 3.8× Medicare tick that still warps HIGH', () => {
    const high = row({ id: 9, rate: 1625, cmsRelativity: 3.79, cmsRate: 429 });
    expect(flagRateOutliers([high]).has(tickIdentity(high))).toBe(false);
  });
});

describe('flagHighExtremes', () => {
  it('flags the $1,625 tick on a $385-ish CPT 11300 tape', () => {
    const cluster = Array.from({ length: 41 }, (_, i) =>
      row({ id: i + 1, rate: 180 + (i % 12) * 35, cmsRelativity: 0.8, cmsRate: 429 }),
    );
    const high = row({
      id: 99,
      rate: 1625,
      cmsRelativity: 3.79,
      cmsRate: 429,
      facilityName: 'Children’s Hospital Colorado',
    });
    const flagged = flagHighExtremes([...cluster, high]);
    expect(flagged.has(tickIdentity(high))).toBe(true);
    expect(flagged.has(tickIdentity(cluster[0]))).toBe(false);
  });

  it('stays quiet on a thin slice', () => {
    const rows = [
      row({ id: 1, rate: 200 }),
      row({ id: 2, rate: 220 }),
      row({ id: 3, rate: 900 }),
    ];
    expect(flagHighExtremes(rows).size).toBe(0);
  });
});

describe('discard persistence', () => {
  it('round-trips ids and unions with the auto fence', () => {
    const id = '1|Rose|11300|Aetna|';
    const raw = serializeDiscardedIds(new Set([id]));
    expect(readDiscardedIds(raw).has(id)).toBe(true);
    expect(mergeHidden(new Set(['auto']), readDiscardedIds(raw)).has(id)).toBe(true);
    expect(discardedStorageKey('11300', 'Denver-Boulder-Greeley')).toContain('11300');
  });
});
