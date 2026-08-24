import { describe, expect, it } from 'vitest';
import { classifyPayer, describePayer, uniquePayers } from './payer';

describe('classifyPayer', () => {
  it('reads LOB first for cash, medicare, medicaid, commercial', () => {
    expect(classifyPayer({ carrier: 'Self Pay', lob: 'Self Pay', planName: 'Self Pay' })).toBe('cash');
    expect(classifyPayer({ carrier: 'Cigna', lob: 'Medicare', planName: 'Cigna HealthSpring-Medicare' })).toBe(
      'medicare',
    );
    expect(classifyPayer({ carrier: 'United', lob: 'Medicaid', planName: 'United-MCR' })).toBe('medicaid');
    expect(classifyPayer({ carrier: 'Aetna', lob: 'Commercial', planName: 'Aetna-NewBusiness' })).toBe(
      'commercial',
    );
    expect(classifyPayer({ carrier: 'Workers Comp', lob: 'Commercial', planName: 'Pinnacol Workers Comp' })).toBe(
      'workers_comp',
    );
  });
});

describe('describePayer', () => {
  it('names the carrier and LOB, and ignores facility-only method', () => {
    expect(
      describePayer({
        carrier: 'Anthem',
        lob: 'Medicare',
        planName: 'Anthem BCBS-MCR',
        paymentMethod: 'facility only',
        product: 'PPO',
      }),
    ).toBe('Anthem · Medicare');
    expect(
      describePayer({
        carrier: null,
        lob: null,
        planName: null,
        paymentMethod: 'facility only',
        product: null,
      }),
    ).toBe('Unnamed payer');
  });
});

describe('uniquePayers', () => {
  it('dedupes carriers', () => {
    expect(
      uniquePayers([
        { carrier: 'Aetna', lob: 'Commercial', planName: 'A' },
        { carrier: 'Aetna', lob: 'Medicare', planName: 'B' },
        { carrier: 'Cigna', lob: 'Medicare', planName: 'C' },
      ]),
    ).toEqual(['Aetna', 'Cigna']);
  });
});
