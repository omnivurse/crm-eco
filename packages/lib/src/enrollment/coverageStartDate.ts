/**
 * Coverage start date helpers — normalize to the 1st of the month and
 * enforce the Pending invariant (pending status requires a resolvable date).
 */

/** Normalize any date to the first day of its calendar month (UTC date parts). */
export function normalizeCoverageStartToFirstOfMonth(
  input: string | Date | null | undefined,
): string | null {
  if (input == null || input === '') return null;

  let year: number;
  let month: number; // 1-12

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    year = input.getUTCFullYear();
    month = input.getUTCMonth() + 1;
  } else {
    const s = String(input).trim();
    // ISO date or datetime
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]);
    } else {
      // US-style M/D/YYYY
      const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (us) {
        month = Number(us[1]);
        year = Number(us[3]);
      } else {
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return null;
        year = d.getUTCFullYear();
        month = d.getUTCMonth() + 1;
      }
    }
  }

  if (!year || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** First of next calendar month from `asOf` (defaults to today UTC). */
export function defaultNextCoverageStartFirst(asOf: Date = new Date()): string {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth(); // 0-11
  const next = m === 11 ? { year: y + 1, month: 1 } : { year: y, month: m + 2 };
  return `${next.year}-${String(next.month).padStart(2, '0')}-01`;
}

/**
 * Resolve a coverage start for a pending member write.
 * Uses provided date (normalized to 1st) or defaults to next month's 1st.
 */
export function resolvePendingMemberEffectiveDate(
  requested: string | Date | null | undefined,
  options?: { defaultToNextMonth?: boolean },
): string {
  const normalized = normalizeCoverageStartToFirstOfMonth(requested);
  if (normalized) return normalized;
  if (options?.defaultToNextMonth === false) {
    throw new Error('Pending members require an effective_date (coverage start on the 1st)');
  }
  return defaultNextCoverageStartFirst();
}

export type PendingEffectiveDateCheck = {
  ok: true;
  effectiveDate: string;
} | {
  ok: false;
  error: string;
};

/**
 * Assert that a pending-status write has (or can default) an effective date.
 * Pass `allowDefault: false` to fail closed when the date is missing.
 */
export function assertPendingHasEffectiveDate(
  status: string | null | undefined,
  effectiveDate: string | Date | null | undefined,
  options?: { allowDefault?: boolean },
): PendingEffectiveDateCheck {
  const normalizedStatus = (status ?? '').trim().toLowerCase();
  if (normalizedStatus !== 'pending') {
    const normalized = normalizeCoverageStartToFirstOfMonth(effectiveDate);
    return { ok: true, effectiveDate: normalized ?? defaultNextCoverageStartFirst() };
  }

  const normalized = normalizeCoverageStartToFirstOfMonth(effectiveDate);
  if (normalized) {
    return { ok: true, effectiveDate: normalized };
  }

  if (options?.allowDefault !== false) {
    return { ok: true, effectiveDate: defaultNextCoverageStartFirst() };
  }

  return {
    ok: false,
    error: 'Pending members require an effective_date (coverage start on the 1st of the month)',
  };
}
