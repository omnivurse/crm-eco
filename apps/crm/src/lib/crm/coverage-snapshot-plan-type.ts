/**
 * Resolve whether the coverage snapshot should read as health-sharing vs
 * insurance. Indexed `market_type` is preferred, but a known insurer on the
 * hero carrier rail must not keep a mis-filed HealthShare banner.
 */

import {
  classifyCarrierValue,
  isKnownSharingEntity,
} from '@/lib/crm/coverage-carriers';
import type { CoverageSnapshotPlanType } from '@/lib/crm/coverage-snapshot-plan-fields';

export type { CoverageSnapshotPlanType };

const SHARING_ENTITY_VALUE_KEYS = [
  'sharing_entity',
  'carrier',
  'health_insurance_carrier',
  'insurance_carrier',
  'carrier_name',
] as const;

function hasKnownSharingMinistry(values: Record<string, unknown>): boolean {
  return SHARING_ENTITY_VALUE_KEYS.some((k) => isKnownSharingEntity(values[k]));
}

export interface ResolveCoverageSnapshotPlanTypeArgs {
  values: Record<string, unknown>;
  /** Resolved hero carrier / sharing-entity field value (after identity selection). */
  heroCarrierValue?: unknown;
  hasValue: (key: string) => boolean;
}

/**
 * Classify the record's coverage for Membership Snapshot display.
 *
 * Priority:
 *   1. indexed market_type, with conflict override when healthshare + known
 *      insurer hero and no known sharing ministry is present;
 *   2. explicit coverage / product / plan-type field aliases;
 *   3. recognized carrier value on the hero rail;
 *   4. presence heuristic over fields exclusive to one type.
 */
export function resolveCoverageSnapshotPlanType(
  args: ResolveCoverageSnapshotPlanTypeArgs,
): CoverageSnapshotPlanType {
  const { values, heroCarrierValue, hasValue } = args;

  const market = values.market_type;
  if (market === 'healthshare') {
    // Mis-filed insurer (e.g. "United Healthcare") on a healthshare market_type
    // must not keep the HealthShare banner when no ministry is on the record.
    if (
      classifyCarrierValue(heroCarrierValue) === 'insurance' &&
      !hasKnownSharingMinistry(values)
    ) {
      return 'insurance';
    }
    return 'healthshare';
  }
  if (market === 'traditional_insurance') return 'insurance';

  const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
  for (const k of [
    'coverage_type',
    'plan_type',
    'product_type',
    'product',
    'coverage_category',
  ]) {
    const v = norm(values[k]);
    if (!v) continue;
    if (/\b(share|sharing|health.?share|ministry|hcsm)\b/.test(v)) return 'healthshare';
    if (/\b(insurance|major.?medical|aca|marketplace|traditional|ppo|hmo|epo)\b/.test(v)) {
      return 'insurance';
    }
  }

  const byHero = classifyCarrierValue(heroCarrierValue);
  if (byHero !== 'unknown') return byHero;

  const hasSharing = [
    'monthly_contribution',
    'monthly_share',
    'share_amount',
    'iua_amount',
    'member_tier',
    'sharing_status',
    'sharing_member_id',
  ].some((k) => hasValue(k));
  const hasInsurance = [
    'health_insurance_carrier',
    'insurance_carrier',
    'monthly_premium',
    'health_insurance_plan_name',
    'insurance_plan_name',
    'health_insurance_premium',
    'insurance_premium',
  ].some((k) => hasValue(k));
  if (hasSharing && !hasInsurance) return 'healthshare';
  if (hasInsurance && !hasSharing) return 'insurance';
  return 'unknown';
}
