/**
 * Fail-closed invariant: CRM Pending-class statuses require a resolvable
 * coverage start date (same keys as activate-pending cron).
 */

import { isPendingContactStatus } from './pending-activation';
import {
  resolveEffectiveStartDate,
  type CrmRecordStartDateInput,
} from './resolve-effective-start-date';

export type PendingStartDateInvariantResult =
  | { ok: true; startDate: string }
  | { ok: false; error: string };

export function assertCrmPendingHasStartDate(
  status: string | null | undefined,
  record: CrmRecordStartDateInput,
  moduleKey?: string | null,
): PendingStartDateInvariantResult {
  // On leads "Pending" is a pipeline stage, not pending coverage — no start
  // date is implied.
  if (moduleKey === 'leads' || !isPendingContactStatus(status)) {
    const startDate = resolveEffectiveStartDate(record);
    return { ok: true, startDate: startDate ?? '' };
  }

  const startDate = resolveEffectiveStartDate(record);
  if (!startDate) {
    return {
      ok: false,
      error:
        'Pending status requires a coverage start date (original_start_date, current_year_start_date, or start_date / effective_date in data)',
    };
  }
  return { ok: true, startDate };
}
