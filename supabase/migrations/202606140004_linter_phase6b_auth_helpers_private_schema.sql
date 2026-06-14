-- Phase 6b: Supabase linter — move auth/RLS SECURITY DEFINER helpers to private schema
-- Linter: authenticated_security_definer_function_executable
-- Strategy:
--   1. Move DEFINER implementations to private (not exposed via PostgREST)
--   2. Replace public API with SECURITY INVOKER wrappers (safe for RLS + linter)
-- Rollback: move functions back to public; drop wrappers; restore DEFINER on public copies from backup

BEGIN;

SET lock_timeout = '5s';

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

DO $$
DECLARE
  r record;
  v_move text[] := ARRAY[
    'can_access_organization',
    'current_profile_id',
    'get_my_advisor_id',
    'get_user_advisor_id',
    'get_user_crm_role',
    'get_user_organization_id',
    'get_user_profile_id',
    'get_user_role',
    'has_crm_permission',
    'has_crm_role',
    'has_delegation',
    'has_pending_approval',
    'has_permission',
    'has_role',
    'is_admin',
    'is_admin_or_owner',
    'is_admin_or_super_admin',
    'is_crm_member',
    'is_in_my_downline',
    'is_staff_or_admin',
    'is_super_admin',
    'user_organization_ids',
    'user_role_in'
  ];
  v_call_args text;
  v_moved int := 0;
  v_wrapped int := 0;
BEGIN
  -- 1. Move implementations out of public API schema
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid)
    ) AS fq
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (v_move)
    ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET SCHEMA private', r.fq);
    v_moved := v_moved + 1;
  END LOOP;

  -- 2. Ensure internal helper calls resolve within private first
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid)
    ) AS fq
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = ANY (v_move)
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = private, public, pg_catalog',
      r.fq
    );
  END LOOP;

  -- 3. Public SECURITY INVOKER wrappers for RLS policies and SQL callers
  FOR r IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      pg_get_function_result(p.oid) AS result_type,
      p.pronargs
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = ANY (v_move)
    ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
  LOOP
    IF r.pronargs = 0 THEN
      v_call_args := '';
    ELSE
      SELECT string_agg(format('$%s', gs.i), ', ' ORDER BY gs.i)
      INTO v_call_args
      FROM generate_series(1, r.pronargs) AS gs(i);
    END IF;

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_catalog AS $wrapper$ SELECT private.%I(%s) $wrapper$',
      r.proname,
      r.identity_args,
      r.result_type,
      r.proname,
      v_call_args
    );

    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
      r.proname,
      r.identity_args
    );

    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION private.%I(%s) TO authenticated, service_role',
      r.proname,
      r.identity_args
    );

    v_wrapped := v_wrapped + 1;
  END LOOP;

  RAISE NOTICE 'Phase 6b: moved % auth helper signatures to private; created % public INVOKER wrappers',
    v_moved, v_wrapped;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
