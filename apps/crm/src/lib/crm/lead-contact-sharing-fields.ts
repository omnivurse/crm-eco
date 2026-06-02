/**
 * Health Share / Sharing Information field keys shared between Leads and Contacts.
 * Leads store these in the `health_sharing` section; Contacts may also have legacy
 * `carrier` (insurance section) from Zoho imports.
 */

export const HEALTH_SHARING_DATA_KEYS = [
  'sharing_entity',
  'member_tier',
  'monthly_contribution',
  'iua_amount',
  'sharing_effective_date',
  'sharing_status',
  'sharing_member_id',
  'previous_membership',
] as const;

export type HealthSharingDataKey = (typeof HEALTH_SHARING_DATA_KEYS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isBlankJsonValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
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
 */
export function bridgeLegacyCarrierToSharingEntity(
  base: Record<string, unknown>,
  moduleKey?: string | null,
): void {
  if (moduleKey !== 'contacts' && moduleKey !== 'members') return;
  if (!isBlankJsonValue(base.sharing_entity) || isBlankJsonValue(base.carrier)) return;
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

/** Apply all read-path bridges for Health Sharing on person modules. */
export function bridgeSharingEntityReadPaths(
  base: Record<string, unknown>,
  moduleKey?: string | null,
): void {
  bridgeLegacyCarrierToSharingEntity(base, moduleKey);
  bridgeIndexedCarrierIdToSharingEntity(base, moduleKey);
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
