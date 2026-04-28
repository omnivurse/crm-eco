/**
 * Shared text/phone search for `crm_records` list queries (server module page + REST API).
 * Matches global search / Zoho-style behavior: names in `title`, `email`, `phone`, and
 * JSON `data` (e.g. `first_name` / `last_name`) via `data::text` ILIKE.
 *
 * Multi-word queries AND across terms: each word must appear in at least one of those
 * columns (same pattern as narrowing in the UI).
 */

export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

type OrQuery = { or: (filters: string) => OrQuery };

/**
 * Applies search filters to a PostgREST query builder that exposes `.or(...)`.
 */
export function applyCrmRecordTextSearch<Q extends OrQuery>(query: Q, search: string | undefined): Q {
  if (!search || !search.trim()) return query;

  const rawSearch = search.trim();
  const phoneDigits = rawSearch.replace(/[^0-9]/g, '');
  const compactLen = Math.max(rawSearch.replace(/\s/g, '').length, 1);
  const digitRatio = phoneDigits.length / compactLen;
  const isPhoneQuery =
    phoneDigits.length >= 4 &&
    phoneDigits.length <= 15 &&
    digitRatio >= 0.88 &&
    !rawSearch.includes('@');

  if (isPhoneQuery) {
    const safe = escapeIlikePattern(rawSearch);
    return query.or(
      `phone.ilike.%${phoneDigits.slice(-10)}%,phone.ilike.%${safe}%,title.ilike.%${safe}%`,
    ) as Q;
  }

  const terms = rawSearch.split(/\s+/).filter(Boolean);
  let q: OrQuery = query;
  for (const term of terms) {
    const p = `%${escapeIlikePattern(term)}%`;
    q = q.or(`title.ilike.${p},email.ilike.${p},phone.ilike.${p},data::text.ilike.${p}`);
  }
  return q as Q;
}
