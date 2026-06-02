/** Inclusive bounds for CRM DOB / birth-date fields (HTML date inputs + validation). */
export const CRM_DATE_INPUT_MIN = '1900-01-01';
export const CRM_DATE_INPUT_MAX = '2100-12-31';

const COMPLETE_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when a native date input value is a complete yyyy-MM-dd string. */
export function isCompleteIsoDateInputValue(value: string): boolean {
  return COMPLETE_ISO_DATE_RE.test(value);
}

/** Format ISO yyyy-MM-dd for typed entry (M/D/YYYY — no leading-zero friction). */
export function isoDateToTypedEntryDisplay(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
}

/** Seed the text editor from any stored CRM date value. */
export function dateValueToTypedEntryDraft(value: string | null | undefined): string {
  if (!value) return '';
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  if (iso) return isoDateToTypedEntryDisplay(iso);
  return value.trim();
}
