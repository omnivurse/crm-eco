/**
 * Premium / contribution aliases — one logical amount may be stored under
 * several JSONB keys. Readers should use these helpers so reports and heroes
 * agree with whatever key the form last wrote.
 *
 * Canonical display terminology (coverage snapshot + crm_fields labels):
 *   - Monthly Premium      → dedicated insurance premium keys
 *   - Monthly Contribution → healthshare contribution keys, OR legacy
 *                            `monthly_premium` when a dedicated premium is also present
 */

export const MONTHLY_PREMIUM_LABEL = 'Monthly Premium';
export const MONTHLY_CONTRIBUTION_LABEL = 'Monthly Contribution';

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

/** Dedicated insurance premium keys (excludes legacy `monthly_premium`). */
export const DEDICATED_PREMIUM_KEYS = [
  'health_insurance_premium',
  'insurance_premium',
] as const;

/** Canonical contribution keys (excludes legacy `monthly_premium`). */
export const DEDICATED_CONTRIBUTION_KEYS = [
  'monthly_contribution',
  'monthly_share',
  'share_amount',
] as const;

const COVERAGE_AMOUNT_KEYS = new Set<string>([
  ...INSURANCE_PREMIUM_KEYS,
  ...HEALTHSHARE_CONTRIBUTION_KEYS,
]);

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

/** Normalize a UI label for amount-invariant comparisons. */
export function normalizeCoverageAmountLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isMonthlyPremiumLabel(label: string): boolean {
  return normalizeCoverageAmountLabel(label) === 'monthly premium';
}

export function isMonthlyContributionLabel(label: string): boolean {
  return normalizeCoverageAmountLabel(label) === 'monthly contribution';
}

/** True when two or more fields would render as "Monthly Premium". */
export function hasDuplicateMonthlyPremiumLabels(
  fields: ReadonlyArray<{ label: string }>,
): boolean {
  let count = 0;
  for (const f of fields) {
    if (isMonthlyPremiumLabel(f.label)) {
      count += 1;
      if (count > 1) return true;
    }
  }
  return false;
}

/**
 * Coverage snapshot must never render "Monthly Premium" twice.
 *
 * Legacy Zoho `monthly_premium` is overloaded: alone it is the premium; when a
 * dedicated insurance premium key is also present, treat `monthly_premium` as
 * the Monthly Contribution slot (client terminology). Dedicated contribution
 * keys always win that slot.
 */
export function applyCoverageSnapshotAmountLabels<T extends { key: string; label: string }>(
  fields: T[],
): T[] {
  const presentKeys = new Set(fields.map((f) => f.key));

  let premiumKey: string | undefined = DEDICATED_PREMIUM_KEYS.find((k) =>
    presentKeys.has(k),
  );
  let contributionKey: string | undefined = DEDICATED_CONTRIBUTION_KEYS.find((k) =>
    presentKeys.has(k),
  );

  if (presentKeys.has('monthly_premium')) {
    if (premiumKey && !contributionKey) {
      contributionKey = 'monthly_premium';
    } else if (!premiumKey) {
      premiumKey = 'monthly_premium';
    }
    // else both slots filled by dedicated keys — drop legacy monthly_premium
  }

  if (!premiumKey && !contributionKey) return fields;

  let insertedPremium = false;
  let insertedContribution = false;
  const out: T[] = [];

  for (const field of fields) {
    if (!COVERAGE_AMOUNT_KEYS.has(field.key)) {
      out.push(field);
      continue;
    }
    if (field.key === premiumKey && !insertedPremium) {
      out.push({ ...field, label: MONTHLY_PREMIUM_LABEL });
      insertedPremium = true;
      continue;
    }
    if (field.key === contributionKey && !insertedContribution) {
      out.push({ ...field, label: MONTHLY_CONTRIBUTION_LABEL });
      insertedContribution = true;
    }
    // Drop unused amount aliases (duplicate premium/contribution keys).
  }

  return out;
}

export function isCoverageAmountFieldKey(key: string): boolean {
  return COVERAGE_AMOUNT_KEYS.has(key);
}

export type CoverageAmountLabelIssue = {
  code:
    | 'duplicate_monthly_premium_labels'
    | 'monthly_premium_should_be_contribution'
    | 'dedicated_premium_mislabeled'
    | 'dedicated_contribution_mislabeled';
  fieldKey?: string;
  message: string;
};

/**
 * Audit crm_fields amount terminology so the form (not only the snapshot)
 * cannot drift back to two "Monthly Premium" labels on the same module.
 */
export function auditCoverageAmountFieldLabels(
  fields: ReadonlyArray<{ key: string; label: string }>,
  moduleKey = 'module',
): CoverageAmountLabelIssue[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const issues: CoverageAmountLabelIssue[] = [];

  const hasDedicatedPremium = DEDICATED_PREMIUM_KEYS.some((k) => byKey.has(k));
  const monthlyPremium = byKey.get('monthly_premium');

  if (
    hasDedicatedPremium &&
    monthlyPremium &&
    isMonthlyPremiumLabel(monthlyPremium.label)
  ) {
    issues.push({
      code: 'monthly_premium_should_be_contribution',
      fieldKey: 'monthly_premium',
      message: `${moduleKey}.monthly_premium is labeled "${monthlyPremium.label}" while a dedicated insurance premium field also exists — label it "${MONTHLY_CONTRIBUTION_LABEL}"`,
    });
  }

  const premiumLabeled = fields.filter(
    (f) => COVERAGE_AMOUNT_KEYS.has(f.key) && isMonthlyPremiumLabel(f.label),
  );
  if (premiumLabeled.length > 1) {
    issues.push({
      code: 'duplicate_monthly_premium_labels',
      message: `${moduleKey} has ${premiumLabeled.length} coverage amount fields labeled Monthly Premium (${premiumLabeled
        .map((f) => f.key)
        .join(', ')})`,
    });
  }

  for (const key of DEDICATED_PREMIUM_KEYS) {
    const f = byKey.get(key);
    if (!f) continue;
    if (isMonthlyContributionLabel(f.label)) {
      issues.push({
        code: 'dedicated_premium_mislabeled',
        fieldKey: key,
        message: `${moduleKey}.${key} is labeled "${f.label}" — expected "${MONTHLY_PREMIUM_LABEL}"`,
      });
    }
  }

  for (const key of DEDICATED_CONTRIBUTION_KEYS) {
    const f = byKey.get(key);
    if (!f) continue;
    if (isMonthlyPremiumLabel(f.label)) {
      issues.push({
        code: 'dedicated_contribution_mislabeled',
        fieldKey: key,
        message: `${moduleKey}.${key} is labeled "${f.label}" — expected "${MONTHLY_CONTRIBUTION_LABEL}"`,
      });
    }
  }

  return issues;
}
