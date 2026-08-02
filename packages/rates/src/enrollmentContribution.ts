import type {
  EnrollmentContributionPolicy,
  EnrollmentContributionResult,
} from './types';

/**
 * Resolve net enrollment contribution after optional founding-member waiver.
 * Pure — never throws.
 */
export function resolveEnrollmentContribution(
  policy: EnrollmentContributionPolicy
): EnrollmentContributionResult {
  const listAmount = Math.max(0, round(policy.amount));
  const foundingWaiver = Math.max(0, round(policy.foundingWaiver));

  const eligibleByCount =
    policy.foundingEnabled &&
    policy.foundingCount >= 0 &&
    policy.foundingCount < policy.foundingCap;

  const apply =
    policy.applyFoundingWaiver !== undefined
      ? policy.applyFoundingWaiver
      : eligibleByCount;

  const waiverAmount = apply ? Math.min(foundingWaiver, listAmount) : 0;
  const netAmount = round(Math.max(0, listAmount - waiverAmount));

  return {
    listAmount,
    waiverAmount,
    netAmount,
    foundingWaiverApplied: waiverAmount > 0,
    ...(policy.splits ? { splits: policy.splits } : {}),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
