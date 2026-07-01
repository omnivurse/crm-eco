/** Canonical end-date field keys for HealthShare vs major medical coverage. */

export const SHARING_END_DATE_KEY = 'sharing_end_date';
export const INSURANCE_END_DATE_KEY = 'health_insurance_end_date';

/**
 * Legacy / duplicate end-date keys that should not appear alongside the
 * canonical per-product fields. Kept in JSONB for imports; hidden in UI.
 */
export const LEGACY_DUPLICATE_END_DATE_KEYS = new Set([
  'cancellation_date',
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
