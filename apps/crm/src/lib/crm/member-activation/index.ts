/**
 * MemberActivation — coordinator interface over CRM-record and billing
 * membership activation adapters. Cron routes stay thin; schedules stay
 * separate (independent failure domains).
 *
 * CRM: pending-activation (crm_records Pending → Active)
 * Billing: billing-membership-activation (memberships + members pending → active)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyDueMembershipActivation,
  type BillingActivationOptions,
  type BillingActivationResult,
} from '../billing-membership-activation';
import {
  applyPendingActivationForRecord,
  isActivationDue,
  type PendingActivationResult,
  type RecordForPendingActivation,
} from '../pending-activation';
import { PENDING_CONTACT_STATUSES } from '../resolve-effective-start-date';

export {
  applyDueMembershipActivation,
  listDuePendingMemberships,
  type BillingActivationOptions,
  type BillingActivationResult,
  type DuePendingMembership,
} from '../billing-membership-activation';

export {
  applyPendingActivationForRecord,
  buildActivationUpdates,
  isActivationDue,
  isEligibleForActivation,
  isPendingContactStatus,
  type ActivationDueCheck,
  type PendingActivationResult,
  type RecordForPendingActivation,
} from '../pending-activation';

export type ActivateCrmRecordsOptions = {
  dryRun?: boolean;
  pageSize?: number;
};

export type ActivateCrmRecordsResult = {
  today: string;
  dry_run: boolean;
  pending_scanned: number;
  would_activate: number;
  activated: PendingActivationResult[];
  errors: string[];
  sample: Array<{ id: string; status: string | null; start_date: string }>;
  error?: string;
};

const DEFAULT_PAGE_SIZE = 1000;
const SELECT_COLS =
  'id, status, market_type, org_id, data, original_start_date, current_year_start_date, title, email, owner_id';

/**
 * Scan contacts/members CRM records in pending-class statuses and activate
 * those whose coverage start date is today or earlier.
 */
export async function activateCrmRecordsDue(
  supabase: SupabaseClient,
  today: string,
  opts: ActivateCrmRecordsOptions = {},
): Promise<ActivateCrmRecordsResult> {
  const dryRun = Boolean(opts.dryRun);
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  const { data: modules, error: moduleError } = await supabase
    .from('crm_modules')
    .select('id')
    .in('key', ['contacts', 'members']);

  if (moduleError) {
    return {
      today,
      dry_run: dryRun,
      pending_scanned: 0,
      would_activate: 0,
      activated: [],
      errors: [],
      sample: [],
      error: moduleError.message,
    };
  }

  const moduleIds = (modules ?? []).map((m) => m.id as string);
  if (moduleIds.length === 0) {
    return {
      today,
      dry_run: dryRun,
      pending_scanned: 0,
      would_activate: 0,
      activated: [],
      errors: [],
      sample: [],
      error: 'No contacts/members modules found',
    };
  }

  const activated: PendingActivationResult[] = [];
  const errors: string[] = [];
  let scanned = 0;
  let eligible = 0;
  const sample: Array<{ id: string; status: string | null; start_date: string }> = [];

  for (let from = 0; ; from += pageSize) {
    const { data: page, error: fetchError } = await supabase
      .from('crm_records')
      .select(SELECT_COLS)
      .in('module_id', moduleIds)
      .in('status', [...PENDING_CONTACT_STATUSES])
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (fetchError) {
      return {
        today,
        dry_run: dryRun,
        pending_scanned: scanned,
        would_activate: eligible,
        activated,
        errors,
        sample,
        error: fetchError.message,
      };
    }
    if (!page || page.length === 0) break;
    scanned += page.length;

    for (const raw of page as RecordForPendingActivation[]) {
      const check = isActivationDue(raw, today);
      if (!check.due || !check.startDate) continue;

      eligible++;

      if (dryRun) {
        if (sample.length < 25) {
          sample.push({ id: raw.id, status: raw.status, start_date: check.startDate });
        }
        continue;
      }

      const result = await applyPendingActivationForRecord(supabase, raw, today);
      if (result.error) {
        errors.push(`${raw.id}: ${result.error}`);
        continue;
      }
      if (result.activated) {
        activated.push(result);
      }
    }

    if (page.length < pageSize) break;
  }

  return {
    today,
    dry_run: dryRun,
    pending_scanned: scanned,
    would_activate: eligible,
    activated,
    errors,
    sample,
  };
}

export async function activateBillingDue(
  supabase: SupabaseClient,
  today: string,
  opts: BillingActivationOptions = {},
): Promise<BillingActivationResult> {
  return applyDueMembershipActivation(supabase, today, opts);
}

export type ActivateAllDueResult = {
  crm: ActivateCrmRecordsResult;
  billing: BillingActivationResult;
};

/** Ops convenience — runs both adapters. Cron schedules stay separate. */
export async function activateAllDue(
  supabase: SupabaseClient,
  today: string,
  opts: ActivateCrmRecordsOptions & BillingActivationOptions = {},
): Promise<ActivateAllDueResult> {
  const crm = await activateCrmRecordsDue(supabase, today, opts);
  const billing = await activateBillingDue(supabase, today, opts);
  return { crm, billing };
}
