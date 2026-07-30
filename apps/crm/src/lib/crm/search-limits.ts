/**
 * Default `limit` query param for `/api/crm/search` from spotlight UIs (module
 * toolbar, Cmd+K adjacent surfaces, record header search, etc.).
 *
 * Keep in sync with GET `/api/crm/search` default in
 * `apps/crm/src/app/api/crm/search/route.ts`. Using a lower value in the
 * client used to under-fetch when many rows tied on rank (e.g. bulk
 * `updated_at` realignment + common surnames); see
 * `supabase/migrations/202605020008_smart_search_deterministic_order.sql`.
 *
 * Shell-mounted search overlays (⌘K) must clear query on every close path via
 * `useEphemeralSearchWhenClosed` — do not reintroduce ad-hoc clear-only-on-
 * navigate patterns (stale person names block the next search).
 */
export const CRM_SPOTLIGHT_SEARCH_LIMIT = 25;
