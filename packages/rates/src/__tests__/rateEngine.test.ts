import { describe, it, expect } from 'vitest';
import {
  quote,
  getPlanOptions,
  buildMatrixPreview,
  findAgeBand,
  resolveRateSetKey,
  resolveRatingAge,
} from '../rateEngine';
import { resolveEnrollmentContribution } from '../enrollmentContribution';
import type { RateConfig, QuoteInput, Plan } from '../types';
import seedConfig from '../rate_tables.config.v2.json';

const config = seedConfig as unknown as RateConfig;

/** Minimal additive fixture — kept local so seed can be MSA-only */
const additiveConfig: RateConfig = {
  meta: { currency: 'USD', updated_at: '2026-08-01T00:00:00Z' },
  rate_sets: {
    current: {
      label: 'Additive Fixture',
      effective_date: '2025-01-01',
      plans: [
        {
          planId: 'demo-additive',
          displayName: 'Demo Additive',
          rating_model: 'additive_person',
          age_bands: [
            { id: '18-34', min: 18, max: 34, label: '18–34' },
            { id: '35-49', min: 35, max: 49, label: '35–49' },
          ],
          coverage_tiers: ['member', 'member_spouse', 'member_children', 'family'],
          tobacco: { enabled: false },
          rates: {
            subscriber: { '18-34': 200, '35-49': 300 },
            spouse_adder: { '18-34': 100, '35-49': 150 },
            dependent_adder: { flat: 50 },
            max_dependents_priced: 2,
          },
        } as Plan,
      ],
    },
    rates_2026: { label: 'empty', effective_date: '2026-01-01', plans: [] },
  },
};

describe('findAgeBand', () => {
  const bands = config.rate_sets.current.plans[0].age_bands;

  it('finds band at exact min boundary', () => {
    expect(findAgeBand(bands, 18)?.id).toBe('18-34');
  });

  it('finds band at exact max boundary', () => {
    expect(findAgeBand(bands, 34)?.id).toBe('18-34');
  });

  it('finds middle-of-range band', () => {
    expect(findAgeBand(bands, 45)?.id).toBe('35-49');
  });

  it('returns undefined for age below minimum', () => {
    expect(findAgeBand(bands, 10)).toBeUndefined();
  });

  it('returns undefined for age above maximum', () => {
    expect(findAgeBand(bands, 70)).toBeUndefined();
  });
});

describe('resolveRateSetKey', () => {
  it('returns rates_2026 for dates on or after 2026-01-01 when populated', () => {
    expect(resolveRateSetKey(config, '2026-01-01')).toBe('rates_2026');
  });

  it('falls back to current when preferred set is empty', () => {
    expect(resolveRateSetKey(additiveConfig, '2026-06-15')).toBe('current');
  });

  it('respects override', () => {
    expect(resolveRateSetKey(config, '2025-06-15', 'rates_2026')).toBe('rates_2026');
  });
});

describe('resolveRatingAge', () => {
  it('uses member age for primary basis', () => {
    const { age } = resolveRatingAge('primary', 'member_spouse', {
      memberAge: 30,
      spouseAge: 55,
    });
    expect(age).toBe(30);
  });

  it('uses older of couple for spouse/family on individual', () => {
    const { age } = resolveRatingAge('older_of_couple', 'member_spouse', {
      memberAge: 30,
      spouseAge: 55,
    });
    expect(age).toBe(55);
  });

  it('uses member age for member_children even with older_of_couple', () => {
    const { age } = resolveRatingAge('older_of_couple', 'member_children', {
      memberAge: 30,
      dependentAges: [5],
    });
    expect(age).toBe(30);
  });
});

describe('quote — MSA tiered_household sheet cells', () => {
  const base: QuoteInput = {
    planId: 'PIFH-MSA-IND-1250',
    coverageTier: 'member',
    household: { memberAge: 28 },
    coverageStart: '2025-06-01',
  };

  it('Individual $1,250 Member Only 18-34 = 197.10', () => {
    const result = quote(config, base);
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(197.1);
    expect(result.metadata.bandsUsed.ratingBand).toBe('18-34');
  });

  it('Individual $1,250 Member Only 35-49 = 275.94', () => {
    const result = quote(config, {
      ...base,
      household: { memberAge: 40 },
    });
    expect(result.monthlyPremium).toBe(275.94);
  });

  it('Individual couple uses older spouse band', () => {
    // member 28 (18-34), spouse 55 (50-59) → spouse rate 709.56
    const result = quote(config, {
      ...base,
      coverageTier: 'member_spouse',
      household: { memberAge: 28, spouseAge: 55 },
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(709.56);
    expect(result.metadata.ratingAge).toBe(55);
    expect(result.metadata.bandsUsed.ratingBand).toBe('50-59');
  });

  it('Group uses employee age even when spouse is older', () => {
    // Group $1250 member_spouse employee 28 → 411.94 (not spouse 55 band)
    const result = quote(config, {
      planId: 'PIFH-MSA-GRP-1250',
      coverageTier: 'member_spouse',
      household: { memberAge: 28, spouseAge: 55 },
      coverageStart: '2025-06-01',
    });
    expect(result.errors).toBeUndefined();
    expect(result.monthlyPremium).toBe(411.94);
    expect(result.metadata.ageRatingBasis).toBe('primary');
    expect(result.metadata.ratingAge).toBe(28);
  });

  it('Group $5,000 Family 60-64 = 684.19', () => {
    const result = quote(config, {
      planId: 'PIFH-MSA-GRP-5000',
      coverageTier: 'family',
      household: { memberAge: 62, spouseAge: 60, dependentAges: [12] },
      coverageStart: '2025-06-01',
    });
    expect(result.monthlyPremium).toBe(684.19);
  });

  it('Individual $2,500 Member + Children 35-49 = 397.35', () => {
    const result = quote(config, {
      planId: 'PIFH-MSA-IND-2500',
      coverageTier: 'member_children',
      household: { memberAge: 40, dependentAges: [10] },
      coverageStart: '2025-06-01',
    });
    expect(result.monthlyPremium).toBe(397.35);
  });

  it('marks provisional metadata', () => {
    const result = quote(config, base);
    expect(result.metadata.provisional).toBe(true);
    expect(result.metadata.marketSegment).toBe('individual');
  });

  it('does not charge disabled partnership/lab fees', () => {
    const result = quote(config, base);
    expect(result.monthlyFees.find((f) => f.id === 'partnership-cost')).toBeUndefined();
    expect(result.monthlyFees.find((f) => f.id === 'wellness-lab')).toBeUndefined();
  });
});

describe('enrollment contribution', () => {
  it('resolves founding waiver net = 150', () => {
    const resolved = resolveEnrollmentContribution({
      amount: 800,
      foundingWaiver: 650,
      foundingCap: 250,
      foundingEnabled: true,
      foundingCount: 0,
    });
    expect(resolved.netAmount).toBe(150);
    expect(resolved.foundingWaiverApplied).toBe(true);
  });

  it('skips waiver when founding cap reached', () => {
    const resolved = resolveEnrollmentContribution({
      amount: 800,
      foundingWaiver: 650,
      foundingCap: 250,
      foundingEnabled: true,
      foundingCount: 250,
    });
    expect(resolved.netAmount).toBe(800);
    expect(resolved.foundingWaiverApplied).toBe(false);
  });

  it('applies waiver on quote when policy passed', () => {
    const result = quote(
      config,
      {
        planId: 'PIFH-MSA-IND-1250',
        coverageTier: 'member',
        household: { memberAge: 28 },
        coverageStart: '2025-06-01',
      },
      {
        enrollmentContribution: {
          amount: 800,
          foundingWaiver: 650,
          foundingCap: 250,
          foundingEnabled: true,
          foundingCount: 10,
          splits: { referringMember: 100, adminOps: 50 },
        },
      }
    );
    const fee = result.oneTimeFees.find((f) => f.id === 'enrollment-contribution');
    expect(fee?.amount).toBe(150);
    expect(result.metadata.enrollmentContribution?.netAmount).toBe(150);
  });
});

describe('quote — additive_person fixture', () => {
  it('calculates subscriber + spouse + capped dependents', () => {
    const result = quote(additiveConfig, {
      planId: 'demo-additive',
      coverageTier: 'family',
      household: { memberAge: 40, spouseAge: 38, dependentAges: [5, 7, 9] },
      coverageStart: '2025-06-01',
    });
    expect(result.errors).toBeUndefined();
    // 300 + 150 + 50*2 (cap)
    expect(result.monthlyPremium).toBe(550);
  });
});

describe('getPlanOptions / buildMatrixPreview', () => {
  it('lists six MSA plans', () => {
    const options = getPlanOptions(config, 'current');
    expect(options).toHaveLength(6);
    expect(options.map((o) => o.planId)).toContain('PIFH-MSA-GRP-2500');
  });

  it('builds matrix with sheet cell', () => {
    const preview = buildMatrixPreview(config, 'PIFH-MSA-IND-1250', 'current');
    expect(preview).not.toBeNull();
    expect(preview!.matrix.member['18-34']).toBe(197.1);
    expect(preview!.footnotes?.some((f) => f.toLowerCase().includes('provisional'))).toBe(true);
  });
});
