import { describe, expect, it } from 'vitest';
import {
  hasDuplicateMonthlyPremiumLabels,
  isMonthlyContributionLabel,
  isMonthlyPremiumLabel,
} from './premium-field-aliases';
import {
  ENROLLED_BY_LABEL,
  HEALTH_INSURANCE_PLAN_LABEL,
  MEMBERSHIP_LABEL,
  coerceCoverageSnapshotFieldValue,
  coverageSnapshotEnrolledByLabel,
  coverageSnapshotSkipKeysForPlanType,
  isCapacityProductValue,
  selectCoverageSnapshotPlanFields,
} from './coverage-snapshot-plan-fields';

// Patricia BECKVERMIT-shaped HealthShare field set: real product/contribution/
// tier/IUA alongside empty plan_name / plan_type / monthly_share placeholders.
const patriciaHealthshareFields = [
  { key: 'product', label: 'Product', type: 'text' },
  { key: 'plan_name', label: 'Plan Name', type: 'text' },
  { key: 'plan_type', label: 'Plan Type', type: 'text' },
  { key: 'coverage_option', label: 'Coverage Option', type: 'text' },
  { key: 'monthly_share', label: 'Monthly Share', type: 'currency' },
  { key: 'monthly_contribution', label: 'Monthly Contribution', type: 'currency' },
  { key: 'iua_amount', label: 'IUA Amount', type: 'currency' },
  { key: 'member_tier', label: 'Member Tier', type: 'select' },
  { key: 'sharing_member_id', label: 'Sharing Member ID', type: 'text' },
];

const patriciaHealthshareValues = {
  product: 'Premium Care',
  coverage_option: 'Member Only - $1000 IUA',
  monthly_contribution: 324,
  iua_amount: 1000,
  member_tier: 'Member Only',
};

describe('selectCoverageSnapshotPlanFields', () => {
  it('never shows Monthly Premium twice for the client dual-write case', () => {
    // Exact regression: Insurance Coverage banner with health_insurance_premium
    // + monthly_premium both labeled Monthly Premium / Monthly premium.
    const result = selectCoverageSnapshotPlanFields({
      planType: 'insurance',
      fields: [
        { key: 'product', label: 'Product', type: 'text' },
        { key: 'plan_name', label: 'Plan Name', type: 'text' },
        { key: 'health_insurance_premium', label: 'Monthly premium', type: 'currency' },
        { key: 'monthly_premium', label: 'Monthly Premium', type: 'currency' },
        { key: 'previous_product', label: 'Previous Product', type: 'text' },
        { key: 'add_on_product', label: 'Add-On Product', type: 'text' },
      ],
    });

    expect(hasDuplicateMonthlyPremiumLabels(result)).toBe(false);
    expect(
      result.find((f) => f.key === 'health_insurance_premium')?.label,
    ).toBe('Monthly Premium');
    expect(result.find((f) => f.key === 'monthly_premium')?.label).toBe(
      'Monthly Contribution',
    );
    expect(result.filter((f) => isMonthlyPremiumLabel(f.label))).toHaveLength(1);
    expect(result.filter((f) => isMonthlyContributionLabel(f.label))).toHaveLength(1);
  });

  it('hides insurance premium keys on healthshare snapshots', () => {
    const result = selectCoverageSnapshotPlanFields({
      planType: 'healthshare',
      fields: [
        { key: 'product', label: 'Product', type: 'text' },
        { key: 'monthly_contribution', label: 'Monthly Contribution', type: 'currency' },
        { key: 'health_insurance_premium', label: 'Monthly Premium', type: 'currency' },
        { key: 'monthly_premium', label: 'Monthly Premium', type: 'currency' },
      ],
    });

    expect(result.some((f) => f.key === 'health_insurance_premium')).toBe(false);
    expect(result.some((f) => f.key === 'monthly_premium')).toBe(false);
    expect(result.some((f) => f.key === 'monthly_contribution')).toBe(true);
  });

  it('respects extra skipKeys (carrier / effective date already in rail)', () => {
    const result = selectCoverageSnapshotPlanFields({
      planType: 'unknown',
      skipKeys: ['product'],
      fields: [
        { key: 'product', label: 'Product', type: 'text' },
        { key: 'plan_name', label: 'Plan Name', type: 'text' },
      ],
    });
    expect(result.map((f) => f.key)).toEqual(['plan_name']);
  });

  it('populated-first: real membership/contribution/tier survive the row cap over empty plan fields (Patricia)', () => {
    const result = selectCoverageSnapshotPlanFields({
      planType: 'healthshare',
      fields: patriciaHealthshareFields,
      values: patriciaHealthshareValues,
    });
    const keys = result.map((f) => f.key);
    expect(keys).toContain('monthly_contribution');
    expect(keys).toContain('iua_amount');
    expect(keys).toContain('member_tier');
    expect(keys).not.toContain('coverage_option');
  });

  it('hides coverage_option on HealthShare and member_tier on insurance', () => {
    const healthshare = selectCoverageSnapshotPlanFields({
      planType: 'healthshare',
      fields: patriciaHealthshareFields,
      values: patriciaHealthshareValues,
    });
    expect(healthshare.some((f) => f.key === 'coverage_option')).toBe(false);
    expect(healthshare.some((f) => f.key === 'member_tier')).toBe(true);

    const insurance = selectCoverageSnapshotPlanFields({
      planType: 'insurance',
      fields: [
        { key: 'coverage_option', label: 'Coverage Option', type: 'text' },
        { key: 'member_tier', label: 'Member Tier', type: 'select' },
        { key: 'product', label: 'Product', type: 'text' },
      ],
      values: {
        coverage_option: 'Member + Family',
        member_tier: 'Member + Family',
        product: 'Gold PPO',
      },
    });
    expect(insurance.some((f) => f.key === 'member_tier')).toBe(false);
    expect(insurance.some((f) => f.key === 'coverage_option')).toBe(true);
  });

  it('without values a real tier can be pushed past the cap by empty plan fields (why populated-first exists)', () => {
    const result = selectCoverageSnapshotPlanFields({
      planType: 'healthshare',
      fields: patriciaHealthshareFields,
    });
    const keys = result.map((f) => f.key);
    // Skipping coverage_option frees a preferred-key slot, so IUA now makes
    // the 6-row cap; member_tier still sits after it and is dropped until
    // populated-first ranking runs (the UI always passes values).
    expect(keys).not.toContain('coverage_option');
    expect(keys).toContain('iua_amount');
    expect(keys).not.toContain('member_tier');
  });

  it('relabels product → Health Sharing Membership on HealthShare snapshots only', () => {
    const healthshare = selectCoverageSnapshotPlanFields({
      planType: 'healthshare',
      fields: patriciaHealthshareFields,
      values: patriciaHealthshareValues,
    });
    expect(healthshare.find((f) => f.key === 'product')?.label).toBe(
      MEMBERSHIP_LABEL,
    );

    const insurance = selectCoverageSnapshotPlanFields({
      planType: 'insurance',
      fields: [{ key: 'product', label: 'Product', type: 'text' }],
      values: { product: 'Gold PPO' },
    });
    expect(insurance.find((f) => f.key === 'product')?.label).toBe('Product');
  });

  it('relabels health_insurance_plan_name → Health Insurance Plan on insurance snapshots', () => {
    const insurance = selectCoverageSnapshotPlanFields({
      planType: 'insurance',
      fields: [{ key: 'health_insurance_plan_name', label: 'Plan Name', type: 'text' }],
      values: { health_insurance_plan_name: 'Cigna Gold' },
    });
    expect(insurance.find((f) => f.key === 'health_insurance_plan_name')?.label).toBe(
      HEALTH_INSURANCE_PLAN_LABEL,
    );
  });

  it('a capacity-label product ("Health Insurance") ranks below a real plan name', () => {
    const result = selectCoverageSnapshotPlanFields({
      planType: 'healthshare',
      fields: [
        { key: 'product', label: 'Product', type: 'text' },
        { key: 'plan_name', label: 'Plan Name', type: 'text' },
      ],
      values: { product: 'Health Insurance', plan_name: 'Premium Care' },
    });
    expect(result.map((f) => f.key)).toEqual(['plan_name', 'product']);
  });

  it('prefers real plan-name keys ahead of product in preferred order', () => {
    const result = selectCoverageSnapshotPlanFields({
      planType: 'insurance',
      fields: [
        { key: 'product', label: 'Product', type: 'text' },
        { key: 'health_insurance_plan_name', label: 'Plan Name', type: 'text' },
      ],
      values: {
        product: 'Health Insurance',
        health_insurance_plan_name: 'Gold PPO',
      },
    });
    expect(result.map((f) => f.key)[0]).toBe('health_insurance_plan_name');
  });
});

describe('coerceCoverageSnapshotFieldValue', () => {
  it('blanks capacity aliases on membership/plan-name keys', () => {
    expect(coerceCoverageSnapshotFieldValue('product', 'Health Insurance')).toBeNull();
    expect(coerceCoverageSnapshotFieldValue('plan_name', 'insurance')).toBeNull();
    expect(coerceCoverageSnapshotFieldValue('product', 'Premium Care')).toBe(
      'Premium Care',
    );
    expect(coerceCoverageSnapshotFieldValue('coverage_option', 'Health Insurance')).toBe(
      'Health Insurance',
    );
  });
});

describe('isCapacityProductValue', () => {
  it('flags coverage-type/capacity labels, not real memberships', () => {
    expect(isCapacityProductValue('Health Insurance')).toBe(true);
    expect(isCapacityProductValue('  health_share ')).toBe(true);
    expect(isCapacityProductValue('Health Sharing')).toBe(true);
    expect(isCapacityProductValue('Premium Care')).toBe(false);
    expect(isCapacityProductValue(null)).toBe(false);
  });
});

describe('coverageSnapshotSkipKeysForPlanType', () => {
  it('keeps contribution amount keys available for insurance', () => {
    const skip = coverageSnapshotSkipKeysForPlanType('insurance');
    expect(skip).not.toContain('monthly_contribution');
    expect(skip).not.toContain('monthly_share');
    expect(skip).toContain('iua_amount');
    expect(skip).toContain('member_tier');
    expect(skip).not.toContain('coverage_option');
  });

  it('hides coverage_option on HealthShare and leaves member_tier visible', () => {
    const skip = coverageSnapshotSkipKeysForPlanType('healthshare');
    expect(skip).toContain('coverage_option');
    expect(skip).not.toContain('member_tier');
  });

  it('hides neither household-tier key when plan type is unknown', () => {
    const skip = coverageSnapshotSkipKeysForPlanType('unknown');
    expect(skip).not.toContain('coverage_option');
    expect(skip).not.toContain('member_tier');
  });
});

describe('coverageSnapshotEnrolledByLabel', () => {
  it('uses ONE label regardless of which underlying field supplied the value', () => {
    const producer = coverageSnapshotEnrolledByLabel({ label: 'Producer Name' });
    const agent = coverageSnapshotEnrolledByLabel({ label: 'Agent' });
    const advisor = coverageSnapshotEnrolledByLabel({ label: 'Advisor Name' });
    expect(producer.label).toBe(ENROLLED_BY_LABEL);
    expect(agent.label).toBe(ENROLLED_BY_LABEL);
    expect(advisor.label).toBe(ENROLLED_BY_LABEL);
    expect(ENROLLED_BY_LABEL).toBe('Enrolled by');
  });

  it("keeps the field's own label visible in the title so the source is not hidden", () => {
    expect(coverageSnapshotEnrolledByLabel({ label: 'Producer Name' }).title).toBe(
      'Enrolled by (from Producer Name)',
    );
    expect(coverageSnapshotEnrolledByLabel({ label: 'Agent', tooltip: 'Writing agent' }).title).toBe(
      'Enrolled by (from Agent) — Writing agent',
    );
  });

  it('does not repeat itself when the field is already labelled Enrolled by', () => {
    expect(coverageSnapshotEnrolledByLabel({ label: 'Enrolled by' }).title).toBe('Enrolled by');
    expect(coverageSnapshotEnrolledByLabel({ label: '  ' }).title).toBe('Enrolled by');
  });
});
