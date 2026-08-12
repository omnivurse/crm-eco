/**
 * Phone ownership helpers — companion `*_owner` / `*_owner_name` keys on
 * crm_records.data so dialable phone values stay digits-only.
 */

/** Phone field keys that may have a sibling owner select. */
export const PHONE_KEYS_WITH_OWNER = new Set([
  'phone',
  'mobile',
  'phone2',
  'mobile_2',
  'work_phone',
]);

export const PHONE_OWNER_OPTIONS = [
  'Self',
  'Spouse / Partner',
  'Parent / Guardian',
  'Child / Dependent',
  'Other',
] as const;

export type PhoneOwnerOption = (typeof PHONE_OWNER_OPTIONS)[number];

/** Digits / common phone punctuation only (no letters). Empty allowed separately. */
export const PHONE_VALUE_REGEX = /^[\d\s\-\+\(\)]+$/;

export function phoneOwnerFieldKey(phoneKey: string): string {
  return `${phoneKey}_owner`;
}

export function phoneOwnerNameFieldKey(phoneKey: string): string {
  return `${phoneKey}_owner_name`;
}

/**
 * Build a compact "Spouse / Partner · Alex" label from sibling values.
 * Returns null when nothing is set (no badge).
 */
export function formatPhoneOwnerLabel(
  phoneKey: string,
  values?: Record<string, unknown> | null,
): string | null {
  if (!values || !PHONE_KEYS_WITH_OWNER.has(phoneKey)) return null;
  const ownerRaw = values[phoneOwnerFieldKey(phoneKey)];
  const nameRaw = values[phoneOwnerNameFieldKey(phoneKey)];
  const owner = typeof ownerRaw === 'string' ? ownerRaw.trim() : '';
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
  if (!owner && !name) return null;
  if (owner && name) return `${owner} · ${name}`;
  return owner || name;
}

export function isCleanPhoneValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PHONE_VALUE_REGEX.test(trimmed);
}
