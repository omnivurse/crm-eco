import { describe, it, expect } from 'vitest';
import { quote, getPlanOptions, buildMatrixPreview, findAgeBand, resolveRateSetKey } from '../rateEngine';
import type { RateConfig, QuoteInput } from '../types';
import seedConfig from '../rate_tables.config.v2.json';

const config = seedConfig as unknown as RateConfig;

// ──────────────────────────────────────────────
// Band Selection
// ──────────────────────────────────────────────

describe('findAgeBand', () => {
  const bands = config.rate_sets.current.plans[0].age_bands;

  it('finds band at exact min boundary', () => {
    const band = findAgeBand(bands, 18);
    expect(band?.id).toBe('18-29');
  });

  it('finds band at exact max boundary', () => {
    const band = findAgeBand(bands, 29);
    expect(band?.id).toBe('18-29');
  });

  it('finds middle-of-range band', () => {
    const band = findAgeBand(bands, 45);
    expect(band?.id).toBe('40-49');
  });

  it('returns undefined for age below minimum', () => {
    const band = findAgeBand(bands, 10);
    expect(band).toBeUndefined();
  });

  it('returns undefined for age above maximum', () => {
    const band = findAgeBand(bands, 70);
    expect(band).toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// Rate Set Resolution
// ──────────────────────────────────────────────

describe('resolveRateSetKey', () => {
  it('returns current for dates before 2026', () => {
    expect(resolveRateSetKey(config, '2025-06-15')).toBe('current');
  });

  it('returns rates_2026 for dates on or after 2026-01-01', () => {
    expect(resolveRateSetKey(config, '2026-01-01')).toBe('rates_2026');
    expect(resolveRateSetKey(config, '2026-07-15')).toBe('rates_2026');
  });

  it('respects override regardless of date', () => {
    expect(resolveRateSetKey(config, '2025-06-15', 'rates_2026')).toBe('rates_2026');
    expect(resolveRateSetKey(config, '2026-06-15', 'current')).toBe('current');
  });
});

// ──────────────────────────────────────────────
// Tiered Household Quoting
// ──────────────────────────────────────────────

describe('quote — tiered_household', () => {
  const baseInput: QuoteInput = {
    planId: 'pif-essential',
    coverageTier: 'member',
    household: { memberAge: 35 },
    coverageStart: '2025-06-01',
  };

  it('calculates member-only rate correctly', () => {
    const result = quote(config, baseInput);
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(275);
    expect(result.metadata.rateSetUsed).toBe('current');
    expect(result.metadata.bandsUsed.memberBand).toBe('30-39');
  });

  it('calculates member_spouse rate', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'member_spouse',
      household: { memberAge: 35, spouseAge: 33 },
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(525);
  });

  it('calculates member_children rate', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'member_children',
      household: { memberAge: 42, dependentAges: [10] },
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(475);
  });

  it('calculates family rate', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'family',
      household: { memberAge: 55, spouseAge: 53, dependentAges: [18, 20] },
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(1025);
  });

  it('includes monthly fees in totalMonthly', () => {
    const result = quote(config, baseInput);
    expect(result.monthlyFees.length).toBeGreaterThan(0);
    const adminFee = result.monthlyFees.find((f) => f.id === 'admin-fee');
    expect(adminFee?.amount).toBe(25);
    expect(result.totalMonthly).toBe(275 + 25);
  });

  it('includes one-time enrollment fee', () => {
    const result = quote(config, baseInput);
    const enrollFee = result.oneTimeFees.find((f) => f.id === 'enrollment-fee');
    expect(enrollFee?.amount).toBe(150);
  });

  it('uses rates_2026 for future start date', () => {
    const result = quote(config, {
      ...baseInput,
      coverageStart: '2026-03-01',
    });
    expect(result.metadata.rateSetUsed).toBe('rates_2026');
    expect(result.monthlyPremium).toBe(295);
  });

  it('uses override rate set', () => {
    const result = quote(config, baseInput, { rateSetOverride: 'rates_2026' });
    expect(result.metadata.rateSetUsed).toBe('rates_2026');
    expect(result.monthlyPremium).toBe(295);
  });
});

// ──────────────────────────────────────────────
// Additive Person Quoting
// ──────────────────────────────────────────────

describe('quote — additive_person (banded)', () => {
  const baseInput: QuoteInput = {
    planId: 'pif-premier',
    coverageTier: 'member',
    household: { memberAge: 35 },
    coverageStart: '2025-06-01',
  };

  it('calculates subscriber-only rate', () => {
    const result = quote(config, baseInput);
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(375);
    expect(result.metadata.ratingModel).toBe('additive_person');
  });

  it('calculates member_spouse = subscriber + spouse_adder', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'member_spouse',
      household: { memberAge: 35, spouseAge: 32 },
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(375 + 230);
    expect(result.breakdown).toHaveLength(2);
  });

  it('calculates member_children = subscriber + dependent_adder(s)', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'member_children',
      household: { memberAge: 35, dependentAges: [19, 22] },
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(375 + 125 + 125);
  });

  it('calculates family = subscriber + spouse + dependents', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'family',
      household: { memberAge: 45, spouseAge: 43, dependentAges: [18, 20] },
    });
    expect(result.errors).toBeUndefined();
    // subscriber(40-49) = 460, spouse(40-49) = 285, dep1(18-29) = 125, dep2(18-29) = 125
    expect(result.monthlyPremium).toBe(460 + 285 + 125 + 125);
    expect(result.breakdown).toHaveLength(4);
  });

  it('caps dependents at max_dependents_priced', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'member_children',
      household: { memberAge: 35, dependentAges: [18, 20, 22, 24, 26] },
    });
    expect(result.errors).toBeUndefined();
    // max_dependents_priced = 3, so only 3 dependents priced
    expect(result.monthlyPremium).toBe(375 + 125 * 3);
  });
});

describe('quote — additive_person (flat adders)', () => {
  const baseInput: QuoteInput = {
    planId: 'pif-value',
    coverageTier: 'member',
    household: { memberAge: 25 },
    coverageStart: '2025-06-01',
  };

  it('calculates subscriber-only rate', () => {
    const result = quote(config, baseInput);
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(185);
  });

  it('uses flat spouse adder', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'member_spouse',
      household: { memberAge: 25, spouseAge: 24 },
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(185 + 150);
  });

  it('uses flat dependent adder', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'member_children',
      household: { memberAge: 25, dependentAges: [5, 7] },
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(185 + 85 * 2);
  });

  it('caps flat dependents at max_dependents_priced=4', () => {
    const result = quote(config, {
      ...baseInput,
      coverageTier: 'member_children',
      household: { memberAge: 25, dependentAges: [1, 2, 3, 4, 5, 6] },
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(185 + 85 * 4);
  });
});

// ──────────────────────────────────────────────
// Tobacco Factor
// ──────────────────────────────────────────────

describe('quote — tobacco surcharge', () => {
  it('applies member tobacco surcharge to tiered_household', () => {
    const result = quote(config, {
      planId: 'pif-essential',
      coverageTier: 'member',
      household: { memberAge: 35 },
      tobacco: { member: true },
      coverageStart: '2025-06-01',
    });
    expect(result.errors).toBeUndefined();
    // 275 base + 15% surcharge = 275 + 41.25 = 316.25
    expect(result.monthlyPremium).toBe(316.25);
  });

  it('applies member tobacco surcharge to additive_person', () => {
    const result = quote(config, {
      planId: 'pif-premier',
      coverageTier: 'member',
      household: { memberAge: 35 },
      tobacco: { member: true },
      coverageStart: '2025-06-01',
    });
    expect(result.errors).toBeUndefined();
    // 375 + 20% = 375 + 75 = 450
    expect(result.monthlyPremium).toBe(450);
  });

  it('applies spouse tobacco surcharge', () => {
    const result = quote(config, {
      planId: 'pif-premier',
      coverageTier: 'member_spouse',
      household: { memberAge: 35, spouseAge: 32 },
      tobacco: { spouse: true },
      coverageStart: '2025-06-01',
    });
    expect(result.errors).toBeUndefined();
    // subscriber 375 + spouse_adder 230 + spouse_tobacco 230*0.2 = 605 + 46 = 651
    expect(result.monthlyPremium).toBe(651);
  });
});

// ──────────────────────────────────────────────
// Error Cases
// ──────────────────────────────────────────────

describe('quote — structured errors', () => {
  it('returns error for unknown plan', () => {
    const result = quote(config, {
      planId: 'nonexistent',
      coverageTier: 'member',
      household: { memberAge: 35 },
      coverageStart: '2025-06-01',
    });
    expect(result.errors).toBeDefined();
    expect(result.errors![0].code).toBe('PLAN_NOT_FOUND');
    expect(result.monthlyPremium).toBe(0);
  });

  it('returns error for missing spouse age on member_spouse', () => {
    const result = quote(config, {
      planId: 'pif-essential',
      coverageTier: 'member_spouse',
      household: { memberAge: 35 },
      coverageStart: '2025-06-01',
    });
    expect(result.errors).toBeDefined();
    expect(result.errors![0].code).toBe('MISSING_SPOUSE_AGE');
  });

  it('returns error for missing dependents on member_children', () => {
    const result = quote(config, {
      planId: 'pif-essential',
      coverageTier: 'member_children',
      household: { memberAge: 35 },
      coverageStart: '2025-06-01',
    });
    expect(result.errors).toBeDefined();
    expect(result.errors![0].code).toBe('MISSING_DEPENDENTS');
  });

  it('returns error for age out of range', () => {
    const result = quote(config, {
      planId: 'pif-essential',
      coverageTier: 'member',
      household: { memberAge: 10 },
      coverageStart: '2025-06-01',
    });
    expect(result.errors).toBeDefined();
    expect(result.errors![0].code).toBe('NO_AGE_BAND');
  });
});

// ──────────────────────────────────────────────
// getPlanOptions
// ──────────────────────────────────────────────

describe('getPlanOptions', () => {
  it('returns all plans from current set', () => {
    const options = getPlanOptions(config, 'current');
    expect(options).toHaveLength(3);
    expect(options[0].planId).toBe('pif-essential');
    expect(options[0].ratingModel).toBe('tiered_household');
    expect(options[1].planId).toBe('pif-premier');
    expect(options[1].ratingModel).toBe('additive_person');
  });
});

// ──────────────────────────────────────────────
// buildMatrixPreview
// ──────────────────────────────────────────────

describe('buildMatrixPreview', () => {
  it('builds tiered_household matrix directly', () => {
    const preview = buildMatrixPreview(config, 'pif-essential', 'current');
    expect(preview).not.toBeNull();
    expect(preview!.ratingModel).toBe('tiered_household');
    expect(preview!.matrix.member['30-39']).toBe(275);
    expect(preview!.matrix.family['50-59']).toBe(1025);
    expect(preview!.footnotes).toBeUndefined();
  });

  it('builds additive_person derived matrix with footnotes', () => {
    const preview = buildMatrixPreview(config, 'pif-premier', 'current');
    expect(preview).not.toBeNull();
    expect(preview!.ratingModel).toBe('additive_person');
    // member = subscriber only
    expect(preview!.matrix.member['30-39']).toBe(375);
    // member_spouse = subscriber + spouse_adder
    expect(preview!.matrix.member_spouse['30-39']).toBe(375 + 230);
    expect(preview!.footnotes).toBeDefined();
    expect(preview!.footnotes!.length).toBeGreaterThan(0);
  });

  it('returns null for unknown plan', () => {
    const preview = buildMatrixPreview(config, 'nonexistent');
    expect(preview).toBeNull();
  });
});
