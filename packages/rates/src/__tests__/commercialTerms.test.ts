import { describe, expect, it } from 'vitest';
import {
  applyCommercialTerms,
  applyGroupSizeDiscount,
  applyPeriodAmount,
  capRegistrationFees,
  householdLives,
  parseCommercialTerms,
} from '../commercialTerms';

describe('parseCommercialTerms', () => {
  it('returns undefined for empty objects', () => {
    expect(parseCommercialTerms({})).toBeUndefined();
    expect(parseCommercialTerms(null)).toBeUndefined();
  });

  it('reads known fields only', () => {
    const terms = parseCommercialTerms({
      billing_timing: 'arrears',
      default_period: 'quarterly',
      period_discounts: { quarterly: 5 },
      registration_fee_family_max: 250,
      group_size_discounts: [{ min_lives: 10, percent: 8 }],
    });
    expect(terms?.billing_timing).toBe('arrears');
    expect(terms?.default_period).toBe('quarterly');
    expect(terms?.period_discounts?.quarterly).toBe(5);
  });
});

describe('period and group math', () => {
  it('multiplies monthly by period and applies a discount', () => {
    expect(applyPeriodAmount(100, 'quarterly', 10)).toBe(270);
    expect(applyPeriodAmount(100, 'annual', 0)).toBe(1200);
  });

  it('uses the highest matching group-size tier', () => {
    const result = applyGroupSizeDiscount(200, 12, [
      { min_lives: 5, percent: 5 },
      { min_lives: 10, percent: 10 },
    ]);
    expect(result.discount).toBe(20);
    expect(result.monthly).toBe(180);
  });

  it('counts household lives from the selected tier', () => {
    expect(
      householdLives({
        coverageTier: 'family',
        household: { spouseAge: 34, dependentAges: [4, 7] },
      })
    ).toBe(4);
  });

  it('caps registration-like one-time fees', () => {
    const { fees, cappedBy } = capRegistrationFees(
      [
        { id: 'enrollment-contribution', label: 'Enrollment', amount: 400 },
        { id: 'card', label: 'Card setup', amount: 10 },
      ],
      250
    );
    expect(cappedBy).toBe(150);
    expect(fees.find((f) => f.id === 'enrollment-contribution')?.amount).toBe(250);
    expect(fees.find((f) => f.id === 'card')?.amount).toBe(10);
  });
});

describe('applyCommercialTerms', () => {
  it('is a no-op when terms are absent', () => {
    const result = applyCommercialTerms({
      monthlyPremium: 199,
      oneTimeFees: [{ id: 'x', label: 'X', amount: 50 }],
      coverageTier: 'member',
      household: {},
    });
    expect(result.monthlyPremium).toBe(199);
    expect(result.oneTimeFees[0].amount).toBe(50);
    expect(result.breakdown).toEqual([]);
  });

  it('applies discount and period together', () => {
    const result = applyCommercialTerms({
      terms: {
        default_period: 'quarterly',
        period_discounts: { quarterly: 0 },
        group_size_discounts: [{ min_lives: 3, percent: 10 }],
      },
      monthlyPremium: 300,
      oneTimeFees: [],
      coverageTier: 'family',
      household: { spouseAge: 30, dependentAges: [2] },
    });
    expect(result.monthlyPremium).toBe(270);
    expect(result.periodAmount).toBe(810);
  });

  it('forces monthly when billing is arrears', () => {
    const result = applyCommercialTerms({
      terms: { billing_timing: 'arrears', default_period: 'annual' },
      monthlyPremium: 100,
      oneTimeFees: [],
      coverageTier: 'member',
      household: {},
      period: 'annual',
    });
    expect(result.period).toBe('monthly');
    expect(result.periodAmount).toBe(100);
  });
});
