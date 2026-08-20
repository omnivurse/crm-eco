-- Close two privilege gaps WITHOUT revoking EXECUTE from `authenticated`.
-- NOT applied by the authoring agent — review, then `supabase db push`.
--
-- Caller analysis that shaped this (verified against the repo, not assumed):
--
--   auto_cancel_expired_records()  — NOT TOUCHED HERE. Already revoked from
--     authenticated by 202606140003 (v_revoke list); its only caller is the
--     service-role automation cron. An earlier note calling this a live hole
--     was wrong — it was closed in June.
--
--   apply_age_65_auto_cancellation(uuid) — has a LIVE user-session caller:
--     apps/crm/src/lib/crm/age-65-auto-cancel.ts runs it through the RLS
--     client on every contact/member record view. Revoking EXECUTE from
--     authenticated would silently disable live age-65 cancellation (the
--     caller swallows the error), so instead we add the missing authorization
--     INSIDE the function. That is what actually closes the hole: today any
--     authenticated user can call it with p_record_id => NULL and flip
--     statuses across EVERY org.
--
--   bulk_auto_merge_duplicates(uuid,int) — has a LIVE user-session caller
--     (the admin-only API route). It already enforces its own org guard, so
--     it is not cross-org exploitable; the real gap is that the function
--     admits crm_manager while the route admits only crm_admin, letting a
--     manager bypass the route via a direct PostgREST rpc call. Tightening the
--     in-function check to crm_admin closes that with ZERO breakage, because
--     the only production caller already refuses non-admins.
--
-- Rollback: re-apply the prior definitions —
--   supabase/migrations/202607140012_phase6a_read_hide_duplicates.sql (bulk merge)
--   and the apply_age_65_auto_cancellation body from
--   supabase/migrations/00000000000000_baseline.sql.

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. apply_age_65_auto_cancellation — add the caller guard it never had.
--    Wraps the existing implementation instead of rewriting its logic: the
--    body is preserved by delegating to the original once authorization
--    passes, so cancellation behaviour is unchanged.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'apply_age_65_auto_cancellation'
   LIMIT 1;

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'apply_age_65_auto_cancellation not found — refusing to proceed';
  END IF;

  -- Keep an untouched copy so the guard is reversible and the original logic
  -- is not transcribed by hand (transcription is how behaviour drifts).
  --
  -- FAIL CLOSED on re-run. If the public function is ALREADY the wrapper (it
  -- contains the marker below) and the private impl is missing — e.g. someone
  -- dropped it — copying the wrapper into the impl would produce a function
  -- that calls itself forever AND destroy the only copy of the real logic.
  -- Refuse loudly instead.
  IF position('csv-hardening: age65 guard wrapper' in v_src) > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'private' AND p.proname = 'apply_age_65_auto_cancellation_impl'
    ) THEN
      RAISE EXCEPTION
        'public.apply_age_65_auto_cancellation is already the guard wrapper but private.apply_age_65_auto_cancellation_impl is missing — restore the implementation before re-running';
    END IF;
    RAISE NOTICE 'age-65 guard already installed — implementation copy left untouched';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'private' AND p.proname = 'apply_age_65_auto_cancellation_impl'
  ) THEN
    EXECUTE replace(
      replace(v_src, 'public.apply_age_65_auto_cancellation', 'private.apply_age_65_auto_cancellation_impl'),
      'FUNCTION apply_age_65_auto_cancellation', 'FUNCTION private.apply_age_65_auto_cancellation_impl'
    );
  END IF;

  -- The copy is SECURITY DEFINER and inherits EXECUTE for PUBLIC. `authenticated`
  -- holds USAGE on `private`, so without this the guard is trivially bypassed by
  -- calling the implementation directly.
  EXECUTE 'REVOKE ALL ON FUNCTION private.apply_age_65_auto_cancellation_impl(uuid) FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON FUNCTION private.apply_age_65_auto_cancellation_impl(uuid) FROM anon';
  EXECUTE 'REVOKE ALL ON FUNCTION private.apply_age_65_auto_cancellation_impl(uuid) FROM authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION private.apply_age_65_auto_cancellation_impl(uuid) TO service_role';
END $$;

-- RETURNS jsonb, matching the existing function. Postgres refuses to change a
-- function's return type via CREATE OR REPLACE, so getting this wrong fails
-- the whole migration — which is exactly what the local rehearsal caught.
CREATE OR REPLACE FUNCTION public.apply_age_65_auto_cancellation(p_record_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  -- csv-hardening: age65 guard wrapper  (marker — re-run detection above)
  --
  -- Two trusted callers, and they look different:
  --   1. PostgREST with the service key  → auth.role() = 'service_role'
  --   2. IN-DATABASE execution (pg_cron, psql, a migration) → NO PostgREST
  --      GUCs at all, so auth.role() and auth.uid() are both NULL.
  -- Treating only (1) as trusted silently broke the nightly pg_cron sweep
  -- scheduled in 00000000000001_baseline_cross_schema.sql — it failed with
  -- 'Not authenticated' every night, visible only in cron.job_run_details.
  -- A PostgREST request always carries a role claim ('anon' when unauthenticated),
  -- so "no role claim at all" cannot be forged through the API.
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role'
                          OR (auth.role() IS NULL AND auth.uid() IS NULL);
  v_org_id     uuid;
BEGIN
  IF NOT v_is_service THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- An interactive caller may only act on ONE record, in an org where they
    -- hold a CRM role. The org-wide sweep (p_record_id IS NULL) was the actual
    -- vulnerability: it bulk-updated crm_records.status across every tenant.
    IF p_record_id IS NULL THEN
      RAISE EXCEPTION 'Org-wide age-65 cancellation is restricted to scheduled jobs';
    END IF;

    SELECT org_id INTO v_org_id FROM public.crm_records WHERE id = p_record_id;
    IF v_org_id IS NULL THEN
      -- Same shape the implementation returns for "nothing to do".
      RETURN jsonb_build_object('count', 0, 'cancelled', '[]'::jsonb);
    END IF;

    IF NOT COALESCE(
      has_crm_role(v_org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']::text[]),
      false
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  RETURN private.apply_age_65_auto_cancellation_impl(p_record_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_age_65_auto_cancellation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_age_65_auto_cancellation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_age_65_auto_cancellation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_age_65_auto_cancellation(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. bulk_auto_merge_duplicates — admin-only, matching the API route.
--    Same wrap-don't-transcribe approach: only the role predicate changes.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'bulk_auto_merge_duplicates'
   LIMIT 1;

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'bulk_auto_merge_duplicates not found — refusing to proceed';
  END IF;

  -- Already tightened (no manager in the predicate): nothing to do.
  IF position('''crm_admin'', ''crm_manager''' in v_src) = 0 THEN
    IF position('''crm_admin''' in v_src) > 0 THEN
      RAISE NOTICE 'bulk_auto_merge_duplicates already admin-only — no change';
      RETURN;
    END IF;
    -- FAIL CLOSED: the predicate is not in either recognised form, so the
    -- privilege gap may still be open. A NOTICE here would let the migration
    -- report success while leaving crm_manager able to bypass the admin-only
    -- route via a direct PostgREST rpc call.
    RAISE EXCEPTION
      'bulk_auto_merge_duplicates role predicate not in the expected form — aborting rather than leaving the manager bypass open; inspect pg_get_functiondef and update this migration';
  END IF;

  -- Only the role list changes: managers can no longer bypass the
  -- admin-only route by calling the RPC directly.
  v_new := replace(
    v_src,
    'v_actor_role NOT IN (''crm_admin'', ''crm_manager'')',
    'v_actor_role NOT IN (''crm_admin'')'
  );
  v_new := replace(
    v_new,
    'Only CRM admins and managers can run bulk merge',
    'Only CRM admins can run bulk merge'
  );

  IF v_new = v_src THEN
    RAISE EXCEPTION 'bulk_auto_merge_duplicates predicate replacement produced no change — aborting rather than reporting a tightening that did not happen';
  END IF;

  EXECUTE v_new;
  RAISE NOTICE 'bulk_auto_merge_duplicates tightened to crm_admin only';
END $$;
