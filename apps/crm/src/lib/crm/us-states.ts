/**
 * US states + DC for the CRM's State pickers.
 *
 * Prod (PIFH, 2026-08-17, contacts.mailing_state): the overwhelming majority
 * of stored values are 2-letter codes (CO 2,996 · FL 1,882 · AZ 1,425 …) with
 * a long tail of spelled-out names ("Florida" ×182) from imports. Pickers
 * therefore STORE the code and DISPLAY "CO — Colorado"; a stored value that
 * is not in this list is never rewritten — callers keep it as an extra option
 * (see `usStateOptionsWith`) so nothing the client already has is lost.
 *
 * Pure + client-safe. No I/O.
 */

export interface UsState {
  /** USPS 2-letter code — the value written to the record. */
  code: string;
  name: string;
}

export const US_STATES: readonly UsState[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
] as const;

export const US_STATE_CODES: readonly string[] = US_STATES.map((s) => s.code);

const BY_CODE = new Map(US_STATES.map((s) => [s.code, s]));
const BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s]));

/** "co" / "Colorado" / " CO " → the state; anything else → null. */
export function findUsState(value: string | null | undefined): UsState | null {
  const t = String(value ?? '').trim();
  if (!t) return null;
  return BY_CODE.get(t.toUpperCase()) ?? BY_NAME.get(t.toLowerCase()) ?? null;
}

/** "CO" → "CO — Colorado"; unknown values are shown verbatim. */
export function usStateLabel(value: string): string {
  const s = findUsState(value);
  return s ? `${s.code} — ${s.name}` : value;
}

/**
 * Options for a State `<select>`: every US state + DC, plus the current
 * value as an extra option when it is not a known code (legacy "Florida",
 * a foreign region, …) so the select can render it without rewriting it.
 */
export function usStateOptionsWith(current: string | null | undefined): { value: string; label: string }[] {
  const base = US_STATES.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` }));
  const t = String(current ?? '').trim();
  if (!t || BY_CODE.has(t)) return base;
  return [{ value: t, label: t }, ...base];
}
