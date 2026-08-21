/**
 * One address on the card — Zoho `mailing_*`, E123 `address_line1`, and the
 * lead `street` family are the same mailbox wearing three names.
 *
 * Storage keys stay in JSONB (imports, twins, search still write them).
 * The form shows the module's canonical slot labeled Street / City / State / Zip
 * and hides an alias when it is blank or equal. A real disagreement (house vs
 * PO Box) stays visible so concierge can see both.
 *
 * Pure module — no React, no Supabase.
 */

export type AddressSlot = 'line1' | 'city' | 'state' | 'zip';

const LINE1_KEYS = ['street', 'mailing_street', 'address_line1'] as const;
const CITY_KEYS = ['city', 'mailing_city'] as const;
const STATE_KEYS = ['state', 'mailing_state'] as const;
const ZIP_KEYS = ['zip_code', 'mailing_zip', 'postal_code', 'zip'] as const;

const SLOT_KEYS: Record<AddressSlot, readonly string[]> = {
  line1: LINE1_KEYS,
  city: CITY_KEYS,
  state: STATE_KEYS,
  zip: ZIP_KEYS,
};

/** Product labels — not "Mailing Street" vs "Street" for the same line. */
export const ADDRESS_SLOT_LABELS: Record<AddressSlot, string> = {
  line1: 'Street',
  city: 'City',
  state: 'State',
  zip: 'Zip',
};

/**
 * Canonical storage key per people-module. Matches live `crm_fields`:
 * contacts → Zoho mailing family; leads → street family; members → E123 lines.
 */
const CANONICAL_BY_MODULE: Record<string, Record<AddressSlot, string>> = {
  contacts: {
    line1: 'mailing_street',
    city: 'mailing_city',
    state: 'mailing_state',
    zip: 'mailing_zip',
  },
  leads: {
    line1: 'street',
    city: 'city',
    state: 'state',
    zip: 'zip_code',
  },
  members: {
    line1: 'address_line1',
    city: 'city',
    state: 'state',
    zip: 'zip_code',
  },
};

const KEY_TO_SLOT = new Map<string, AddressSlot>();
for (const [slot, keys] of Object.entries(SLOT_KEYS) as [AddressSlot, readonly string[]][]) {
  for (const key of keys) KEY_TO_SLOT.set(key, slot);
}

export function addressSlotForKey(key: string): AddressSlot | null {
  return KEY_TO_SLOT.get(key) ?? null;
}

export function canonicalAddressKey(
  moduleKey: string | null | undefined,
  slot: AddressSlot,
): string | null {
  if (!moduleKey) return null;
  return CANONICAL_BY_MODULE[moduleKey]?.[slot] ?? null;
}

export function isAddressAliasKey(key: string): boolean {
  return KEY_TO_SLOT.has(key);
}

export function isAddressLineListColumnKey(key: string): boolean {
  return KEY_TO_SLOT.get(key) === 'line1';
}

export function cleanAddressValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().replace(/\s+/g, ' ');
  return s.length > 0 ? s : null;
}

export function addressValuesMatch(a: unknown, b: unknown): boolean {
  const left = cleanAddressValue(a);
  const right = cleanAddressValue(b);
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

export interface AddressFieldVisibilityArgs {
  fieldKey: string;
  moduleKey?: string | null;
  values?: Record<string, unknown> | null;
}

/**
 * Canonical slot always shows. Aliases hide when blank or equal to canonical.
 * A populated alias with a blank canonical stays (the value would otherwise
 * vanish on a module that only defined the leftover key).
 */
export function shouldShowAddressFieldInForm(
  args: AddressFieldVisibilityArgs,
): boolean {
  const slot = addressSlotForKey(args.fieldKey);
  if (!slot) return true;

  const canonical = canonicalAddressKey(args.moduleKey, slot);
  if (!canonical) return true;
  if (args.fieldKey === canonical) return true;

  const values = args.values && typeof args.values === 'object' ? args.values : {};
  const aliasVal = cleanAddressValue(values[args.fieldKey]);
  if (!aliasVal) return false;
  const canonVal = cleanAddressValue(values[canonical]);
  if (canonVal && addressValuesMatch(canonVal, aliasVal)) return false;
  return true;
}

/** Street / City / State / Zip on the canonical slot; leftover names only when they disagree. */
export function addressFormLabel(
  fieldKey: string,
  moduleKey?: string | null,
  originalLabel?: string,
): string {
  const slot = addressSlotForKey(fieldKey);
  if (!slot) return originalLabel ?? fieldKey;
  const canonical = canonicalAddressKey(moduleKey, slot);
  if (canonical && fieldKey === canonical) return ADDRESS_SLOT_LABELS[slot];
  return originalLabel ?? fieldKey;
}

export function preferredAddressLineListColumnKey(
  availableKeys: ReadonlySet<string>,
): string | null {
  for (const key of ['mailing_street', 'street', 'address_line1'] as const) {
    if (availableKeys.has(key)) return key;
  }
  return null;
}

/** Keep the first line-1 column; drop later Zoho/E123 aliases. */
export function collapseAddressListColumns(columns: readonly string[]): string[] {
  let seenLine = false;
  const out: string[] = [];
  for (const col of columns) {
    if (isAddressLineListColumnKey(col)) {
      if (seenLine) continue;
      seenLine = true;
    }
    out.push(col);
  }
  return out;
}
