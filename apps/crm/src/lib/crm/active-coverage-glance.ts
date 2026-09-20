/**
 * Compact "active membership / plan" glance for the Insights rail.
 *
 * Same classification as the overview coverage snapshot: type-specific
 * status (Active Insurance Client vs Active HS Member) picks which product
 * to show. Only active-lane records get a card.
 */

import {
  HEALTHSHARE_HERO_CARRIER_KEYS,
  HEALTHSHARE_HERO_START_DATE_KEYS,
  INSURANCE_HERO_CARRIER_KEYS,
  INSURANCE_HERO_START_DATE_KEYS,
  isAmbiguousCarrierValue,
} from '@/lib/crm/coverage-snapshot-identity';
import {
  coerceCoverageSnapshotFieldValue,
  HEALTH_INSURANCE_PLAN_LABEL,
  MEMBERSHIP_LABEL,
  type CoverageSnapshotPlanType,
} from '@/lib/crm/coverage-snapshot-plan-fields';
import { resolveCoverageSnapshotPlanType } from '@/lib/crm/coverage-snapshot-plan-type';
import { formatCurrencyDisplay } from '@/lib/crm/currency-input';
import { isActiveCoverageStatus } from '@/lib/crm/member-terminology';
import { statusLane } from '@/lib/crm/status-lanes';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INSURANCE_NAME_KEYS = [
  'health_insurance_plan_name',
  'insurance_plan_name',
] as const;

const HEALTHSHARE_NAME_KEYS = ['product', 'plan_name', 'product_type'] as const;

const INSURANCE_AMOUNT_KEYS = [
  'monthly_premium',
  'health_insurance_premium',
  'insurance_premium',
] as const;

const HEALTHSHARE_AMOUNT_KEYS = [
  'monthly_contribution',
  'monthly_share',
  'monthly_amount',
] as const;

export interface ActiveCoverageGlance {
  planType: CoverageSnapshotPlanType;
  eyebrow: string;
  name: string | null;
  carrierLabel: string;
  carrierValue: string | null;
  amountLabel: string | null;
  amountValue: string | null;
  effectiveDate: string | null;
  status: string | null;
}

function firstString(values: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = values[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function hasValue(values: Record<string, unknown>, key: string): boolean {
  const value = values[key];
  return value !== null && value !== undefined && value !== '';
}

function pickName(values: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const display = coerceCoverageSnapshotFieldValue(key, values[key]);
    if (display === null || display === undefined || display === '') continue;
    const text = String(display).trim();
    if (text) return text;
  }
  return null;
}

function pickCarrierName(values: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = values[key];
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (!text || UUID_RE.test(text) || isAmbiguousCarrierValue(text)) continue;
    return text;
  }
  return null;
}

function pickAmount(values: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const formatted = formatCurrencyDisplay(values[key]);
    if (formatted) return formatted;
  }
  return null;
}

function pickDate(values: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = values[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.trim();
    return parsed.toLocaleDateString();
  }
  return null;
}

export function isActiveCoverageLane(status: string | null | undefined): boolean {
  const trimmed = (status ?? '').trim();
  if (!trimmed) return false;
  return statusLane(trimmed) === 'active' || isActiveCoverageStatus(trimmed);
}

/**
 * Build the Insights glance for an active membership / plan. Returns null
 * when the record is not in the active lane, or when type is unknown and
 * there is nothing to show.
 */
export function buildActiveCoverageGlance(
  values: Record<string, unknown>,
): ActiveCoverageGlance | null {
  const status = firstString(values, ['status', 'contact_status']);
  if (!isActiveCoverageLane(status)) return null;

  const planType = resolveCoverageSnapshotPlanType({
    values,
    hasValue: (key) => hasValue(values, key),
  });

  const nameKeys = planType === 'insurance' ? INSURANCE_NAME_KEYS : HEALTHSHARE_NAME_KEYS;
  const carrierKeys =
    planType === 'insurance' ? INSURANCE_HERO_CARRIER_KEYS : HEALTHSHARE_HERO_CARRIER_KEYS;
  const amountKeys = planType === 'insurance' ? INSURANCE_AMOUNT_KEYS : HEALTHSHARE_AMOUNT_KEYS;
  const dateKeys =
    planType === 'insurance' ? INSURANCE_HERO_START_DATE_KEYS : HEALTHSHARE_HERO_START_DATE_KEYS;

  const name = pickName(values, nameKeys);
  const carrierValue = pickCarrierName(values, carrierKeys);
  const amountValue = pickAmount(values, amountKeys);
  const effectiveDate = pickDate(values, dateKeys);

  if (planType === 'unknown' && !name && !carrierValue && !amountValue && !effectiveDate) {
    return null;
  }

  const isInsurance = planType === 'insurance';
  return {
    planType,
    eyebrow: isInsurance ? `Active ${HEALTH_INSURANCE_PLAN_LABEL}` : `Active ${MEMBERSHIP_LABEL}`,
    name,
    carrierLabel: isInsurance ? 'Insurance Carrier' : 'Sharing Entity',
    carrierValue,
    amountLabel: isInsurance ? 'Monthly Premium' : 'Monthly Contribution',
    amountValue,
    effectiveDate,
    status,
  };
}
