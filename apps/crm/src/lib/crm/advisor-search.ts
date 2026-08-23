/**
 * Search filters for the producer / advisor stores.
 *
 * - `advisorSearchOrFilter`  → `crm_advisors` (DB-deprecated; advisor_name +
 *   agency_name). Do not OR against `email` / `producer_code` — those columns
 *   are not on the live table and PostgREST 42703's the whole list (picker
 *   goes blank).
 * - `producerSearchOrFilter` → `public.advisors`, the "Enrolled by" source of
 *   truth (Road to Ten DE-3 / decision D5 as adjusted): full_name, the name
 *   parts and agency_name. Only columns that exist on the live table.
 */
export function sanitizeAdvisorSearch(raw: string): string {
  return raw.replace(/[%_,().\\]/g, '\\$&');
}

export function advisorSearchOrFilter(raw: string): string {
  const safe = sanitizeAdvisorSearch(raw);
  return `advisor_name.ilike.%${safe}%,agency_name.ilike.%${safe}%`;
}

/** Columns of `public.advisors` the producer search ORs over. */
export const PRODUCER_SEARCH_COLUMNS = ['full_name', 'first_name', 'last_name', 'agency_name'] as const;

export function producerSearchOrFilter(raw: string): string {
  const safe = sanitizeAdvisorSearch(raw);
  return PRODUCER_SEARCH_COLUMNS.map((c) => `${c}.ilike.%${safe}%`).join(',');
}

/** Display name of a `public.advisors` row: full_name, else "first last". */
export function producerDisplayName(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const full = (row.full_name ?? '').trim();
  if (full) return full;
  return [row.first_name, row.last_name]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
