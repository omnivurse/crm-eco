-- Phase 6a: Supabase linter — revoke authenticated EXECUTE on cron/trigger-only DEFINER RPCs
-- Linter: authenticated_security_definer_function_executable
-- These functions are invoked only by service_role cron routes, pg_cron, or table triggers.
-- Authenticated users must not call them via /rest/v1/rpc/*.
-- Rollback: GRANT EXECUTE ON FUNCTION ... TO authenticated; (per signature)

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
  v_revoked int := 0;
BEGIN
  FOR r IN
    SELECT
      format(
        '%I.%I(%s)',
        n.nspname,
        p.proname,
        pg_get_function_identity_arguments(p.oid)
      ) AS fq,
      p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY (v_revoke)
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.fq);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fq);
      v_revoked := v_revoked + 1;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'phase6a: could not alter %: %', r.fq, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Phase 6a: revoked authenticated execute on % cron/trigger DEFINER signatures',
    v_revoked;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
