/**
 * Hide overlapping ownership alias fields in forms / sections / lists.
 *
 * Imports still write `advisor`, `agent`, `producer_name`, etc. into JSONB.
 * Those keys stay in `crm_fields`; the UI shows one editable "Enrolled by"
 * (canonical) and only surfaces an alias when it disagrees or is the only
 * populated human name. `owner_id` (CRM assignee) is never treated as an alias.
 *
 * Pure module — no React, no Supabase.
 */

import { ENROLLED_BY_LABEL } from '@/lib/crm/coverage-snapshot-plan-fields';
import {
  OWNERSHIP_DATA_KEYS,
  cleanOwnershipValue,
} from '@/lib/crm/ownership-name';

/** Editable enrolled-by key: contacts/members `producer_name`, leads `producer`. */
export function canonicalEnrolledByKey(
  moduleKey?: string | null,
): 'producer' | 'producer_name' {
  return moduleKey === 'leads' ? 'producer' : 'producer_name';
}

/** Human-entered aliases that duplicate enrolled-by. Not `owner_id`. */
export const OWNERSHIP_ALIAS_KEYS = [
  'advisor',
  'advisor_name',
  'agent',
  'producer',
  'producer_name',
  'lead_owner',
  'contact_owner',
] as const;

export const NORMALIZED_OWNERSHIP_KEYS = [
  'normalized_advisor_name',
  'normalized_agent_name',
] as const;

const OWNERSHIP_ALIAS_SET = new Set<string>(OWNERSHIP_ALIAS_KEYS);
const NORMALIZED_SET = new Set<string>(NORMALIZED_OWNERSHIP_KEYS);

export function isOwnershipAliasKey(
  key: string,
): key is (typeof OWNERSHIP_ALIAS_KEYS)[number] {
  return OWNERSHIP_ALIAS_SET.has(key);
}

export function isNormalizedOwnershipKey(
  key: string,
): key is (typeof NORMALIZED_OWNERSHIP_KEYS)[number] {
  return NORMALIZED_SET.has(key);
}

/** List columns that all mean "who enrolled" and should collapse to one. */
export function isOwnershipListColumnKey(key: string): boolean {
  return OWNERSHIP_ALIAS_SET.has(key) || NORMALIZED_SET.has(key);
}

export function ownershipValuesMatch(a: unknown, b: unknown): boolean {
  const left = cleanOwnershipValue(a);
  const right = cleanOwnershipValue(b);
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

function preferredNormalizedKey(
  marketType?: string | null,
): (typeof NORMALIZED_OWNERSHIP_KEYS)[number] {
  if (
    marketType === 'traditional_insurance' ||
    marketType === 'health_insurance' ||
    marketType === 'insurance'
  ) {
    return 'normalized_agent_name';
  }
  return 'normalized_advisor_name';
}

function shouldShowNormalizedOwnershipField(
  fieldKey: (typeof NORMALIZED_OWNERSHIP_KEYS)[number],
  values: Record<string, unknown>,
  marketType?: string | null,
  canonicalValue?: string | null,
): boolean {
  const advisor = cleanOwnershipValue(values.normalized_advisor_name);
  const agent = cleanOwnershipValue(values.normalized_agent_name);
  const thisVal = fieldKey === 'normalized_advisor_name' ? advisor : agent;
  if (!thisVal) return false;

  const otherVal = fieldKey === 'normalized_advisor_name' ? agent : advisor;

  // Matching the visible enrolled-by name is a duplicate of the canonical field.
  if (canonicalValue && ownershipValuesMatch(thisVal, canonicalValue)) {
    if (!otherVal || ownershipValuesMatch(thisVal, otherVal)) return false;
    // The pair disagrees: keep the one that is NOT the canonical duplicate.
    return false;
  }

  if (!otherVal) return true;

  if (ownershipValuesMatch(thisVal, otherVal)) {
    return fieldKey === preferredNormalizedKey(marketType);
  }

  // They differ — never hide both. Show this one (the sibling also returns true).
  return true;
}

export interface OwnershipFieldVisibilityArgs {
  fieldKey: string;
  moduleKey?: string | null;
  values?: Record<string, unknown> | null;
  marketType?: string | null;
}

/**
 * Whether a field should appear in the record form / section card.
 * Canonical enrolled-by is always shown (the editable slot). Empty aliases
 * and aliases that match the canonical value are hidden. Disagreeing aliases
 * stay visible so a human can pick. `owner_id` is never hidden here.
 */
export function shouldShowOwnershipFieldInForm(
  args: OwnershipFieldVisibilityArgs,
): boolean {
  const { fieldKey, moduleKey } = args;
  if (fieldKey === 'owner_id') return true;
  if (!isOwnershipAliasKey(fieldKey) && !isNormalizedOwnershipKey(fieldKey)) {
    return true;
  }

  const values = args.values && typeof args.values === 'object' ? args.values : {};
  const marketType =
    args.marketType ??
    (typeof values.market_type === 'string' ? values.market_type : null);
  const canonical = canonicalEnrolledByKey(moduleKey);
  const canonicalValue = cleanOwnershipValue(values[canonical]);

  if (fieldKey === canonical) return true;

  if (isNormalizedOwnershipKey(fieldKey)) {
    return shouldShowNormalizedOwnershipField(
      fieldKey,
      values,
      marketType,
      canonicalValue,
    );
  }

  const aliasVal = cleanOwnershipValue(values[fieldKey]);
  if (!aliasVal) return false;
  if (canonicalValue && ownershipValuesMatch(canonicalValue, aliasVal)) {
    return false;
  }
  return true;
}

/**
 * The one human field that should wear {@link ENROLLED_BY_LABEL}.
 * Canonical when present in the form; otherwise the first visible alias
 * (so a lead with only `advisor` filled still reads "Enrolled by").
 */
export function isVisibleEnrolledByField(
  fieldKey: string,
  moduleKey?: string | null,
  values?: Record<string, unknown> | null,
): boolean {
  if (isNormalizedOwnershipKey(fieldKey)) return false;
  if (!isOwnershipAliasKey(fieldKey) && fieldKey !== canonicalEnrolledByKey(moduleKey)) {
    return false;
  }
  if (
    !shouldShowOwnershipFieldInForm({
      fieldKey,
      moduleKey,
      values,
    })
  ) {
    return false;
  }
  const canonical = canonicalEnrolledByKey(moduleKey);
  if (fieldKey === canonical) return true;
  const data = values && typeof values === 'object' ? values : {};
  if (cleanOwnershipValue(data[canonical])) return false;
  for (const key of OWNERSHIP_DATA_KEYS) {
    if (isNormalizedOwnershipKey(key)) continue;
    if (
      shouldShowOwnershipFieldInForm({
        fieldKey: key,
        moduleKey,
        values: data,
      })
    ) {
      return fieldKey === key;
    }
  }
  return false;
}

export function enrolledByFormLabel(
  fieldKey: string,
  moduleKey?: string | null,
  values?: Record<string, unknown> | null,
  originalLabel?: string,
): string {
  if (isVisibleEnrolledByField(fieldKey, moduleKey, values)) {
    return ENROLLED_BY_LABEL;
  }
  return originalLabel ?? fieldKey;
}

/**
 * Preferred list-column key among ownership aliases present on the module.
 * Used so default views get one "Enrolled by" column instead of Agent+Advisor+Producer.
 */
export function preferredOwnershipListColumnKey(
  availableKeys: ReadonlySet<string>,
): string | null {
  const preferred = [
    'producer_name',
    'producer',
    'normalized_advisor_name',
    'normalized_agent_name',
    ...OWNERSHIP_DATA_KEYS,
  ];
  const seen = new Set<string>();
  for (const key of preferred) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (availableKeys.has(key)) return key;
  }
  return null;
}

/** Keep the first ownership column; drop later aliases so the table shows one. */
export function collapseOwnershipListColumns(columns: readonly string[]): string[] {
  let seenOwnership = false;
  const out: string[] = [];
  for (const col of columns) {
    if (isOwnershipListColumnKey(col)) {
      if (seenOwnership) continue;
      seenOwnership = true;
    }
    out.push(col);
  }
  return out;
}
