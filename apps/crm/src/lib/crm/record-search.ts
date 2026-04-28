/**
 * Shared text/phone search for `crm_records` list queries (server module page + REST API).
 * Aligns with `/api/crm/search` phone fallback: multiple NANP formats on `phone`,
 * digits / tail-10 on `data::text` (mobile/work_phone JSON), plus normal title/email/phone/data
 * for word-shaped queries.
 *
 * Multi-word queries AND across terms: each word must match in at least one column
 * (PostgREST chains `.or()` filters with AND semantics between groups).
 */

export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/**
 * Generate common visual phone formats for a digit string so ILIKE can match
 * differently formatted rows (same strategy as global search).
 */
export function phoneFormatVariants(digits: string): string[] {
  if (digits.length < 4) return [];

  const out = new Set<string>();
  const candidates: string[] = [digits];
  if (digits.length === 11 && digits.startsWith('1')) {
    candidates.push(digits.slice(1));
  } else if (digits.length === 10) {
    candidates.push('1' + digits);
  }

  for (const d of candidates) {
    out.add(d);
    if (d.length === 10) {
      const a = d.slice(0, 3);
      const b = d.slice(3, 6);
      const c = d.slice(6);
      out.add(`${a}-${b}-${c}`);
      out.add(`(${a}) ${b}-${c}`);
      out.add(`(${a})${b}-${c}`);
      out.add(`(${a}) ${b} ${c}`);
      out.add(`${a}.${b}.${c}`);
      out.add(`${a} ${b} ${c}`);
    } else if (d.length === 11 && d.startsWith('1')) {
      const a = d.slice(1, 4);
      const b = d.slice(4, 7);
      const c = d.slice(7);
      out.add(`1-${a}-${b}-${c}`);
      out.add(`1 (${a}) ${b}-${c}`);
      out.add(`+1 ${a} ${b}-${c}`);
      out.add(`+1-${a}-${b}-${c}`);
      out.add(`+1 (${a}) ${b}-${c}`);
    }
  }
  return Array.from(out);
}

const MAX_PHONE_OR_CLAUSES = 48;

/**
 * Single PostgREST `.or(...)` filter string for phone-heavy search on `crm_records`.
 * Used by list queries and by `/api/crm/search` phone fallback.
 */
export function buildPhoneSearchOrFilter(rawSearch: string): string {
  const digits = rawSearch.replace(/\D/g, '');
  if (digits.length < 4 || digits.length > 15) {
    return '';
  }

  const safeRaw = escapeIlikePattern(rawSearch);
  const clauses = new Set<string>();

  clauses.add(`phone.ilike.%${escapeIlikePattern(digits)}%`);
  const tail = digits.slice(-10);
  if (tail && tail !== digits) {
    clauses.add(`phone.ilike.%${escapeIlikePattern(tail)}%`);
  }

  for (const v of phoneFormatVariants(digits)) {
    if (clauses.size >= MAX_PHONE_OR_CLAUSES) break;
    clauses.add(`phone.ilike.%${escapeIlikePattern(v)}%`);
  }

  clauses.add(`phone.ilike.%${safeRaw}%`);

  if (digits.length >= 4) {
    clauses.add(`data::text.ilike.%${escapeIlikePattern(digits)}%`);
    if (tail && tail !== digits) {
      clauses.add(`data::text.ilike.%${escapeIlikePattern(tail)}%`);
    }
  }

  return Array.from(clauses).join(',');
}

type OrQuery = { or: (filters: string) => OrQuery };

/**
 * True when the user is clearly typing a phone (formatted digits), matching `/api/crm/search`.
 */
function isPhoneHeavyQuery(rawSearch: string): boolean {
  const phoneDigits = rawSearch.replace(/[^0-9]/g, '');
  const compactLen = Math.max(rawSearch.replace(/\s/g, '').length, 1);
  const digitRatio = phoneDigits.length / compactLen;
  return (
    phoneDigits.length >= 4 &&
    phoneDigits.length <= 15 &&
    digitRatio >= 0.88 &&
    !rawSearch.includes('@')
  );
}

/** Single token looks like a standalone phone fragment (digits + typical separators). */
function tokenLooksLikePhone(term: string): boolean {
  const digitsOnly = term.replace(/\D/g, '');
  if (digitsOnly.length < 4 || digitsOnly.length > 15 || term.includes('@')) return false;
  const compactLen = Math.max(term.replace(/\s/g, '').length, 1);
  const ratio = digitsOnly.length / compactLen;
  return ratio >= 0.8;
}

/**
 * Applies search filters to a PostgREST query builder that exposes `.or(...)`.
 */
export function applyCrmRecordTextSearch<Q extends OrQuery>(query: Q, search: string | undefined): Q {
  if (!search || !search.trim()) return query;

  const rawSearch = search.trim();

  // Dedicated phone path — matches formatted columns + JSON phone fields via data::text
  if (isPhoneHeavyQuery(rawSearch)) {
    const phoneFilter = buildPhoneSearchOrFilter(rawSearch);
    if (phoneFilter) {
      return query.or(phoneFilter) as Q;
    }
  }

  const terms = rawSearch.split(/\s+/).filter(Boolean);
  let q: OrQuery = query;
  for (const term of terms) {
    if (tokenLooksLikePhone(term)) {
      const phoneFilter = buildPhoneSearchOrFilter(term);
      if (phoneFilter) {
        q = q.or(phoneFilter);
        continue;
      }
    }
    const p = `%${escapeIlikePattern(term)}%`;
    q = q.or(`title.ilike.${p},email.ilike.${p},phone.ilike.${p},data::text.ilike.${p}`);
  }
  return q as Q;
}
