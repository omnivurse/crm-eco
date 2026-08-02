import { describe, it, expect } from 'vitest';
import {
  enrollmentContributionFromSettings,
  DEFAULT_ENROLLMENT_CONTRIBUTION_POLICY,
} from '../enrollmentContributionSettings';

describe('enrollmentContributionFromSettings', () => {
  it('returns defaults for empty settings', () => {
    expect(enrollmentContributionFromSettings({})).toEqual(
      DEFAULT_ENROLLMENT_CONTRIBUTION_POLICY
    );
  });

  it('parses numeric and boolean settings', () => {
    const policy = enrollmentContributionFromSettings({
      enrollment_contribution_amount: '900',
      enrollment_contribution_founding_waiver: '700',
      enrollment_contribution_founding_cap: '500',
      enrollment_contribution_founding_enabled: 'false',
      enrollment_contribution_founding_count: '12',
    });
    expect(policy.amount).toBe(900);
    expect(policy.foundingWaiver).toBe(700);
    expect(policy.foundingCap).toBe(500);
    expect(policy.foundingEnabled).toBe(false);
    expect(policy.foundingCount).toBe(12);
  });
});
