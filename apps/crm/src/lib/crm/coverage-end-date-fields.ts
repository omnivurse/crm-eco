/** Canonical end-date field keys for HealthShare vs major medical coverage. */

export const SHARING_END_DATE_KEY = 'sharing_end_date';
export const INSURANCE_END_DATE_KEY = 'health_insurance_end_date';

/**
 * The Product ("insurance") card's canonical end date.
 *
 * `cancellation_date` and not a fresh `coverage_end_date` key, deliberately:
 * it is the INDEXED COLUMN (so it filters, sorts and reports), it is already
 * defined on contacts.insurance, and it is the exact key the scheduled-cancel
 * job writes when it auto-cancels. The alternatives in the legacy set below
 * hold 0 records between them — adding one would be a sixth spelling of a
 * thing this system already spells five ways.
 *
 * Product had NO visible end date before this: its only end-date field was
 * suppressed as a legacy duplicate, which is why 6,421 Cancelled records carry
 * no cancellation date at all.
 */
export const PRODUCT_END_DATE_KEY = 'cancellation_date';

/** Section the Product end date belongs to (Zoho-era slug for "Membership & Product"). */
export const PRODUCT_SECTION_KEY = 'insurance';

/**
 * Legacy / duplicate end-date keys that should not appear alongside the
 * canonical per-product fields. Kept in JSONB for imports; hidden in UI.
 *
 * `cancellation_date` is NOT in this set any more — it is the Product card's
 * canonical end date (see PRODUCT_END_DATE_KEY) and is routed by section
 * instead, exactly like sharing_end_date and health_insurance_end_date.
 */
export const LEGACY_DUPLICATE_END_DATE_KEYS = new Set([
  'end_date',
  'termination_date',
  'coverage_end_date',
  'insurance_end_date',
]);

/** End-date keys that drive scheduled membership cancellation (indexed column). */
export const MEMBERSHIP_CANCELLATION_END_DATE_KEYS = [
  'cancellation_date',
  'end_date',
  'termination_date',
  'coverage_end_date',
  'insurance_end_date',
  SHARING_END_DATE_KEY,
] as const;

/** All end-date keys considered when evaluating whether coverage has ended. */
export const ALL_COVERAGE_END_DATE_KEYS = [
  ...MEMBERSHIP_CANCELLATION_END_DATE_KEYS,
  INSURANCE_END_DATE_KEY,
] as const;

export function shouldShowEndDateFieldInSection(
  fieldKey: string,
  sectionKey: string,
): boolean {
  if (fieldKey === PRODUCT_END_DATE_KEY) {
    // Product only. Elsewhere (leads' `system` band, history) it stays the
    // back-office audit stamp it has always been.
    return sectionKey === PRODUCT_SECTION_KEY;
  }
  if (fieldKey === SHARING_END_DATE_KEY) {
    return sectionKey === 'health_sharing';
  }
  if (fieldKey === INSURANCE_END_DATE_KEY) {
    return sectionKey === 'health_insurance';
  }
  if (LEGACY_DUPLICATE_END_DATE_KEYS.has(fieldKey)) {
    return false;
  }
  return true;
}
