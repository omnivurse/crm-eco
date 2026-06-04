-- ============================================================================
-- Migration: 202605220008_counter_increment_rpcs
-- Purpose:   Add the three "just bump this counter by one" RPCs the
--            production code already calls. Each one was failing silently
--            (`function does not exist`) and the code swallowed the error,
--            so counters never advanced.
--
--            Adds:
--              increment_template_usage(template_id uuid)            -> void
--              increment_recently_viewed_count(_user_id uuid, _record_id uuid) -> void
--              increment_landing_page_views(page_id uuid)            -> void
--
--            Each RPC is SECURITY DEFINER so anon/authenticated calls work
--            without granting UPDATE on the underlying table to anon. We
--            still scope every UPDATE by id so it can only ever touch the
--            one row the caller named.
--
-- Audit refs (.audit/findings.json):
--   - "Code calls RPC `increment_template_usage` that does not exist"  (now satisfied)
--   - "Code calls RPC `increment_recently_viewed_count` that does not exist"
--   - "Code calls RPC `increment_landing_page_views` that does not exist"
--
-- Note: `increment` and `coalesce` "RPCs" referenced elsewhere were never
-- valid — they were misuses of `.rpc()` to express SQL expressions. Those
-- call-sites have been rewritten to fetch-then-update in this same PR.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.increment_template_usage(uuid);
--   DROP FUNCTION IF EXISTS public.increment_recently_viewed_count(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.increment_landing_page_views(uuid);
-- ============================================================================

BEGIN;

-- ── increment_template_usage ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crm_message_templates
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at = now()
  WHERE id = template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_template_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_template_usage(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.increment_template_usage(uuid) IS
  'Atomically bump crm_message_templates.usage_count by 1. SECURITY DEFINER so callers do not need UPDATE on the table.';

-- ── increment_recently_viewed_count ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_recently_viewed_count(
  _user_id uuid,
  _record_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crm_recently_viewed
  SET view_count = COALESCE(view_count, 0) + 1,
      last_viewed_at = now()
  WHERE user_id = _user_id AND record_id = _record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_recently_viewed_count(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_recently_viewed_count(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.increment_recently_viewed_count(uuid, uuid) IS
  'Bump crm_recently_viewed.view_count for the (user, record) pair. Caller is responsible for inserting the row first (handled by an upsert in the recently-viewed POST handler).';

-- ── increment_landing_page_views ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_landing_page_views(page_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.landing_pages
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = page_id;
END;
$$;

-- Landing pages are public — anon callers (visitors) must be able to ping
-- this. Still SECURITY DEFINER so we control exactly what they can mutate.
REVOKE ALL ON FUNCTION public.increment_landing_page_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_landing_page_views(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.increment_landing_page_views(uuid) IS
  'Bump landing_pages.views_count by 1. Callable by anon because landing pages are public.';

NOTIFY pgrst, 'reload schema';

COMMIT;
