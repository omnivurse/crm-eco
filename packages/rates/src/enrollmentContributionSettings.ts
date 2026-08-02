import type { EnrollmentContributionPolicy } from './types';

/** Default provisional contribution policy (matches rate sheet notes). */
export const DEFAULT_ENROLLMENT_CONTRIBUTION_POLICY: EnrollmentContributionPolicy = {
  amount: 800,
  foundingWaiver: 650,
  foundingCap: 250,
  foundingEnabled: true,
  foundingCount: 0,
  splits: {
    referringMember: 100,
    adminOps: 50,
    partnerMarketing: 25,
    pifh: 25,
  },
};

/**
 * Map org `system_settings` rows (key → value) into an EnrollmentContributionPolicy.
 */
export function enrollmentContributionFromSettings(
  settings: Record<string, string | null | undefined>
): EnrollmentContributionPolicy {
  const num = (key: string, fallback: number) => {
    const raw = settings[key];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const bool = (key: string, fallback: boolean) => {
    const raw = settings[key];
    if (raw === undefined || raw === null || raw === '') return fallback;
    return raw === 'true' || raw === '1';
  };

  return {
    amount: num('enrollment_contribution_amount', DEFAULT_ENROLLMENT_CONTRIBUTION_POLICY.amount),
    foundingWaiver: num(
      'enrollment_contribution_founding_waiver',
      DEFAULT_ENROLLMENT_CONTRIBUTION_POLICY.foundingWaiver
    ),
    foundingCap: num(
      'enrollment_contribution_founding_cap',
      DEFAULT_ENROLLMENT_CONTRIBUTION_POLICY.foundingCap
    ),
    foundingEnabled: bool(
      'enrollment_contribution_founding_enabled',
      DEFAULT_ENROLLMENT_CONTRIBUTION_POLICY.foundingEnabled
    ),
    foundingCount: num(
      'enrollment_contribution_founding_count',
      DEFAULT_ENROLLMENT_CONTRIBUTION_POLICY.foundingCount
    ),
    splits: {
      referringMember: num('enrollment_contribution_split_referring', 100),
      adminOps: num('enrollment_contribution_split_admin_ops', 50),
      partnerMarketing: num('enrollment_contribution_split_partner', 25),
      pifh: num('enrollment_contribution_split_pifh', 25),
    },
  };
}
