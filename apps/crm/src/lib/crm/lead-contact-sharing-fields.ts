/**
 * Health Share / Sharing Information field keys shared between Leads and Contacts.
 * Leads store these in the `health_sharing` section; Contacts may also have legacy
 * `carrier` (insurance section) from Zoho imports.
 *
 * Zoho-era contacts often store call-critical values under legacy keys
 * (`e123_member_id`, `start_date`, `monthly_premium`, `contact_status`) while the
 * CRM form reads canonical Health Share keys. Read-path bridges below project
 * legacy → canonical so the detail UI shows stored truth without inventing data.
 */

import { isKnownInsuranceCarrier } from './coverage-carriers';
import { HEALTHSHARE_CONTRIBUTION_KEYS } from './premium-field-aliases';

export const HEALTH_SHARING_DATA_KEYS = [
  'sharing_entity',
  'member_tier',
  'monthly_contribution',
  'iua_amount',
  'sharing_effective_date',
  'sharing_end_date',
  'sharing_status',
  'sharing_member_id',
  'previous_membership',
] as const;

export type HealthSharingDataKey = (typeof HEALTH_SHARING_DATA_KEYS)[number];

/** Legacy member-id keys that should surface as `sharing_member_id`. */
export const SHARING_MEMBER_ID_LEGACY_KEYS = [
  'sharing_member_id',
  'e123_member_id',
  'member_number',
] as const;

/** Legacy effective-date keys that should surface as `sharing_effective_date`. */
export const SHARING_EFFECTIVE_DATE_LEGACY_KEYS = [
  'sharing_effective_date',
  'start_date',
  'original_start_date',
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isBlankJsonValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function firstNonBlank(
  data: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    const value = data[key];
    if (!isBlankJsonValue(value)) return value;
  }
  return undefined;
}

/**
 * True when this row should receive Health Share legacy→canonical projection.
 * Never project onto traditional insurance rows (keeps Heidi-style major-medical
 * profiles from growing a fake Health Share section).
 */
export function shouldProjectHealthSharingLegacyFields(
  base: Record<string, unknown>,
): boolean {
  const market = base.market_type;
  if (market === 'healthshare') return true;
  if (
    market === 'traditional_insurance' ||
    market === 'health_insurance' ||
    market === 'insurance'
  ) {
    return false;
  }
  // Unknown / blank market: only project when clear HS signals exist.
  return (
    !isBlankJsonValue(base.iua_amount) ||
    !isBlankJsonValue(base.sharing_entity) ||
    !isBlankJsonValue(base.member_tier) ||
    !isBlankJsonValue(base.sharing_member_id)
  );
}

function fillIfBlank(
  base: Record<string, unknown>,
  canonicalKey: string,
  value: unknown,
): void {
  if (!isBlankJsonValue(base[canonicalKey]) || isBlankJsonValue(value)) return;
  base[canonicalKey] = value;
}

/** Extract non-blank health-sharing keys from a lead JSONB payload. */
export function pickHealthSharingFieldsFromData(
  source: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!source || typeof source !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const key of HEALTH_SHARING_DATA_KEYS) {
    const value = source[key];
    if (!isBlankJsonValue(value)) out[key] = value;
  }
  return out;
}

/**
 * Overlay lead sharing fields onto contact data without clobbering populated
 * contact values (used by conversion merge and optional backfills).
 */
export function mergeHealthSharingIntoContactData(
  existing: Record<string, unknown>,
  fromLead: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };
  for (const [key, leadValue] of Object.entries(fromLead)) {
    if (isBlankJsonValue(merged[key])) {
      merged[key] = leadValue;
    }
  }
  return merged;
}

/**
 * Contacts imported from Zoho often have `carrier` (text) while the CRM UI
 * edits `sharing_entity`. Bridge reads so the Health Sharing section shows data.
 *
 * A legacy `carrier` that is actually a major-medical insurer (e.g. "Cigna")
 * must NOT surface as a health-share "Sharing Entity" — that mixes insurance
 * and health sharing. Route recognized insurers to `health_insurance_carrier`
 * instead; only genuine ministries / unknown carriers fall through to
 * `sharing_entity`.
 */
export function bridgeLegacyCarrierToSharingEntity(
  base: Record<string, unknown>,
  moduleKey?: string | null,
): void {
  if (moduleKey !== 'contacts' && moduleKey !== 'members') return;
  if (isBlankJsonValue(base.carrier)) return;

  if (isKnownInsuranceCarrier(base.carrier)) {
    if (isBlankJsonValue(base.health_insurance_carrier)) {
      base.health_insurance_carrier = base.carrier;
    }
    return;
  }

  if (!isBlankJsonValue(base.sharing_entity)) return;
  base.sharing_entity = base.carrier;
}

/**
 * Lead conversion and PATCH sync often stamp `carrier_id` on the indexed row
 * while JSONB `sharing_entity` is still blank. Inline carrier editors read
 * `sharing_entity`, so bridge the UUID for display and saves.
 */
export function bridgeIndexedCarrierIdToSharingEntity(
  base: Record<string, unknown>,
  moduleKey?: string | null,
): void {
  if (moduleKey !== 'contacts' && moduleKey !== 'members') return;
  if (!isBlankJsonValue(base.sharing_entity) || isBlankJsonValue(base.carrier_id)) return;
  base.sharing_entity = base.carrier_id;
}

/**
 * Project Zoho legacy coverage keys onto canonical Health Share form keys.
 * Mutates `base` in place. Safe to call repeatedly; never overwrites non-blank
 * canonical values. Gated so traditional-insurance rows are untouched.
 */
export function bridgeLegacyHealthSharingReadPaths(
  base: Record<string, unknown>,
  moduleKey?: string | null,
): void {
  if (moduleKey !== 'contacts' && moduleKey !== 'members' && moduleKey !== 'leads') {
    return;
  }
  if (!shouldProjectHealthSharingLegacyFields(base)) return;

  fillIfBlank(
    base,
    'sharing_member_id',
    firstNonBlank(base, SHARING_MEMBER_ID_LEGACY_KEYS),
  );

  fillIfBlank(
    base,
    'sharing_effective_date',
    firstNonBlank(base, SHARING_EFFECTIVE_DATE_LEGACY_KEYS),
  );

  // Contribution: dedicated HS keys first; for healthshare market, Zoho often
  // stored the share amount in overloaded `monthly_premium`.
  const contribution = firstNonBlank(base, HEALTHSHARE_CONTRIBUTION_KEYS);
  if (!isBlankJsonValue(contribution)) {
    fillIfBlank(base, 'monthly_contribution', contribution);
  } else if (
    base.market_type === 'healthshare' &&
    !isBlankJsonValue(base.monthly_premium)
  ) {
    // Only use monthly_premium when no dedicated insurance premium sibling
    // is also present (those rows are dual-coverage and keep premium separate).
    const hasDedicatedPremium =
      !isBlankJsonValue(base.health_insurance_premium) ||
      !isBlankJsonValue(base.insurance_premium);
    if (!hasDedicatedPremium) {
      fillIfBlank(base, 'monthly_contribution', base.monthly_premium);
    }
  }

  // Status: HS form field vs Zoho contact_status ("Active HS Member").
  if (isBlankJsonValue(base.sharing_status) && !isBlankJsonValue(base.contact_status)) {
    base.sharing_status = base.contact_status;
  }
}

/**
 * Build a JSONB patch of canonical Health Share keys that are blank on `data`
 * but recoverable from legacy keys. Used by idempotent backfills and tests.
 * Returns null when nothing would change.
 */
export function buildHealthSharingCanonicalBackfillPatch(
  data: Record<string, unknown> | null | undefined,
  options?: { marketType?: string | null; moduleKey?: string | null },
): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const base: Record<string, unknown> = {
    ...data,
    market_type: options?.marketType ?? data.market_type,
  };
  const moduleKey = options?.moduleKey ?? 'contacts';
  bridgeLegacyHealthSharingReadPaths(base, moduleKey);
  bridgeLegacyCarrierToSharingEntity(base, moduleKey);

  const patch: Record<string, unknown> = {};
  for (const key of HEALTH_SHARING_DATA_KEYS) {
    if (isBlankJsonValue(data[key]) && !isBlankJsonValue(base[key])) {
      patch[key] = base[key];
    }
  }
  if (
    isBlankJsonValue(data.health_insurance_carrier) &&
    !isBlankJsonValue(base.health_insurance_carrier) &&
    isKnownInsuranceCarrier(data.carrier)
  ) {
    patch.health_insurance_carrier = base.health_insurance_carrier;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Apply all read-path bridges for Health Sharing on person modules. */
export function bridgeSharingEntityReadPaths(
  base: Record<string, unknown>,
  moduleKey?: string | null,
): void {
  bridgeLegacyCarrierToSharingEntity(base, moduleKey);
  bridgeIndexedCarrierIdToSharingEntity(base, moduleKey);
  bridgeLegacyHealthSharingReadPaths(base, moduleKey);
}

export function sharingEntityAsCarrierId(
  sharingEntity: unknown,
): string | null {
  if (typeof sharingEntity !== 'string' || !UUID_RE.test(sharingEntity.trim())) {
    return null;
  }
  return sharingEntity.trim();
}

export function leadHasHealthSharingData(
  data: Record<string, unknown> | null | undefined,
): boolean {
  return Object.keys(pickHealthSharingFieldsFromData(data)).length > 0;
}
