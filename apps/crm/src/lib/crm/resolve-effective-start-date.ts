import { normalizeDateColumnValue } from './merge-crm-data-json-to-row';

/** CRM row statuses that mean “waiting for coverage to begin”. */
export const PENDING_CONTACT_STATUSES = [
  'Pending',
  'Pending HS Member',
  'Pending Member',
  'Enrolled',
  'Enrolled - Pending Start',
  'Approved Pending',
] as const;

/**
 * Map market_type → active status after the start date arrives.
 *
 * Every market resolves to the SAME lifecycle value. The market itself is
 * already recorded in `market_type`, so encoding it a second time in the
 * status produced "Active HS Member" / "Active Insurance Client" — variants
 * that meant exactly "Active" but broke every filter, badge and count that
 * compared against it. Status answers "what state is this record in";
 * `market_type` answers "what kind of coverage".
 */
export const ACTIVE_STATUS_BY_MARKET: Record<string, string> = {
  healthshare: 'Active',
  traditional_insurance: 'Active',
};

const JSONB_START_DATE_KEYS = [
  'current_year_start_date',
  'original_start_date',
  'start_date',
  'sharing_effective_date',
  'insurance_effective_date',
  'health_insurance_start_date',
  'effective_date',
  'vision_start_date',
  'dental_start_date',
] as const;

export type CrmRecordStartDateInput = {
  current_year_start_date?: string | null;
  original_start_date?: string | null;
  data?: Record<string, unknown> | null;
};

/**
 * Resolve the effective coverage start date for a CRM contact/member.
 * Prefers indexed columns, then common JSONB date fields (including legacy
 * `start_date` from the insurance section).
 */
export function resolveEffectiveStartDate(record: CrmRecordStartDateInput): string | null {
  const columnDate =
    normalizeDateColumnValue(record.current_year_start_date) ??
    normalizeDateColumnValue(record.original_start_date);
  if (columnDate) return columnDate;

  const data = record.data;
  if (!data || typeof data !== 'object') return null;

  for (const key of JSONB_START_DATE_KEYS) {
    const normalized = normalizeDateColumnValue(data[key]);
    if (normalized) return normalized;
  }

  return null;
}

/**
 * Active status to apply once the start date has arrived.
 *
 * `marketType` is the primary signal. `oldStatus` is a fallback so a record
 * whose pending status already carries the HealthShare taxonomy
 * (e.g. 'Pending HS Member') stays in it even when `market_type` is null —
 * otherwise it would silently demote to a plain 'Active'.
 */
export function resolveActiveStatusForMarket(
  marketType: string | null | undefined,
  oldStatus?: string | null,
): string {
  const normalizedMarket = (marketType ?? '').trim().toLowerCase();
  if (normalizedMarket === 'insurance') {
    return ACTIVE_STATUS_BY_MARKET.traditional_insurance;
  }
  if (normalizedMarket && ACTIVE_STATUS_BY_MARKET[normalizedMarket]) {
    return ACTIVE_STATUS_BY_MARKET[normalizedMarket];
  }
  // Legacy inbound spellings all resolve to the one canonical value; the
  // market/product taxonomy they used to carry lives in `market_type`.
  return 'Active';
}
