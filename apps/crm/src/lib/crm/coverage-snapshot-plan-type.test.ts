import { describe, expect, it } from 'vitest';
import { resolveCoverageSnapshotPlanType } from './coverage-snapshot-plan-type';

function hasValueFrom(values: Record<string, unknown>) {
  return (key: string) => {
    const v = values[key];
    return v !== null && v !== undefined && v !== '';
  };
}

describe('resolveCoverageSnapshotPlanType', () => {
  it('overrides healthshare market_type when hero is a known insurer and no ministry present (James)', () => {
    const values = {
      market_type: 'healthshare',
      carrier: 'United Healthcare',
      product: 'Health Insurance',
      iua_amount: '1250',
    };
    expect(
      resolveCoverageSnapshotPlanType({
        values,
        heroCarrierValue: 'United Healthcare',
        hasValue: hasValueFrom(values),
      }),
    ).toBe('insurance');
  });

  it('keeps healthshare when a known ministry is present even if an insurer string exists', () => {
    const values = {
      market_type: 'healthshare',
      sharing_entity: 'Sedera',
      carrier: 'United Healthcare',
    };
    expect(
      resolveCoverageSnapshotPlanType({
        values,
        heroCarrierValue: 'United Healthcare',
        hasValue: hasValueFrom(values),
      }),
    ).toBe('healthshare');
  });

  it('respects traditional_insurance market_type', () => {
    const values = { market_type: 'traditional_insurance' };
    expect(
      resolveCoverageSnapshotPlanType({
        values,
        hasValue: hasValueFrom(values),
      }),
    ).toBe('insurance');
  });

  it('keeps healthshare when market_type matches and hero is a ministry', () => {
    const values = {
      market_type: 'healthshare',
      sharing_entity: 'Zion Health',
    };
    expect(
      resolveCoverageSnapshotPlanType({
        values,
        heroCarrierValue: 'Zion Health',
        hasValue: hasValueFrom(values),
      }),
    ).toBe('healthshare');
  });
});
