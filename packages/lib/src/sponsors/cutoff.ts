/**
 * Hint-style employer start date:
 * start dates are always the 1st. If the requested/file date day is on or
 * before the sponsor cutoff day, start is the 1st of that month; otherwise
 * the 1st of the next month.
 */
export function firstOfMonth(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return formatIso(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

export function computeSponsorStartDate(requestedIso: string, cutoffDay: number): string {
  const requested = parseIsoDate(requestedIso);
  const day = requested.getUTCDate();
  const safeCutoff = clampCutoff(cutoffDay);
  if (day <= safeCutoff) {
    return formatIso(requested.getUTCFullYear(), requested.getUTCMonth() + 1, 1);
  }
  const next = new Date(Date.UTC(requested.getUTCFullYear(), requested.getUTCMonth() + 1, 1));
  return formatIso(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
}

/** Earliest billable start given a backbill cap (months), measured from as-of. */
export function earliestBackbillStart(
  computedStartIso: string,
  backbillMonths: number,
  asOfIso: string
): string {
  const asOf = parseIsoDate(asOfIso);
  const months = Number.isFinite(backbillMonths) ? Math.max(0, Math.floor(backbillMonths)) : 0;
  const earliest = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - months, 1));
  const start = parseIsoDate(firstOfMonth(computedStartIso));
  return start < earliest
    ? formatIso(earliest.getUTCFullYear(), earliest.getUTCMonth() + 1, 1)
    : formatIso(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
}

export function clampCutoff(day: number): number {
  if (!Number.isFinite(day)) return 1;
  return Math.min(28, Math.max(1, Math.floor(day)));
}

function parseIsoDate(iso: string): Date {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error(`Invalid date: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
