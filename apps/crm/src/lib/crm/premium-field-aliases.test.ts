import { describe, expect, it } from 'vitest';
import {
  applyCoverageSnapshotAmountLabels,
  auditCoverageAmountFieldLabels,
  hasDuplicateMonthlyPremiumLabels,
  pickHealthshareContribution,
  pickInsurancePremium,
} from './premium-field-aliases';

describe('applyCoverageSnapshotAmountLabels', () => {
  it('relabels monthly_premium to Monthly Contribution when a dedicated premium is also present', () => {
    const result = applyCoverageSnapshotAmountLabels([
      { key: 'product', label: 'Product' },
      { key: 'plan_name', label: 'Plan Name' },
      { key: 'health_insurance_premium', label: 'Monthly premium' },
      { key: 'monthly_premium', label: 'Monthly Premium' },
      { key: 'previous_product', label: 'Previous Product' },
    ]);

    expect(result.map((f) => [f.key, f.label])).toEqual([
      ['product', 'Product'],
      ['plan_name', 'Plan Name'],
      ['health_insurance_premium', 'Monthly Premium'],
      ['monthly_premium', 'Monthly Contribution'],
      ['previous_product', 'Previous Product'],
    ]);
  });

  it('keeps a lone monthly_premium as Monthly Premium', () => {
    const result = applyCoverageSnapshotAmountLabels([
      { key: 'monthly_premium', label: 'Monthly Premium' },
    ]);
    expect(result).toEqual([{ key: 'monthly_premium', label: 'Monthly Premium' }]);
  });

  it('prefers dedicated contribution over legacy monthly_premium', () => {
    const result = applyCoverageSnapshotAmountLabels([
      { key: 'health_insurance_premium', label: 'Monthly premium' },
      { key: 'monthly_premium', label: 'Monthly Premium' },
      { key: 'monthly_contribution', label: 'Monthly Contribution' },
    ]);

    expect(result.map((f) => [f.key, f.label])).toEqual([
      ['health_insurance_premium', 'Monthly Premium'],
      ['monthly_contribution', 'Monthly Contribution'],
    ]);
  });

  it('shows monthly_premium as premium beside a dedicated contribution', () => {
    const result = applyCoverageSnapshotAmountLabels([
      { key: 'monthly_premium', label: 'Monthly Premium' },
      { key: 'monthly_contribution', label: 'Monthly Contribution' },
    ]);

    expect(result.map((f) => [f.key, f.label])).toEqual([
      ['monthly_premium', 'Monthly Premium'],
      ['monthly_contribution', 'Monthly Contribution'],
    ]);
  });

  it('dedupes two dedicated insurance premium aliases to one Monthly Premium', () => {
    const result = applyCoverageSnapshotAmountLabels([
      { key: 'health_insurance_premium', label: 'Monthly premium' },
      { key: 'insurance_premium', label: 'Monthly Premium' },
    ]);

    expect(result).toEqual([
      { key: 'health_insurance_premium', label: 'Monthly Premium' },
    ]);
  });

  it('leaves non-amount fields unchanged when no amount keys are present', () => {
    const fields = [
      { key: 'product', label: 'Product' },
      { key: 'plan_name', label: 'Plan Name' },
    ];
    expect(applyCoverageSnapshotAmountLabels(fields)).toEqual(fields);
  });
});

describe('pick helpers', () => {
  it('pickInsurancePremium prefers the first populated alias', () => {
    expect(
      pickInsurancePremium({
        monthly_premium: 100,
        health_insurance_premium: 200,
      }),
    ).toBe(100);
  });

  it('pickHealthshareContribution skips blanks', () => {
    expect(
      pickHealthshareContribution({
        monthly_contribution: '  ',
        monthly_share: 50,
      }),
    ).toBe(50);
  });
});

describe('auditCoverageAmountFieldLabels', () => {
  it('flags the dual Monthly Premium crm_fields configuration', () => {
    const issues = auditCoverageAmountFieldLabels(
      [
        { key: 'health_insurance_premium', label: 'Monthly Premium' },
        { key: 'monthly_premium', label: 'Monthly Premium' },
      ],
      'contacts',
    );
    expect(issues.map((i) => i.code).sort()).toEqual([
      'duplicate_monthly_premium_labels',
      'monthly_premium_should_be_contribution',
    ]);
  });

  it('passes when monthly_premium is already Monthly Contribution beside a dedicated premium', () => {
    const issues = auditCoverageAmountFieldLabels([
      { key: 'health_insurance_premium', label: 'Monthly Premium' },
      { key: 'monthly_premium', label: 'Monthly Contribution' },
      { key: 'monthly_contribution', label: 'Monthly Contribution' },
    ]);
    expect(issues).toEqual([]);
  });
});

describe('hasDuplicateMonthlyPremiumLabels', () => {
  it('is true only when two Monthly Premium labels are present', () => {
    expect(
      hasDuplicateMonthlyPremiumLabels([
        { label: 'Monthly Premium' },
        { label: 'monthly premium' },
      ]),
    ).toBe(true);
    expect(
      hasDuplicateMonthlyPremiumLabels([
        { label: 'Monthly Premium' },
        { label: 'Monthly Contribution' },
      ]),
    ).toBe(false);
  });
});
