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

/**
 * Distinctive stems matched as substrings AFTER the exact lists above miss.
 *
 * The exact lists were seeded from `crm_fields.options`, but reps and the Zoho
 * import write free text, so live `data->>'carrier'` holds variants the exact
 * sets never match: "BC/BS", "BCBSFL", "Anthem BCBS - Georgia", "Coventry",
 * "CO Health OP", "Ambetter", "Sedera HealthShare", "Liberty HealthShare".
 *
 * Before these stems existed, an unmatched insurer fell through
 * `bridgeLegacyCarrierToSharingEntity` and was displayed as a health-share
 * "Sharing Entity" — mislabeling ~246 major-medical records as ministries.
 *
 * Keep stems long enough to be unambiguous: `libertyhealthshare`, not
 * `liberty` (which would swallow Liberty Mutual).
 */
const INSURANCE_STEMS = [
  'bcbs',
  'bluecross',
  'blueshield',
  'anthem',
  'cigna',
  'aetna',
  'humana',
  'kaiser',
  'unitedhealth',
  'molina',
  'ambetter',
  'centene',
  'coventry',
  'oscar',
  'brighthealth',
  'floridablue',
  'selecthealth',
  'rmhp',
  'healthop',
] as const;

const SHARING_STEMS = [
  'sedera',
  'zionhealth',
  'libertyhealthshare',
  'mpowering',
  'mpb',
  'knewhealth',
  'altrua',
  'oneshare',
  'solidarity',
  'samaritan',
  'christianhealthcare',
  'chministries',
] as const;

/**
 * Collapse case, whitespace, and punctuation so free-text variants match the
 * canonical lists (e.g. "United Healthcare" ≡ "UnitedHealthcare").
 */
export function normalizeCarrierMatchKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const INSURANCE_SET = new Set<string>(
  KNOWN_INSURANCE_CARRIERS.map((c) => normalizeCarrierMatchKey(c)),
);
const SHARING_SET = new Set<string>(
  KNOWN_SHARING_ENTITIES.map((c) => normalizeCarrierMatchKey(c)),
);

/** True when the value matches a known major-medical insurance carrier. */
export function isKnownInsuranceCarrier(value: unknown): boolean {
  const n = normalizeCarrierMatchKey(value);
  if (n.length === 0) return false;
  if (INSURANCE_SET.has(n)) return true;
  // Free-text variant ("BC/BS", "Anthem BCBS - Georgia") — fall back to stems,
  // but never claim a value the sharing list already owns exactly.
  if (SHARING_SET.has(n)) return false;
  return INSURANCE_STEMS.some((stem) => n.includes(stem));
}

/** True when the value matches a known health-sharing ministry. */
export function isKnownSharingEntity(value: unknown): boolean {
  const n = normalizeCarrierMatchKey(value);
  if (n.length === 0) return false;
  if (SHARING_SET.has(n)) return true;
  if (INSURANCE_SET.has(n)) return false;
  // Insurance stems win ties so "Anthem BCBS" never reads as a ministry.
  if (INSURANCE_STEMS.some((stem) => n.includes(stem))) return false;
  return SHARING_STEMS.some((stem) => n.includes(stem));
}

export type CarrierClass = 'insurance' | 'healthshare' | 'unknown';

/**
 * Classify a carrier / entity string as insurance vs health-sharing. Returns
 * `'unknown'` for blank values or names that aren't in either canonical list
 * (e.g. a free-text carrier the rep typed by hand).
 */
export function classifyCarrierValue(value: unknown): CarrierClass {
  const n = normalizeCarrierMatchKey(value);
  if (!n) return 'unknown';
  if (INSURANCE_SET.has(n)) return 'insurance';
  if (SHARING_SET.has(n)) return 'healthshare';
  if (isKnownInsuranceCarrier(value)) return 'insurance';
  if (isKnownSharingEntity(value)) return 'healthshare';
  return 'unknown';
}
