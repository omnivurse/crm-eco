/**
 * Characterization tests for Rx pricing helpers (pure / deterministic path).
 *
 * The Gemini client is mocked so these tests are hermetic (no env dependency,
 * no network) and always exercise the deterministic mock-pricing fallback.
 */
import { describe, it, expect, vi } from 'vitest';

// Force the deterministic fallback regardless of GEMINI_API_KEY in the env.
vi.mock('../../ai/geminiClient', () => ({
  isGeminiConfigured: () => false,
  callGeminiForRxPricing: vi.fn(async () => null),
}));

import { getRxPricingEstimate, validateMedications } from '../rxPricing';

describe('validateMedications', () => {
  it('returns null for a fully-specified medication', () => {
    expect(
      validateMedications([{ name: 'Metformin', dosage: '500mg', frequency: '1x/day' }])
    ).toBeNull();
  });

  it('requires name, dosage, frequency (in that order) with 1-based index', () => {
    expect(validateMedications([{ name: '', dosage: '500mg', frequency: '1x/day' }])).toBe(
      'Medication 1: Name is required'
    );
    expect(validateMedications([{ name: 'A', dosage: '', frequency: '1x/day' }])).toBe(
      'Medication 1: Dosage is required'
    );
    expect(validateMedications([{ name: 'A', dosage: '1mg', frequency: '' }])).toBe(
      'Medication 1: Frequency is required'
    );
  });

  it('rejects negative current monthly cost', () => {
    expect(
      validateMedications([{ name: 'A', dosage: '1mg', frequency: '1x', currentMonthlyCost: -5 }])
    ).toBe('Medication 1: Monthly cost cannot be negative');
  });

  it('reports the index of the offending item', () => {
    expect(
      validateMedications([
        { name: 'A', dosage: '1mg', frequency: '1x' },
        { name: '', dosage: '1mg', frequency: '1x' },
      ])
    ).toBe('Medication 2: Name is required');
  });
});

describe('getRxPricingEstimate (mock fallback)', () => {
  it('returns an empty result for no medications', async () => {
    const result = await getRxPricingEstimate({ meds: [] });
    expect(result.options).toEqual([]);
    expect(result.summary).toBe('No medications provided for pricing.');
    expect(typeof result.generatedAt).toBe('string');
  });

  it('applies a 20% discount to the current cost and marks source=mock', async () => {
    const result = await getRxPricingEstimate({
      meds: [{ name: 'Metformin', dosage: '500mg', frequency: '1x/day', currentMonthlyCost: 100 }],
    });
    expect(result.options).toHaveLength(1);
    expect(result.options[0]).toMatchObject({
      medicationName: 'Metformin',
      pharmacy: 'Generic Pharmacy',
      estimatedMonthlyCost: 80,
      source: 'mock',
    });
    expect(result.summary).toContain('1 medication');
    expect(result.summary).toContain('Potential monthly savings: ~$20.00');
    expect(result.summary).toContain('Mock estimates');
  });

  it('floors the estimate at $5', async () => {
    const result = await getRxPricingEstimate({
      meds: [{ name: 'Cheapo', dosage: '1mg', frequency: '1x/day', currentMonthlyCost: 5 }],
    });
    expect(result.options[0].estimatedMonthlyCost).toBe(5);
    // savings of $0 → no savings line
    expect(result.summary).not.toContain('Potential monthly savings');
  });

  it('defaults base cost to 100 when currentMonthlyCost is absent', async () => {
    const result = await getRxPricingEstimate({
      meds: [{ name: 'NoCost', dosage: '1mg', frequency: '1x/day' }],
    });
    expect(result.options[0].estimatedMonthlyCost).toBe(80);
    expect(result.options[0].notes).toContain('typical pricing');
  });

  it('passes through a preferred pharmacy and pluralizes the summary', async () => {
    const result = await getRxPricingEstimate({
      meds: [
        { name: 'A', dosage: '1mg', frequency: '1x/day', preferredPharmacy: 'Costco' },
        { name: 'B', dosage: '2mg', frequency: '1x/day' },
      ],
    });
    expect(result.options[0].pharmacy).toBe('Costco');
    expect(result.summary).toContain('2 medications');
    expect(result.options.every((o) => o.source === 'mock')).toBe(true);
  });
});
