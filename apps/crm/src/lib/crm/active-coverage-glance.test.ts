import { describe, expect, it } from 'vitest';
import { buildActiveCoverageGlance, isActiveCoverageLane } from './active-coverage-glance';

describe('isActiveCoverageLane', () => {
  it('treats type-specific and generic active spellings as active', () => {
    expect(isActiveCoverageLane('Active Insurance Client')).toBe(true);
    expect(isActiveCoverageLane('Active HS Member')).toBe(true);
    expect(isActiveCoverageLane('Active')).toBe(true);
    expect(isActiveCoverageLane('Enrolled - 2026')).toBe(true);
  });

  it('rejects pending / cancelled / blank', () => {
    expect(isActiveCoverageLane('Pending HS Member')).toBe(false);
    expect(isActiveCoverageLane('Cancelled')).toBe(false);
    expect(isActiveCoverageLane('')).toBe(false);
    expect(isActiveCoverageLane(null)).toBe(false);
  });
});

describe('buildActiveCoverageGlance', () => {
  it('shows insurance plan details for an Active Insurance Client even with leftover HS fields', () => {
    const glance = buildActiveCoverageGlance({
      status: 'Active Insurance Client',
      market_type: 'healthshare',
      product: 'Premium Care',
      sharing_entity: 'Sedera',
      monthly_contribution: 324,
      health_insurance_plan_name: 'Cigna Gold',
      health_insurance_carrier: 'Cigna',
      monthly_premium: 612,
      health_insurance_start_date: '2026-02-01',
    });

    expect(glance).not.toBeNull();
    expect(glance?.planType).toBe('insurance');
    expect(glance?.eyebrow).toBe('Active Health Insurance Plan');
    expect(glance?.name).toBe('Cigna Gold');
    expect(glance?.carrierValue).toBe('Cigna');
    expect(glance?.amountValue).toBe('$612.00');
    expect(glance?.carrierLabel).toBe('Insurance Carrier');
    expect(glance?.amountLabel).toBe('Monthly Premium');
  });

  it('shows health-sharing membership for an Active HS Member even with leftover insurance fields', () => {
    const glance = buildActiveCoverageGlance({
      status: 'Active HS Member',
      market_type: 'traditional_insurance',
      product: 'Secure HSA',
      sharing_entity: 'Sedera',
      monthly_contribution: 265,
      health_insurance_plan_name: 'Cigna Gold',
      health_insurance_carrier: 'Cigna',
      monthly_premium: 612,
    });

    expect(glance).not.toBeNull();
    expect(glance?.planType).toBe('healthshare');
    expect(glance?.eyebrow).toBe('Active Health Sharing Membership');
    expect(glance?.name).toBe('Secure HSA');
    expect(glance?.carrierValue).toBe('Sedera');
    expect(glance?.amountValue).toBe('$265.00');
    expect(glance?.carrierLabel).toBe('Sharing Entity');
  });

  it('returns null for cancelled records', () => {
    expect(
      buildActiveCoverageGlance({
        status: 'Cancelled',
        health_insurance_plan_name: 'Cigna Gold',
        health_insurance_carrier: 'Cigna',
      }),
    ).toBeNull();
  });

  it('returns null when generic Active has no coverage to show', () => {
    expect(buildActiveCoverageGlance({ status: 'Active' })).toBeNull();
  });

  it('does not use leftover Health Sharing product as an insurance plan name', () => {
    const glance = buildActiveCoverageGlance({
      status: 'Active Insurance Client',
      product: 'Premium Care',
      sharing_entity: 'Sedera',
      health_insurance_carrier: 'Cigna',
    });
    expect(glance?.planType).toBe('insurance');
    expect(glance?.name).toBeNull();
    expect(glance?.carrierValue).toBe('Cigna');
  });

  it('does not treat a carrier UUID as a display name', () => {
    const glance = buildActiveCoverageGlance({
      status: 'Active HS Member',
      product: 'Premium Care',
      sharing_entity: 'b9c60010-7541-4e66-b3ba-1d3eb5a84781',
    });
    expect(glance?.name).toBe('Premium Care');
    expect(glance?.carrierValue).toBeNull();
  });
});
