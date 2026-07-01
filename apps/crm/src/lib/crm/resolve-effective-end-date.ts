import { normalizeDateColumnValue } from './merge-crm-data-json-to-row';
import { ALL_COVERAGE_END_DATE_KEYS } from './coverage-end-date-fields';

/** CRM row statuses that mean the member is currently covered / active. */
export const ACTIVE_CONTACT_STATUSES = [
  'Active',
  'Active HS Member',
  'Active Member',
  'Active DPC',
] as const;

/** Statuses that should never be auto-cancelled again. */
export const TERMINAL_CONTACT_STATUSES = [
  'Cancelled',
  'Terminated',
  'Cancellation Pending',
] as const;

const JSONB_END_DATE_KEYS = ALL_COVERAGE_END_DATE_KEYS;

export type CrmRecordEndDateInput = {
  cancellation_date?: string | null;
  data?: Record<string, unknown> | null;
};

/**
 * Resolve the scheduled coverage end date from indexed columns and JSONB.
 * Returns the earliest end date when multiple product lines have dates set.
 */
export function resolveEffectiveEndDate(record: CrmRecordEndDateInput): string | null {
  const dates = resolveAllEffectiveEndDates(record);
  if (dates.length === 0) return null;
  return dates.sort()[0] ?? null;
}

/** Collect every non-blank coverage end date on the record (deduped). */
export function resolveAllEffectiveEndDates(record: CrmRecordEndDateInput): string[] {
  const seen = new Set<string>();
  const dates: string[] = [];

  const pushDate = (value: unknown) => {
    const normalized = normalizeDateColumnValue(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    dates.push(normalized);
  };

  pushDate(record.cancellation_date);

  const data = record.data;
  if (data && typeof data === 'object') {
    for (const key of JSONB_END_DATE_KEYS) {
      pushDate(data[key]);
    }
  }

  return dates;
}

/**
 * Cancellation takes effect on the 1st of the month containing the end date.
 * e.g. end date 2026-04-15 → effective cancellation 2026-04-01.
 */
export function firstDayOfCancellationMonth(endDate: string): string | null {
  const normalized = normalizeDateColumnValue(endDate);
  if (!normalized) return null;
  const [year, month] = normalized.split('-');
  if (!year || !month) return null;
  return `${year}-${month}-01`;
}

export function isActiveContactStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (ACTIVE_CONTACT_STATUSES as readonly string[]).includes(status);
}

export function isTerminalContactStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (TERMINAL_CONTACT_STATUSES as readonly string[]).includes(status);
}

/**
 * Whether a record with current coverage should be eligible for end-date auto-cancel.
 * Includes year-specific Enrolled statuses (e.g. "Enrolled - 2026") used in production data.
 */
export function isEligibleForScheduledCancellation(
  status: string | null | undefined,
): boolean {
  if (!status || isTerminalContactStatus(status)) return false;
  if (isActiveContactStatus(status)) return true;
  if (/^Enrolled\b/i.test(status)) return true;
  return false;
}

/**
 * Whether an active record should flip to Cancelled as of `today` (YYYY-MM-DD).
 */
export function isScheduledCancellationDue(
  record: CrmRecordEndDateInput & { status?: string | null },
  today: string,
): { due: boolean; endDate: string | null; effectiveDate: string | null } {
  if (isTerminalContactStatus(record.status)) {
    return { due: false, endDate: null, effectiveDate: null };
  }
  if (!isEligibleForScheduledCancellation(record.status)) {
    return { due: false, endDate: null, effectiveDate: null };
  }

  const endDates = resolveAllEffectiveEndDates(record);
  if (endDates.length === 0) {
    return { due: false, endDate: null, effectiveDate: null };
  }

  let earliestDueEndDate: string | null = null;
  let earliestDueEffectiveDate: string | null = null;

  for (const endDate of endDates) {
    const effectiveDate = firstDayOfCancellationMonth(endDate);
    if (!effectiveDate || effectiveDate > today) continue;
    if (
      !earliestDueEffectiveDate ||
      effectiveDate < earliestDueEffectiveDate ||
      (effectiveDate === earliestDueEffectiveDate &&
        endDate < (earliestDueEndDate ?? endDate))
    ) {
      earliestDueEndDate = endDate;
      earliestDueEffectiveDate = effectiveDate;
    }
  }

  if (earliestDueEndDate && earliestDueEffectiveDate) {
    return {
      due: true,
      endDate: earliestDueEndDate,
      effectiveDate: earliestDueEffectiveDate,
    };
  }

  const fallbackEndDate = endDates.sort()[0] ?? null;
  return {
    due: false,
    endDate: fallbackEndDate,
    effectiveDate: fallbackEndDate
      ? firstDayOfCancellationMonth(fallbackEndDate)
      : null,
  };
}
