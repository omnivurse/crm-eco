-- REHEARSAL ONLY — Phase 6a cron/trigger authenticated revokes
-- Run against staging/production; expect ROLLBACK at end (no persistent changes).

BEGIN;

DO $$
DECLARE
  r record;
  v_revoke text[] := ARRAY[
    'auto_cancel_expired_records',
    'auto_create_weekly_batches',
    'claim_scheduler_job',
    'complete_scheduler_job',
    'create_ticket_notification',
    'get_pending_scheduler_jobs',
    'purge_expired_idempotency_keys',
    'sync_member_active_plan_type'
  ];
  v_before int;
  v_after int;
BEGIN
  SELECT count(*) INTO v_before
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND p.proname = ANY (v_revoke)
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

  RAISE NOTICE 'Phase 6a rehearsal: authenticated can execute % target signatures (before)', v_before;

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
      AND p.prosecdef = true
      AND p.proname = ANY (v_revoke)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.fq);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fq);
  END LOOP;

  SELECT count(*) INTO v_after
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND p.proname = ANY (v_revoke)
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

  RAISE NOTICE 'Phase 6a rehearsal: authenticated can execute % target signatures (after)', v_after;

  IF v_after <> 0 THEN
    RAISE EXCEPTION 'Phase 6a rehearsal failed: expected 0 authenticated grants, got %', v_after;
  END IF;
END $$;

-- Regression: service_role should still execute scheduler helper
DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT has_function_privilege(
    'service_role',
    to_regprocedure('public.get_pending_scheduler_jobs(integer, text[])'),
    'EXECUTE'
  ) INTO v_ok;

  IF NOT coalesce(v_ok, false) THEN
    RAISE EXCEPTION 'Phase 6a rehearsal failed: service_role lost get_pending_scheduler_jobs execute';
  END IF;

  RAISE NOTICE 'Phase 6a rehearsal: service_role retains get_pending_scheduler_jobs — OK';
END $$;

ROLLBACK;
