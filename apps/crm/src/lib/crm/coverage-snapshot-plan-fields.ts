/**
 * Coverage snapshot plan/product field selection.
 *
 * Invariant: the returned list never contains two fields whose display label
 * normalizes to "monthly premium". Amount aliases are resolved through
 * `applyCoverageSnapshotAmountLabels` so legacy Zoho dual-writes
 * (`health_insurance_premium` + `monthly_premium`) surface as Premium + Contribution.
 */

import {
  applyCoverageSnapshotAmountLabels,
  hasDuplicateMonthlyPremiumLabels,
} from '@/lib/crm/premium-field-aliases';

export type CoverageSnapshotPlanType = 'healthshare' | 'insurance' | 'unknown';

export interface CoverageSnapshotPlanField {
  key: string;
  label: string;
  type?: string;
}

/** Snapshot label for the membership/product row on HealthShare records. */
export const MEMBERSHIP_LABEL = 'Membership';

/**
 * Coverage-type/capacity labels that get mis-stored in `product` in place of a
 * real membership name (e.g. "Health Insurance" instead of "Premium Care").
 * They are not a membership name, so they should not out-rank a field that
 * holds a real value when competing for a limited number of snapshot rows.
 */
const CAPACITY_PRODUCT_ALIASES = new Set<string>([
  'health insurance',
  'health share',
  'health sharing',
  'healthshare',
  'health_insurance',
  'health_share',
  'insurance',
]);

/**
 * True when a value is a coverage-type/capacity label rather than a real
 * membership / plan name.
 */
export function isCapacityProductValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return CAPACITY_PRODUCT_ALIASES.has(String(value).trim().toLowerCase());
}

/**
 * Membership / plan-name keys whose capacity aliases must never display as a
 * real plan name in the coverage snapshot.
 */
const MEMBERSHIP_NAME_KEYS = new Set([
  'product',
  'previous_product',
  'plan_name',
  'health_insurance_plan_name',
  'insurance_plan_name',
]);

/**
 * Display value for a coverage-snapshot field. Capacity aliases stored in
 * product/plan-name keys (e.g. "Health Insurance") coerce to null so the UI
 * shows an empty / "Add …" placeholder instead of a fake membership name.
 */
export function coerceCoverageSnapshotFieldValue(
  key: string,
  value: unknown,
): unknown {
  if (MEMBERSHIP_NAME_KEYS.has(key) && isCapacityProductValue(value)) {
    return null;
  }
  return value;
}

/**
 * Ranking tier for populated-first ordering (lower = shown first):
 *   0 — a real, non-empty value (e.g. "Premium Care", 324, "Member Only")
 *   1 — empty / capacity-label placeholder ("Health Insurance") — never outranks
 *       a real membership / plan name
 */
function coverageFieldRankTier(
  key: string,
  values: Record<string, unknown>,
): number {
  const v = coerceCoverageSnapshotFieldValue(key, values[key]);
  if (v === null || v === undefined || v === '') return 1;
  return 0;
}

/** Preferred keys for the coverage snapshot detail grid (order matters). */
export const COVERAGE_SNAPSHOT_PREFERRED_KEYS = [
  // Real plan / membership names before the often-misused `product` capacity slot.
  'health_insurance_plan_name',
  'insurance_plan_name',
  'plan_name',
  'product',
  'health_insurance_premium',
  'plan_type',
  'coverage_option',
  'monthly_share',
  'monthly_contribution',
  'monthly_premium',
  'monthly_amount',
  'monthly_rate',
  'iua_amount',
  'member_tier',
  'sharing_member_id',
  'sharing_status',
  'previous_product',
] as const;

const PATTERN =
  /plan|product|tier|premium|monthly|contribution|coverage.?option|member.?tier|rate|amount/i;

const TEXTISH = new Set([
  'text',
  'textarea',
  'select',
  'picklist',
  'number',
  'currency',
]);

/** Plan-type keys that must not appear on the opposite coverage snapshot. */
export function coverageSnapshotSkipKeysForPlanType(
  planType: CoverageSnapshotPlanType,
): string[] {
  if (planType === 'healthshare') {
    return [
      'health_insurance_plan_name',
      'insurance_plan_name',
      'health_insurance_premium',
      'monthly_premium',
    ];
  }
  if (planType === 'insurance') {
    // Allow contribution amount keys — dual-written Zoho amounts are relabeled.
    return ['iua_amount', 'member_tier', 'sharing_member_id', 'sharing_status'];
  }
  return [];
}

/**
 * Select + label plan/product rows for the coverage snapshot.
 * Always runs amount-label normalization; throws in development if the
 * invariant is violated (defense against a future bypass of the helper).
 */
export function selectCoverageSnapshotPlanFields<T extends CoverageSnapshotPlanField>(
  args: {
    fields: T[];
    skipKeys?: Iterable<string>;
    planType: CoverageSnapshotPlanType;
    maxFields?: number;
    /**
     * Resolved field values. When provided, populated fields are preferred over
     * empty ones (and over capacity-label placeholders) so a real membership /
     * contribution / tier is never pushed past `maxFields` by an empty slot.
     */
    values?: Record<string, unknown>;
  },
): T[] {
  const maxFields = args.maxFields ?? 6;
  const skipKeys = new Set(args.skipKeys ?? []);
  for (const k of coverageSnapshotSkipKeysForPlanType(args.planType)) {
    skipKeys.add(k);
  }

  const byKey = new Map(args.fields.map((f) => [f.key, f]));

  // 1. Ordered candidate list (no cap yet): preferred keys first, then any
  //    remaining pattern-matched fields — preserving priority order.
  const ordered: T[] = [];
  const seen = new Set<string>();
  const tryPush = (f: T | undefined) => {
    if (!f || skipKeys.has(f.key) || seen.has(f.key)) return;
    ordered.push(f);
    seen.add(f.key);
  };

  for (const k of COVERAGE_SNAPSHOT_PREFERRED_KEYS) {
    tryPush(byKey.get(k));
  }
  for (const f of args.fields) {
    if (skipKeys.has(f.key) || seen.has(f.key)) continue;
    if (f.type && !TEXTISH.has(f.type)) continue;
    if (!PATTERN.test(f.key)) continue;
    tryPush(f);
  }

  // 2. Populated-first (stable within each tier) when values are known.
  const values = args.values;
  const ranked =
    values === undefined
      ? ordered
      : ordered
          .map((f, i) => ({ f, i, tier: coverageFieldRankTier(f.key, values) }))
          .sort((a, b) => a.tier - b.tier || a.i - b.i)
          .map((entry) => entry.f);

  // 3. Cap, then normalize amount labels (Monthly Premium invariant).
  const labeled = applyCoverageSnapshotAmountLabels(ranked.slice(0, maxFields));

  // 4. On HealthShare records the membership name IS the product — relabel the
  //    product row "Membership" so the snapshot names the member's plan.
  const finalFields =
    args.planType === 'healthshare'
      ? labeled.map((f) =>
          f.key === 'product' ? { ...f, label: MEMBERSHIP_LABEL } : f,
        )
      : labeled;

  if (
    process.env.NODE_ENV !== 'production' &&
    hasDuplicateMonthlyPremiumLabels(finalFields)
  ) {
    throw new Error(
      'Coverage snapshot invariant violated: duplicate "Monthly Premium" labels after normalization',
    );
  }

  return finalFields;
}
