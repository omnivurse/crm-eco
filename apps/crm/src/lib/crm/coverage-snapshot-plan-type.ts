/**
 * Resolve whether the coverage snapshot should read as health-sharing vs
 * insurance. Indexed `market_type` is preferred, but a known insurer on the
 * hero carrier rail must not keep a mis-filed HealthShare banner.
 *
 * Lifecycle status wins when it is type-specific ("Active Insurance Client"
 * vs "Active HS Member") so leftover fields from the other product do not
 * steal the overview.
 */

import {
  classifyCarrierValue,
  isKnownSharingEntity,
} from '@/lib/crm/coverage-carriers';
import type { CoverageSnapshotPlanType } from '@/lib/crm/coverage-snapshot-plan-fields';
import { isActiveCoverageStatus } from '@/lib/crm/member-terminology';
import { normalizeStatusKey, statusLane } from '@/lib/crm/status-lanes';

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

function firstString(values: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = values[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * Type-specific lifecycle spellings only. Generic "Active" / "Enrolled" return
 * null so market_type and carrier heuristics still decide those rows.
 */
export function coverageTypeFromStatus(
  raw: string | null | undefined,
): CoverageSnapshotPlanType | null {
  const key = normalizeStatusKey(raw);
  if (!key) return null;
  if (key.includes('insurance')) return 'insurance';
  if (
    key.includes('hsmember') ||
    key.includes('healthshare') ||
    key.includes('healthsharing') ||
    key.includes('sharingmember')
  ) {
    return 'healthshare';
  }
  return null;
}

function coverageStatusIsActive(raw: string): boolean {
  if (!raw) return false;
  return statusLane(raw) === 'active' || isActiveCoverageStatus(raw);
}

/**
 * Pick insurance vs health-share from contact / coverage statuses.
 * Type-specific contact status wins. Coverage-specific statuses only apply
 * while the contact is still in an active or pending lane — cancelled rows
 * must not flip type from a stale `sharing_status`.
 */
export function coverageTypeFromLifecycle(
  values: Record<string, unknown>,
): CoverageSnapshotPlanType | null {
  const status = firstString(values, ['status', 'contact_status']);
  const fromStatus = coverageTypeFromStatus(status);
  if (fromStatus) return fromStatus;

  const contactLane = statusLane(status);
  if (
    contactLane !== 'active' &&
    contactLane !== 'pending' &&
    !isActiveCoverageStatus(status)
  ) {
    return null;
  }

  const insuranceStatus = firstString(values, ['health_insurance_status']);
  const sharingStatus = firstString(values, ['sharing_status']);
  const insuranceActive = coverageStatusIsActive(insuranceStatus);
  const sharingActive = coverageStatusIsActive(sharingStatus);
  if (insuranceActive && !sharingActive) return 'insurance';
  if (sharingActive && !insuranceActive) return 'healthshare';

  return coverageTypeFromStatus(sharingStatus) ?? coverageTypeFromStatus(insuranceStatus);
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
 *   1. type-specific lifecycle status (Active Insurance Client / Active HS Member);
 *   2. indexed market_type, with conflict override when healthshare + known
 *      insurer hero and no known sharing ministry is present;
 *   3. explicit coverage / product / plan-type field aliases;
 *   4. recognized carrier value on the hero rail;
 *   5. presence heuristic over fields exclusive to one type.
 */
export function resolveCoverageSnapshotPlanType(
  args: ResolveCoverageSnapshotPlanTypeArgs,
): CoverageSnapshotPlanType {
  const { values, heroCarrierValue, hasValue } = args;

  const fromLifecycle = coverageTypeFromLifecycle(values);
  if (fromLifecycle) return fromLifecycle;

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
