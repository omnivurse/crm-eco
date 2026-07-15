/**
 * Canonical carrier-name lists used to tell a health-INSURANCE carrier
 * (Cigna, Aetna, …) apart from a health-SHARING ministry (Sedera, Zion
 * Health, …).
 *
 * These mirror the seeded `crm_fields.options` for `health_insurance_carrier`
 * (supabase/migrations_archive/202605060001_crm_health_insurance_section.sql)
 * and `sharing_entity`
 * (supabase/migrations_archive/202605200001_carrier_schema_alignment.sql).
 * Kept in sync intentionally so the legacy read bridge and the Membership
 * Snapshot never label an insurer as a "Sharing Entity".
 */

/** Major-medical / ACA insurers. Excludes the ambiguous "Other". */
export const KNOWN_INSURANCE_CARRIERS = [
  'Anthem',
  'Cigna',
  'Kaiser',
  'UnitedHealthcare',
  'Aetna',
  'Humana',
  'Blue Cross',
  'Oscar',
  'Molina',
  'Centene/Ambetter',
  'Florida Blue',
  'Select Health',
  'RMHP',
  'Bright Health',
  'Bright HealthCare',
] as const;

/** Health-sharing ministries. Excludes the ambiguous "Other". */
export const KNOWN_SHARING_ENTITIES = [
  'Sedera',
  'Zion Health',
  'MPB',
  'Knew Health',
  'Altrua',
  'Impact',
  'OneShare',
  'Solidarity',
] as const;

const INSURANCE_SET = new Set<string>(
  KNOWN_INSURANCE_CARRIERS.map((c) => c.toLowerCase()),
);
const SHARING_SET = new Set<string>(
  KNOWN_SHARING_ENTITIES.map((c) => c.toLowerCase()),
);

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** True when the value matches a known major-medical insurance carrier. */
export function isKnownInsuranceCarrier(value: unknown): boolean {
  return INSURANCE_SET.has(normalize(value));
}

/** True when the value matches a known health-sharing ministry. */
export function isKnownSharingEntity(value: unknown): boolean {
  return SHARING_SET.has(normalize(value));
}

export type CarrierClass = 'insurance' | 'healthshare' | 'unknown';

/**
 * Classify a carrier / entity string as insurance vs health-sharing. Returns
 * `'unknown'` for blank values or names that aren't in either canonical list
 * (e.g. a free-text carrier the rep typed by hand).
 */
export function classifyCarrierValue(value: unknown): CarrierClass {
  const n = normalize(value);
  if (!n) return 'unknown';
  if (INSURANCE_SET.has(n)) return 'insurance';
  if (SHARING_SET.has(n)) return 'healthshare';
  return 'unknown';
}
