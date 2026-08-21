/**
 * Search filter for `crm_advisors`.
 *
 * Live table has advisor_name + agency_name (and later optional name parts).
 * Do not OR against `email` / `producer_code` — those columns are not on
 * the live table and PostgREST 42703's the whole list (picker goes blank).
 */
export function sanitizeAdvisorSearch(raw: string): string {
  return raw.replace(/[%_,().\\]/g, '\\$&');
}

export function advisorSearchOrFilter(raw: string): string {
  const safe = sanitizeAdvisorSearch(raw);
  return `advisor_name.ilike.%${safe}%,agency_name.ilike.%${safe}%`;
}
