import { normalizeDateColumnValue } from './merge-crm-data-json-to-row';

/** CRM row statuses that mean the member is currently covered / active. */
export const ACTIVE_CONTACT_STATUSES = [
  'Active',
  'Active HS Member',
  'Active Member',
] as const;

/** Statuses that should never be auto-cancelled again. */
export const TERMINAL_CONTACT_STATUSES = [
  'Cancelled',
  'Terminated',
  'Cancellation Pending',
] as const;

const JSONB_END_DATE_KEYS = [
  'cancellation_date',
  'end_date',
  'termination_date',
  'coverage_end_date',
  'insurance_end_date',
  'sharing_end_date',
  'health_insurance_end_date',
] as const;

export type CrmRecordEndDateInput = {
  cancellation_date?: string | null;
  data?: Record<string, unknown> | null;
};

/**
 * Resolve the scheduled coverage end date from indexed columns and JSONB.
 */
export function resolveEffectiveEndDate(record: CrmRecordEndDateInput): string | null {
  const columnDate = normalizeDateColumnValue(record.cancellation_date);
  if (columnDate) return columnDate;

  const data = record.data;
  if (!data || typeof data !== 'object') return null;

  for (const key of JSONB_END_DATE_KEYS) {
    const normalized = normalizeDateColumnValue(data[key]);
    if (normalized) return normalized;
  }

  return null;
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
 * Whether an active record should flip to Cancelled as of `today` (YYYY-MM-DD).
 */
export function isScheduledCancellationDue(
  record: CrmRecordEndDateInput & { status?: string | null },
  today: string,
): { due: boolean; endDate: string | null; effectiveDate: string | null } {
  if (isTerminalContactStatus(record.status)) {
    return { due: false, endDate: null, effectiveDate: null };
  }
  if (!isActiveContactStatus(record.status)) {
    return { due: false, endDate: null, effectiveDate: null };
  }

  const endDate = resolveEffectiveEndDate(record);
  if (!endDate) {
    return { due: false, endDate: null, effectiveDate: null };
  }

  const effectiveDate = firstDayOfCancellationMonth(endDate);
  if (!effectiveDate || effectiveDate > today) {
    return { due: false, endDate, effectiveDate };
  }

  return { due: true, endDate, effectiveDate };
}
