import { describe, expect, it } from 'vitest';
import { planNegotiation } from './negotiate';
import type { CashRateRow } from './types';

function row(rate: number, cmsRate = 13077, lob = 'Commercial'): CashRateRow {
  return {
    id: rate,
    hospitalId: 1,
    facilityName: 'Rose',
    city: 'Denver',
    state: 'Colorado',
    msaName: 'Denver-Boulder-Greeley',
    procedureCode: '27447',
    codeDescription: 'TKA',
    category: 'Inpatient',
    codeType: 'CPT',
    rate,
    paymentMethod: 'facility only',
    carrier: 'Aetna',
    planName: 'Aetna',
    lob,
    product: 'PPO',
    cmsRelativity: rate / cmsRate,
    cmsRate,
    grossCharges: null,
    address: null,
    zip: null,
    phone: null,
    website: null,
    npi: null,
    latitude: null,
    longitude: null,
    hospitalType: null,
    healthsystemType: null,
    corporateEntity: null,
    additionalPayerNotes: null,
    methodology: null,
  };
}

describe('planNegotiation', () => {
  it('reads Medicare dollars from cmsRate and offers 20% above the lowest kept tick', () => {
    const plan = planNegotiation([row(11083), row(12732, 13077, 'Medicare'), row(15697)]);
    expect(plan.medicare).toBe(13077);
    expect(plan.lowestKept).toBe(11083);
    expect(plan.cashOffer).toBe(13300);
    expect(plan.medicareTicks).toBe(1);
  });
});
