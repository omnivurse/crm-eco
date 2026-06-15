/**
 * Health Insurance (major medical) field bridges — mirrors the HealthShare
 * patterns in `lead-contact-sharing-fields.ts` so inline edits on leads,
 * contacts, and members stay in sync with indexed `carrier_id` / `market_type`.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isBlankJsonValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

export const HEALTH_INSURANCE_CARRIER_KEYS = [
  'health_insurance_carrier',
  'insurance_carrier',
] as const;

export function healthInsuranceCarrierAsCarrierId(
  value: unknown,
): string | null {
  if (typeof value !== 'string' || !UUID_RE.test(value.trim())) return null;
  return value.trim();
}

/** Resolve the first populated insurance carrier key from JSONB. */
export function pickHealthInsuranceCarrierValue(
  data: Record<string, unknown> | null | undefined,
): unknown {
  if (!data || typeof data !== 'object') return undefined;
  for (const key of HEALTH_INSURANCE_CARRIER_KEYS) {
    const v = data[key];
    if (!isBlankJsonValue(v)) return v;
  }
  return undefined;
}

export function leadHasHealthInsuranceData(
  data: Record<string, unknown> | null | undefined,
): boolean {
  if (!data || typeof data !== 'object') return false;
  const carrier = pickHealthInsuranceCarrierValue(data);
  if (!isBlankJsonValue(carrier)) return true;
  const keys = [
    'health_insurance_plan_name',
    'health_insurance_premium',
    'health_insurance_start_date',
    'health_insurance_end_date',
    'health_insurance_status',
    'health_insurance_deductible',
    'health_insurance_max_out_of_pocket',
  ];
  return keys.some((k) => !isBlankJsonValue(data[k]));
}

/**
 * When indexed `carrier_id` is set for an insurance-market record but JSONB
 * `health_insurance_carrier` is blank, bridge for inline carrier editors.
 */
export function bridgeIndexedCarrierIdToHealthInsuranceCarrier(
  base: Record<string, unknown>,
  moduleKey?: string | null,
): void {
  if (moduleKey !== 'contacts' && moduleKey !== 'leads' && moduleKey !== 'members') return;
  if (!isBlankJsonValue(base.health_insurance_carrier)) return;
  if (isBlankJsonValue(base.carrier_id)) return;
  if (base.market_type === 'healthshare') return;
  base.health_insurance_carrier = base.carrier_id;
}

/** Apply all read-path bridges for Health Insurance on person modules. */
export function bridgeHealthInsuranceReadPaths(
  base: Record<string, unknown>,
  moduleKey?: string | null,
): void {
  bridgeIndexedCarrierIdToHealthInsuranceCarrier(base, moduleKey);
}
