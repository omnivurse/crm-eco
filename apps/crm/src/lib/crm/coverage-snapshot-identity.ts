/**
 * Coverage snapshot identity-rail resolution.
 *
 * The snapshot's identity rail shows ONE field to represent the plan's
 * carrier / sharing entity. Several keys can hold that value (`sharing_entity`,
 * `health_insurance_carrier`, legacy `carrier`, …) and legacy Zoho imports
 * often leave an ambiguous free-text `carrier` such as "Other" sitting next to
 * the real, resolvable value (a carrier UUID on `sharing_entity` / `carrier_id`,
 * or a named ministry).
 *
 * The bug this guards against: the identity rail binding to the legacy
 * `carrier: "Other"` instead of `sharing_entity` (a Sedera carrier UUID), so a
 * HealthShare member reads "Sharing Entity: Other". Resolution therefore
 * prefers a *resolvable* value (UUID or a real ministry/carrier name) over an
 * ambiguous placeholder, while keeping the caller's candidate priority order.
 */

import type { CoverageSnapshotPlanType } from '@/lib/crm/coverage-snapshot-plan-fields';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Free-text carrier values that carry no real identity. These must never win
 * the identity rail over a resolvable UUID / ministry name sitting on another
 * candidate. Compared case-insensitively after trimming.
 */
const AMBIGUOUS_CARRIER_VALUES = new Set<string>([
  '',
  'other',
  'n/a',
  'na',
  'none',
  'unknown',
  'tbd',
  '-',
]);

/** True when a value is null / undefined / blank string. */
export function isBlankIdentityValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/** True for placeholder carrier values like "Other" / blank / "N/A". */
export function isAmbiguousCarrierValue(value: unknown): boolean {
  if (isBlankIdentityValue(value)) return true;
  return AMBIGUOUS_CARRIER_VALUES.has(String(value).trim().toLowerCase());
}

/**
 * True when a value resolves to a concrete carrier / ministry identity:
 * a carrier UUID (resolved to a name downstream) or a non-ambiguous free-text
 * name. Ambiguous placeholders ("Other", blank, "N/A") are NOT resolvable.
 */
export function isResolvableCarrierValue(value: unknown): boolean {
  if (isBlankIdentityValue(value)) return false;
  const s = String(value).trim();
  if (UUID_RE.test(s)) return true;
  return !isAmbiguousCarrierValue(s);
}

export interface HeroSharingCandidate {
  key: string;
}

export interface SelectHeroSharingFieldArgs<T extends HeroSharingCandidate> {
  /** Candidate fields in caller-defined priority order (best first). */
  candidates: T[];
  /** Resolved form/record values keyed by field key. */
  values: Record<string, unknown>;
}

/**
 * Pick the field that best represents the plan's carrier / sharing entity.
 *
 * Priority:
 *   1. first candidate whose value is *resolvable* (UUID or real name) — this
 *      is what makes `sharing_entity: <Sedera UUID>` win over `carrier: "Other"`;
 *   2. first candidate with any non-blank value (so an ambiguous "Other" still
 *      shows rather than an empty rail when nothing better exists);
 *   3. the first candidate (placeholder rail in edit mode).
 */
export function selectHeroSharingField<T extends HeroSharingCandidate>(
  args: SelectHeroSharingFieldArgs<T>,
): T | undefined {
  const { candidates, values } = args;
  if (candidates.length === 0) return undefined;

  const valueOf = (f: T) => values[f.key];

  const resolvable = candidates.find((f) =>
    isResolvableCarrierValue(valueOf(f)),
  );
  if (resolvable) return resolvable;

  const populated = candidates.find((f) => !isBlankIdentityValue(valueOf(f)));
  if (populated) return populated;

  return candidates[0];
}

/** Carrier / entity keys that belong on an insurance snapshot. */
export const INSURANCE_HERO_CARRIER_KEYS = [
  'health_insurance_carrier',
  'insurance_carrier',
  'carrier',
  'carrier_name',
] as const;

/** Carrier / entity keys that belong on a health-sharing snapshot. */
export const HEALTHSHARE_HERO_CARRIER_KEYS = [
  'sharing_entity',
  'carrier',
  'carrier_name',
] as const;

/** Effective-date keys that belong on an insurance snapshot. */
export const INSURANCE_HERO_START_DATE_KEYS = [
  'health_insurance_start_date',
  'insurance_effective_date',
  'effective_date',
  'start_date',
  'original_start_date',
  'current_year_start_date',
] as const;

/** Effective-date keys that belong on a health-sharing snapshot. */
export const HEALTHSHARE_HERO_START_DATE_KEYS = [
  'sharing_effective_date',
  'effective_date',
  'start_date',
  'original_start_date',
  'current_year_start_date',
] as const;

function filterHeroCandidates<T extends HeroSharingCandidate>(
  candidates: T[],
  allowedKeys: readonly string[],
): T[] {
  const allowed = new Set<string>(allowedKeys);
  const filtered = candidates.filter((candidate) => allowed.has(candidate.key));
  return filtered.length > 0 ? filtered : candidates;
}

/**
 * Drop the opposite product's carrier keys once the record is classified.
 * Unknown type keeps the caller's full candidate list.
 */
export function filterHeroCarrierCandidatesByPlanType<T extends HeroSharingCandidate>(
  candidates: T[],
  planType: CoverageSnapshotPlanType,
): T[] {
  if (planType === 'insurance') return filterHeroCandidates(candidates, INSURANCE_HERO_CARRIER_KEYS);
  if (planType === 'healthshare') {
    return filterHeroCandidates(candidates, HEALTHSHARE_HERO_CARRIER_KEYS);
  }
  return candidates;
}

/**
 * Drop the opposite product's start-date keys once the record is classified.
 * Unknown type keeps the caller's full candidate list.
 */
export function filterHeroStartDateCandidatesByPlanType<T extends HeroSharingCandidate>(
  candidates: T[],
  planType: CoverageSnapshotPlanType,
): T[] {
  if (planType === 'insurance') {
    return filterHeroCandidates(candidates, INSURANCE_HERO_START_DATE_KEYS);
  }
  if (planType === 'healthshare') {
    return filterHeroCandidates(candidates, HEALTHSHARE_HERO_START_DATE_KEYS);
  }
  return candidates;
}
