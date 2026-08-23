/**
 * PersonIdentityLookup — find the existing person across Contacts + History
 * before any import or member-sync insert.
 *
 * Unique index `idx_crm_records_unique_email` is per (org, module, email, names),
 * so a History hit that is ignored becomes a second working Contact. Search both
 * doors. Never invent a new UUID for someone who already lives in History.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isHistoricalStatus,
  isMembersSourceRow,
  normalizeModuleKey,
  ROSTER_IDENTITY_KEYS,
  shouldExpandPeopleLookup,
} from '@/lib/crm/person-module-keys';
import { resolveEffectiveStartDate } from '@/lib/crm/resolve-effective-start-date';

export {
  HISTORICAL_STATUSES,
  PEOPLE_IDENTITY_KEYS,
  ROSTER_IDENTITY_KEYS,
  isHistoricalStatus,
  isMembersSourceRow,
  isWorkingOpenStatus,
  shouldExpandPeopleLookup,
} from '@/lib/crm/person-module-keys';

/** `.eq` for one id (cheaper plan); `.in` when Contacts + History are both live. */
export function applyModuleIdFilter(
  // PostgREST builders explode TS2589 if we thread their generic through `.eq`/`.in`.
  query: any,
  moduleIds: readonly string[],
): any {
  const ids = [...new Set(moduleIds.filter(Boolean))];
  if (ids.length <= 1) {
    return query.eq('module_id', ids[0] ?? '');
  }
  return query.in('module_id', ids);
}

/**
 * Resolve the module ids a people-file lookup may search.
 * Always includes `primaryModuleId` even when the History door is not seeded yet.
 */
export async function resolvePeopleIdentityModuleIds(
  supabase: Pick<SupabaseClient, 'from'>,
  orgId: string,
  primaryModuleId: string,
): Promise<string[]> {
  const ids = [primaryModuleId];
  const { data, error } = await supabase
    .from('crm_modules')
    .select('id, key')
    .eq('org_id', orgId)
    .in('key', [...ROSTER_IDENTITY_KEYS]);

  if (error) {
    throw new Error(`PersonIdentityLookup: failed to resolve roster modules: ${error.message}`);
  }

  for (const row of data ?? []) {
    const id = typeof row.id === 'string' ? row.id : '';
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export async function resolveLookupModuleIds(
  supabase: Pick<SupabaseClient, 'from'>,
  orgId: string,
  primaryModuleId: string,
  moduleKey: string | null | undefined,
): Promise<string[]> {
  if (!shouldExpandPeopleLookup(moduleKey)) return [primaryModuleId];
  return resolvePeopleIdentityModuleIds(supabase, orgId, primaryModuleId);
}

/** Phone RPC keys for a people-file run: Contacts then History, never Members. */
export function phoneLookupModuleKeys(primaryModuleKey: string | null | undefined): string[] {
  if (!shouldExpandPeopleLookup(primaryModuleKey)) {
    return primaryModuleKey ? [primaryModuleKey] : [];
  }
  return [...ROSTER_IDENTITY_KEYS];
}

export const REACTIVATE_STATUSES = ['Active', 'Pending'] as const;
export type ReactivateStatus = (typeof REACTIVATE_STATUSES)[number];

export type ReactivatePlan =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      nextStatus: ReactivateStatus;
      /** Null = leave module_id alone (Members door or members-source twins). */
      nextModuleId: string | null;
    };

/** Default Active. Caller may pass Active/Pending. Future start date → Pending. */
export function resolveReactivateStatus(input: {
  requestedStatus?: string | null;
  coverageHasStarted?: boolean | null;
}): ReactivateStatus {
  const requested = (input.requestedStatus ?? '').trim();
  if (requested === 'Active' || requested === 'Pending') return requested;
  if (input.coverageHasStarted === false) return 'Pending';
  return 'Active';
}

/** Unknown start date defaults to started so reactivate stays Active. */
export function coverageHasStarted(
  record: {
    current_year_start_date?: string | null;
    original_start_date?: string | null;
    data?: Record<string, unknown> | null;
  },
  today = new Date().toISOString().slice(0, 10),
): boolean {
  const start = resolveEffectiveStartDate(record);
  if (!start) return true;
  return start <= today;
}

/**
 * Fail-closed plan for POST /api/crm/records/[id]/reactivate.
 * History → Contacts (unless members-source). Members stay on Members.
 * Status must already be Cancelled / Terminated / Deceased.
 */
export function planReactivate(input: {
  moduleKey: string | null | undefined;
  contactsModuleId: string | null | undefined;
  system?: unknown;
  status?: string | null;
  requestedStatus?: string | null;
  coverageHasStarted?: boolean | null;
}): ReactivatePlan {
  if (!isHistoricalStatus(input.status)) {
    return {
      ok: false,
      status: 409,
      error: 'Only cancelled, terminated, or deceased people can be reactivated',
    };
  }

  const nextStatus = resolveReactivateStatus({
    requestedStatus: input.requestedStatus,
    coverageHasStarted: input.coverageHasStarted,
  });
  const key = normalizeModuleKey(input.moduleKey);

  if (key === 'members') {
    return { ok: true, nextStatus, nextModuleId: null };
  }
  if (key !== 'history') {
    return {
      ok: false,
      status: 409,
      error: 'Only History or cancelled Members records can be reactivated',
    };
  }
  if (isMembersSourceRow(input.system)) {
    return { ok: true, nextStatus, nextModuleId: null };
  }
  if (!input.contactsModuleId) {
    return { ok: false, status: 409, error: 'Contacts module is not available for this organization' };
  }
  return { ok: true, nextStatus, nextModuleId: input.contactsModuleId };
}
