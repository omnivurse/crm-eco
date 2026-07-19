/**
 * Premium / contribution aliases — one logical amount may be stored under
 * several JSONB keys. Readers should use these helpers so reports and heroes
 * agree with whatever key the form last wrote.
 */

export const INSURANCE_PREMIUM_KEYS = [
  'monthly_premium',
  'health_insurance_premium',
  'insurance_premium',
] as const;

export const HEALTHSHARE_CONTRIBUTION_KEYS = [
  'monthly_contribution',
  'monthly_share',
  'share_amount',
] as const;

function firstNonEmpty(
  data: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): unknown {
  if (!data) return undefined;
  for (const key of keys) {
    const v = data[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    return v;
  }
  return undefined;
}

export function pickInsurancePremium(
  data: Record<string, unknown> | null | undefined,
): unknown {
  return firstNonEmpty(data, INSURANCE_PREMIUM_KEYS);
}

export function pickHealthshareContribution(
  data: Record<string, unknown> | null | undefined,
): unknown {
  return firstNonEmpty(data, HEALTHSHARE_CONTRIBUTION_KEYS);
}
