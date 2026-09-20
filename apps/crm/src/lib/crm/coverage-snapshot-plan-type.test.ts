import { describe, expect, it } from 'vitest';
import {
  coverageTypeFromStatus,
  resolveCoverageSnapshotPlanType,
} from './coverage-snapshot-plan-type';

function hasValueFrom(values: Record<string, unknown>) {
  return (key: string) => {
    const v = values[key];
    return v !== null && v !== undefined && v !== '';
  };
}

describe('coverageTypeFromStatus', () => {
  it('reads type-specific active spellings and ignores generic Active', () => {
    expect(coverageTypeFromStatus('Active Insurance Client')).toBe('insurance');
    expect(coverageTypeFromStatus('Active HS Member')).toBe('healthshare');
    expect(coverageTypeFromStatus('Active HS Member - LHS Not Paid')).toBe('healthshare');
    expect(coverageTypeFromStatus('Active')).toBeNull();
    expect(coverageTypeFromStatus('Active Member')).toBeNull();
    expect(coverageTypeFromStatus('Cancelled')).toBeNull();
  });
});

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

  it('lets Active Insurance Client win over leftover healthshare fields', () => {
    const values = {
      status: 'Active Insurance Client',
      market_type: 'healthshare',
      sharing_entity: 'Sedera',
      product: 'Premium Care',
      monthly_contribution: 324,
      health_insurance_plan_name: 'Cigna Gold',
    };
    expect(
      resolveCoverageSnapshotPlanType({
        values,
        heroCarrierValue: 'Sedera',
        hasValue: hasValueFrom(values),
      }),
    ).toBe('insurance');
  });

  it('lets Active HS Member win over leftover insurance fields', () => {
    const values = {
      status: 'Active HS Member',
      market_type: 'traditional_insurance',
      health_insurance_carrier: 'Cigna',
      health_insurance_plan_name: 'Cigna Gold',
      product: 'Secure HSA',
    };
    expect(
      resolveCoverageSnapshotPlanType({
        values,
        heroCarrierValue: 'Cigna',
        hasValue: hasValueFrom(values),
      }),
    ).toBe('healthshare');
  });

  it('does not treat generic Active as a type signal', () => {
    const values = { status: 'Active', market_type: 'traditional_insurance' };
    expect(
      resolveCoverageSnapshotPlanType({
        values,
        hasValue: hasValueFrom(values),
      }),
    ).toBe('insurance');
  });

  it('does not let stale sharing_status flip a cancelled contact', () => {
    const values = {
      status: 'Cancelled',
      sharing_status: 'Active HS Member',
      market_type: 'traditional_insurance',
    };
    expect(
      resolveCoverageSnapshotPlanType({
        values,
        hasValue: hasValueFrom(values),
      }),
    ).toBe('insurance');
  });
});
