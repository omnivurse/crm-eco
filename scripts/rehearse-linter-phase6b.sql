-- REHEARSAL ONLY — Phase 6b auth helpers to private schema
-- Expect NOTICE counts; authenticated DEFINER count drops; ROLLBACK at end.

BEGIN;

SET lock_timeout = '5s';

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

DO $$
DECLARE
  r record;
  v_move text[] := ARRAY[
    'can_access_organization','current_profile_id','get_my_advisor_id','get_user_advisor_id',
    'get_user_crm_role','get_user_organization_id','get_user_profile_id','get_user_role',
    'has_crm_permission','has_crm_role','has_delegation','has_pending_approval','has_permission','has_role',
    'is_admin','is_admin_or_owner','is_admin_or_super_admin','is_crm_member','is_in_my_downline',
    'is_staff_or_admin','is_super_admin','user_organization_ids','user_role_in'
  ];
  v_call_args text;
  v_before int;
  v_after int;
BEGIN
  SELECT count(*) INTO v_before
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND p.proname = ANY (v_move)
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

  RAISE NOTICE 'Phase 6b rehearsal: % public DEFINER auth helpers before', v_before;

  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS fq
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (v_move)
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET SCHEMA private', r.fq);
  END LOOP;

  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS fq,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_args,
           pg_get_function_result(p.oid) AS result_type,
           p.pronargs
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = ANY (v_move)
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = private, public, pg_catalog', r.fq);

    IF r.pronargs = 0 THEN
      v_call_args := '';
    ELSE
      SELECT string_agg(format('$%s', gs.i), ', ' ORDER BY gs.i)
      INTO v_call_args
      FROM generate_series(1, r.pronargs) AS gs(i);
    END IF;

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_catalog AS $wrapper$ SELECT private.%I(%s) $wrapper$',
      r.proname, r.identity_args, r.result_type, r.proname, v_call_args
    );
  END LOOP;

  SELECT count(*) INTO v_after
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND p.proname = ANY (v_move)
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

  RAISE NOTICE 'Phase 6b rehearsal: % public DEFINER auth helpers after (expect 0)', v_after;

  IF v_after <> 0 THEN
    RAISE EXCEPTION 'Phase 6b rehearsal failed: public DEFINER auth helpers remain (%)', v_after;
  END IF;
END $$;

-- Smoke: wrapper delegates correctly for a zero-arg helper
DO $$
DECLARE
  v_def boolean;
BEGIN
  SELECT p.prosecdef INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'is_super_admin';

  IF coalesce(v_def, true) THEN
    RAISE EXCEPTION 'Phase 6b rehearsal failed: public.is_super_admin is still SECURITY DEFINER';
  END IF;

  RAISE NOTICE 'Phase 6b rehearsal: public.is_super_admin is SECURITY INVOKER wrapper — OK';
END $$;

ROLLBACK;
