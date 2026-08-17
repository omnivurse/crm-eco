/**
 * Carrier-identity fields store an `insurance_carriers.id`, not a crm_records.id.
 * `carrier_id` is still typed as `lookup` in live crm_fields (empty metadata),
 * which made inline editors GET /api/crm/records/<carrier-uuid> and 404.
 */

import type { CrmField, FieldCarrierType } from './types';
import { isInsuranceMarket } from './member-terminology';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CARRIER_TYPE_VALUES = new Set<FieldCarrierType>([
  'insurance',
  'healthshare',
  'dental',
  'vision',
  'life',
  'other',
  'medicaid',
  'short_term',
]);

/** Indexed row column + JSONB twins that hold a carrier UUID. */
export const CARRIER_IDENTITY_KEYS = [
  'carrier_id',
  'sharing_entity',
  'health_insurance_carrier',
  'carrier',
] as const;

export function isCarrierIdentityKey(key: string | null | undefined): boolean {
  return (CARRIER_IDENTITY_KEYS as readonly string[]).includes(key ?? '');
}

export function isCarrierIdentityField(field: Pick<CrmField, 'key' | 'metadata'>): boolean {
  if (field.metadata?.carrier_type) return true;
  return field.key === 'carrier_id';
}

export function resolveInlineCarrierType(
  field: Pick<CrmField, 'key' | 'metadata'>,
  relatedValues?: Record<string, unknown> | null,
): FieldCarrierType {
  const declared = field.metadata?.carrier_type;
  if (declared && CARRIER_TYPE_VALUES.has(declared)) return declared;

  const market = String(relatedValues?.market_type ?? '').trim().toLowerCase();
  if (market === 'healthshare') return 'healthshare';
  if (isInsuranceMarket(market)) return 'insurance';
  if (CARRIER_TYPE_VALUES.has(market as FieldCarrierType)) {
    return market as FieldCarrierType;
  }

  const sharing = relatedValues?.sharing_entity;
  if (sharing != null && String(sharing).trim() !== '') return 'healthshare';

  const insurance = relatedValues?.health_insurance_carrier;
  if (insurance != null && String(insurance).trim() !== '') return 'insurance';

  return field.key === 'carrier_id' ? 'healthshare' : 'insurance';
}

export function looksLikeUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}
