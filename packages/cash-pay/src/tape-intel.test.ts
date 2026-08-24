import { describe, expect, it } from 'vitest';
import {
  describeFacilityLine,
  facilitySpread,
  listDiscount,
  medianListDiscount,
  mixEntries,
  payerMix,
  websiteHref,
} from './tape-intel';

describe('payerMix', () => {
  it('counts classified LOBs and drops empty classes from the meter', () => {
    const mix = payerMix([
      { carrier: 'Anthem', lob: 'Medicare', planName: 'MCR' },
      { carrier: 'Aetna', lob: 'Commercial', planName: 'PPO' },
      { carrier: 'Aetna', lob: 'Commercial', planName: 'HMO' },
      { carrier: 'Self Pay', lob: 'Self Pay', planName: 'Self Pay' },
    ]);
    expect(mix.medicare).toBe(1);
    expect(mix.commercial).toBe(2);
    expect(mix.cash).toBe(1);
    expect(mixEntries(mix).map((e) => e.id)).toEqual(['medicare', 'commercial', 'cash']);
  });
});

describe('listDiscount', () => {
  it('is the cut from chargemaster, and ignores ticks above list', () => {
    expect(listDiscount({ rate: 11000, grossCharges: 20000 })).toBeCloseTo(0.45);
    expect(listDiscount({ rate: 25000, grossCharges: 20000 })).toBeNull();
    expect(listDiscount({ rate: 11000, grossCharges: null })).toBeNull();
    expect(medianListDiscount([
      { rate: 100, grossCharges: 200 },
      { rate: 150, grossCharges: 200 },
    ])).toBeCloseTo(0.375);
  });
});

describe('facility dossier helpers', () => {
  it('joins identity without inventing a system, and normalizes websites', () => {
    expect(
      describeFacilityLine({
        city: 'Denver',
        state: 'Colorado',
        hospitalType: 'Acute Care Hospitals',
        healthsystemType: 'HCA',
        corporateEntity: null,
        msaName: 'Denver-Boulder-Greeley',
      }),
    ).toBe('Denver, Colorado · Acute Care Hospitals · HCA');
    expect(websiteHref('rosehealth.com')).toBe('https://rosehealth.com');
    expect(websiteHref('https://rosehealth.com')).toBe('https://rosehealth.com');
    expect(websiteHref(null)).toBeNull();
  });

  it('spreads published dollars and named payers at one facility', () => {
    const spread = facilitySpread([
      { rate: 11083, carrier: 'Aetna', planName: 'PPO' },
      { rate: 15697, carrier: 'Anthem', planName: 'MCR' },
      { rate: 15697, carrier: 'Anthem', planName: 'MCR ADV' },
    ]);
    expect(spread).toEqual({ low: 11083, high: 15697, payerCount: 2, tickCount: 3 });
  });
});
