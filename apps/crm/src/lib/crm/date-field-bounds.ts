/** Inclusive bounds for CRM DOB / birth-date fields (HTML date inputs + validation). */
export const CRM_DATE_INPUT_MIN = '1900-01-01';
export const CRM_DATE_INPUT_MAX = '2100-12-31';

const COMPLETE_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when a native date input value is a complete yyyy-MM-dd string. */
export function isCompleteIsoDateInputValue(value: string): boolean {
  return COMPLETE_ISO_DATE_RE.test(value);
}
