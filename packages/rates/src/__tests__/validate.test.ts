import { describe, it, expect } from 'vitest';
import { validateRateConfig } from '../validate';
import type { RateConfig } from '../types';
import seedConfig from '../rate_tables.config.v2.json';

const validConfig = seedConfig as unknown as RateConfig;

describe('validateRateConfig', () => {
  it('passes for valid seed config', () => {
    const result = validateRateConfig(validConfig);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects null config', () => {
    const result = validateRateConfig(null as unknown as RateConfig);
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('NULL_CONFIG');
  });

  it('detects missing meta fields', () => {
    const bad = { ...validConfig, meta: {} as RateConfig['meta'] };
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_CURRENCY')).toBe(true);
    expect(result.errors.some((e) => e.code === 'MISSING_UPDATED_AT')).toBe(true);
  });

  it('detects missing rate sets', () => {
    const bad = { meta: validConfig.meta } as unknown as RateConfig;
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_RATE_SETS')).toBe(true);
  });

  it('detects duplicate planIds within a rate set', () => {
    const bad = structuredClone(validConfig);
    bad.rate_sets.current.plans.push({
      ...bad.rate_sets.current.plans[0],
    });
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_PLAN_ID')).toBe(true);
  });

  it('detects invalid rating model', () => {
    const bad = structuredClone(validConfig);
    (bad.rate_sets.current.plans[0] as any).rating_model = 'invalid_model';
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_RATING_MODEL')).toBe(true);
  });

  it('detects empty age bands', () => {
    const bad = structuredClone(validConfig);
    bad.rate_sets.current.plans[0].age_bands = [];
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_AGE_BANDS')).toBe(true);
  });

  it('detects invalid age band range (min > max)', () => {
    const bad = structuredClone(validConfig);
    bad.rate_sets.current.plans[0].age_bands[0] = {
      id: 'bad-range',
      min: 50,
      max: 20,
      label: 'Invalid',
    };
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_BAND_RANGE')).toBe(true);
  });

  it('detects missing standard coverage tier', () => {
    const bad = structuredClone(validConfig);
    bad.rate_sets.current.plans[0].coverage_tiers = ['member', 'member_spouse'] as any;
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_STANDARD_TIER')).toBe(true);
  });

  it('detects unknown band reference in tiered rates', () => {
    const bad = structuredClone(validConfig);
    const tieredPlan = bad.rate_sets.current.plans[0];
    (tieredPlan.rates as any).member['unknown-band'] = 999;
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'UNKNOWN_BAND_REF')).toBe(true);
  });

  it('detects negative rate in tiered rates', () => {
    const bad = structuredClone(validConfig);
    const tieredPlan = bad.rate_sets.current.plans[0];
    (tieredPlan.rates as any).member['18-29'] = -100;
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'NEGATIVE_RATE')).toBe(true);
  });

  it('detects missing subscriber rates for additive model', () => {
    const bad = structuredClone(validConfig);
    const additivePlan = bad.rate_sets.current.plans[1];
    delete (additivePlan.rates as any).subscriber;
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_SUBSCRIBER_RATES')).toBe(true);
  });

  it('detects negative fee amount', () => {
    const bad = structuredClone(validConfig);
    bad.rate_sets.current.plans[0].fees![0].amount = -10;
    const result = validateRateConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'NEGATIVE_FEE')).toBe(true);
  });
});
