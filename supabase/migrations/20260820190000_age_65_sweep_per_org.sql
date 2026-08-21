-- Make the age-65 sweep tenant-scoped.
--
-- 20260820150000 closed the real hole: any logged-in user of ANY tenant could
-- call apply_age_65_auto_cancellation() with no argument and rewrite
-- crm_records.status across every org. Interactive callers are now limited to
-- a single record in an org where they hold a CRM role.
--
-- What remained: the sweep itself is still one unbounded statement over the
-- whole table. A trusted caller (the nightly cron, pg_cron, or any path
-- holding the service key) cancels members in every tenant in a single
-- indivisible pass. That is a blast-radius and auditability problem rather
-- than an access-control one:
--   * one tenant's malformed data aborting the loop takes down every other
--     tenant's run with it;
--   * the result is a single flat list, so "what did last night's job do to
--     THIS org" cannot be answered;
--   * nothing structurally prevents a future caller from sweeping tenants it
--     had no business touching.
--
-- The implementation now takes an org and the wrapper iterates orgs, so each
-- tenant is processed in its own statement, its own error boundary, and its
-- own reported result. Output shape is unchanged for existing callers
-- ({count, cancelled[]}), with a per-org breakdown added alongside.
--
-- Rollback: re-apply 20260820150000 (restores the single-call wrapper) and
--   recreate private.apply_age_65_auto_cancellation_impl(uuid) from
--   /tmp/prod_private.sql — the pre-change body is snapshotted in the
--   scratchpad as prod_private_PRE_PERORG.sql.

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Implementation: identical logic, now bounded to one org per call.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS private.apply_age_65_auto_cancellation_impl(uuid);

CREATE OR REPLACE FUNCTION private.apply_age_65_auto_cancellation_impl(
  p_record_id uuid DEFAULT NULL,
  p_org_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_dob date;
  v_birthday_month date;
  v_count int := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT cr.id,
           cr.organization_id,
           cr.title,
           cr.email,
           cr.owner_id,
           cr.advisor_id,
           cr.data->>'date_of_birth' AS dob_text
      FROM public.crm_records cr
      JOIN public.crm_modules m ON m.id = cr.module_id
     WHERE m.key IN ('contacts', 'members')
       AND cr.market_type = 'healthshare'
       AND cr.data ? 'date_of_birth'
       AND cr.data->>'date_of_birth' ~ '^\d{4}-\d{2}-\d{2}'
       AND (cr.status IS NULL OR cr.status NOT IN ('Cancelled', 'Terminated'))
       AND COALESCE((cr.data->>'age_65_cancel_override')::boolean, false) = false
       AND (p_record_id IS NULL OR cr.id = p_record_id)
       -- NEW: never reach outside the requested tenant.
       AND (p_org_id IS NULL OR cr.org_id = p_org_id)
  LOOP
    BEGIN
      v_dob := substring(r.dob_text from 1 for 10)::date;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    v_birthday_month := make_date(
      EXTRACT(YEAR FROM v_dob)::int + 65,
      EXTRACT(MONTH FROM v_dob)::int,
      1
    );

    IF v_birthday_month > CURRENT_DATE THEN
      CONTINUE;
    END IF;

    UPDATE public.crm_records
       SET status = 'Cancelled',
           cancellation_date = v_birthday_month,
           data = data || jsonb_build_object(
             'cancellation_date', v_birthday_month::text,
             'cancellation_reason', 'Aged out at 65',
             'auto_cancelled_at', now()::text
           ),
           updated_at = now()
     WHERE id = r.id;

    v_count := v_count + 1;
    v_results := v_results || jsonb_build_object(
      'record_id', r.id,
      'org_id', r.organization_id,
      'member_name', r.title,
      'member_email', r.email,
      'cancellation_date', v_birthday_month,
      'owner_id', r.owner_id
    );
  END LOOP;

  RETURN jsonb_build_object('count', v_count, 'cancelled', v_results);
END;
$$;

REVOKE ALL ON FUNCTION private.apply_age_65_auto_cancellation_impl(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.apply_age_65_auto_cancellation_impl(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION private.apply_age_65_auto_cancellation_impl(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.apply_age_65_auto_cancellation_impl(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Wrapper: same signature, same result shape, now one pass per tenant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_age_65_auto_cancellation(p_record_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  -- csv-hardening: age65 guard wrapper  (marker — re-run detection)
  --
  -- Two trusted callers, and they look different:
  --   1. PostgREST with the service key  → auth.role() = 'service_role'
  --   2. IN-DATABASE execution (pg_cron, psql, a migration) → NO PostgREST
  --      GUCs at all, so auth.role() and auth.uid() are both NULL.
  -- A PostgREST request always carries a role claim ('anon' when
  -- unauthenticated), so "no role claim at all" cannot be forged through the API.
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role'
                          OR (auth.role() IS NULL AND auth.uid() IS NULL);
  v_org_id     uuid;
  v_one        jsonb;
  v_count      int := 0;
  v_results    jsonb := '[]'::jsonb;
  v_by_org     jsonb := '{}'::jsonb;
  v_errors     jsonb := '[]'::jsonb;
BEGIN
  IF NOT v_is_service THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- An interactive caller may only act on ONE record, in an org where they
    -- hold a CRM role. The org-wide sweep was the actual vulnerability.
    IF p_record_id IS NULL THEN
      RAISE EXCEPTION 'Org-wide age-65 cancellation is restricted to scheduled jobs';
    END IF;

    SELECT org_id INTO v_org_id FROM public.crm_records WHERE id = p_record_id;
    IF v_org_id IS NULL THEN
      RETURN jsonb_build_object('count', 0, 'cancelled', '[]'::jsonb);
    END IF;

    IF NOT COALESCE(
      has_crm_role(v_org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']::text[]),
      false
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;

    -- Explicitly bounded to the caller's own tenant.
    RETURN private.apply_age_65_auto_cancellation_impl(p_record_id, v_org_id);
  END IF;

  -- Trusted single-record call: still scope it to that record's own org.
  IF p_record_id IS NOT NULL THEN
    SELECT org_id INTO v_org_id FROM public.crm_records WHERE id = p_record_id;
    RETURN private.apply_age_65_auto_cancellation_impl(p_record_id, v_org_id);
  END IF;

  -- Sweep: one pass per tenant, each in its own error boundary so a single
  -- org's bad data cannot take down every other org's nightly run.
  FOR v_org_id IN
    SELECT DISTINCT cr.org_id
      FROM public.crm_records cr
      JOIN public.crm_modules m ON m.id = cr.module_id
     WHERE m.key IN ('contacts', 'members')
       AND cr.market_type = 'healthshare'
     ORDER BY 1
  LOOP
    BEGIN
      v_one := private.apply_age_65_auto_cancellation_impl(NULL, v_org_id);
      v_count   := v_count + COALESCE((v_one ->> 'count')::int, 0);
      v_results := v_results || COALESCE(v_one -> 'cancelled', '[]'::jsonb);
      v_by_org  := v_by_org || jsonb_build_object(
                     v_org_id::text, COALESCE((v_one ->> 'count')::int, 0));
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('org_id', v_org_id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'count', v_count,
    'cancelled', v_results,
    'by_org', v_by_org,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_age_65_auto_cancellation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_age_65_auto_cancellation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_age_65_auto_cancellation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_age_65_auto_cancellation(uuid) TO service_role;
