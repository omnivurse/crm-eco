/**
 * Product card start dates — four fields, two of which are legacy mirrors.
 *
 * Measured across 7,655 PIFH contacts (2026-08-30):
 *
 *   original_start_date       indexed column   5,569   KEEP — the enrolment date
 *   current_year_start_date   indexed column   5,502   KEEP — the renewal anniversary
 *   start_date                JSONB only       5,566   legacy Zoho mirror
 *   insurance_effective_date  JSONB only           2   dead
 *
 * The two keepers are NOT redundant: of the records carrying both, 4,295 differ
 * and only 1,207 match. Original enrolment and current plan year are different
 * facts and merging them would destroy the distinction.
 *
 * `start_date` is a mirror of `original_start_date` — identical on 5,553
 * records. But on 11 it DISAGREES (Wendy Scipione 2018-01-01 vs 2022-01-01;
 * merryl rothaus 2025-02-01 vs 2023-01-01) and on 2 more it is the only value
 * present. Blanket-hiding it would silently strand those 13.
 *
 * So the rule is comparative, not a blocklist: a mirror is hidden only when it
 * actually agrees with the canonical column. Where it disagrees — or is the
 * sole value — it stays on the card for a human to reconcile, and disappears by
 * itself once it does. Nothing is deleted; the JSONB keeps every value either
 * way.
 */

import { normalizeDateColumnValue } from './merge-crm-data-json-to-row';

/** The start date the rest of the system filters, sorts and reports on. */
export const CANONICAL_START_DATE_KEY = 'original_start_date';

/** The other start date worth keeping — the current plan year's anniversary. */
export const CURRENT_YEAR_START_DATE_KEY = 'current_year_start_date';

/** Legacy start-date spellings that duplicate {@link CANONICAL_START_DATE_KEY}. */
export const LEGACY_START_DATE_MIRROR_KEYS = [
  'start_date',
  'insurance_effective_date',
] as const;

const MIRROR_KEY_SET: ReadonlySet<string> = new Set(LEGACY_START_DATE_MIRROR_KEYS);

export function isLegacyStartDateMirrorKey(fieldKey: string): boolean {
  return MIRROR_KEY_SET.has(fieldKey);
}

/** Compare two date-ish values on their calendar day, ignoring time and format. */
function sameDay(a: unknown, b: unknown): boolean {
  const left = normalizeDateColumnValue(a);
  const right = normalizeDateColumnValue(b);
  return left !== null && right !== null && left === right;
}

export interface StartDateVisibilityArgs {
  fieldKey: string;
  /** Merged record values (JSONB `data` overlaid with indexed columns). */
  values?: Record<string, unknown> | null;
}

/**
 * Whether a Product-card start date should render.
 *
 * Only ever narrows the legacy mirrors; every other field passes straight
 * through. A mirror is hidden when — and only when — the canonical column
 * holds the same day, so a disagreement is always visible.
 */
export function shouldShowStartDateFieldInForm({
  fieldKey,
  values,
}: StartDateVisibilityArgs): boolean {
  if (!isLegacyStartDateMirrorKey(fieldKey)) return true;

  const data = values && typeof values === 'object' ? values : {};
  const mirror = normalizeDateColumnValue(data[fieldKey]);

  // Nothing stored under the mirror: nothing to strand, nothing to show.
  if (!mirror) return false;

  // Stored and it agrees with the canonical column → redundant, hide it.
  if (sameDay(mirror, data[CANONICAL_START_DATE_KEY])) return false;

  // Stored and it disagrees (or the canonical column is empty) → show it, so
  // the discrepancy is somebody's decision rather than a silent loss.
  return true;
}
