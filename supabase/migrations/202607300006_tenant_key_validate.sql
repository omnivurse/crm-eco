-- =============================================================================
-- VALIDATE the tenant-key CHECK constraints added NOT VALID in 202607300005.
--
-- Each VALIDATE takes only a SHARE UPDATE EXCLUSIVE lock (concurrent reads AND
-- writes continue) and scans the table once to prove every existing row already
-- satisfies org_id = organization_id. This converts the guarantee from
-- "all new writes" to "provably true of every row".
--
-- Guaranteed to pass: the pre-flight audit found 0 divergent rows across all 126
-- dual-column tables (750k+ rows). If any row somehow diverged between 005 and
-- this migration, VALIDATE errors and rolls back -- the correct fail-closed
-- outcome (surface it, do not paper over it).
--
-- Idempotent: skips any constraint already validated. Split from 005 so the
-- (scanning) VALIDATE step can be applied and watched independently of the
-- (instant) NOT VALID step.
-- PROD WRITE RISK: YES (constraint state only; no row data mutated).
-- =============================================================================

-- RESILIENT + RE-RUNNABLE: VALIDATE takes SHARE UPDATE EXCLUSIVE (reads+writes
-- continue) but can wait behind an autovacuum on the large tables (crm_audit_log,
-- crm_notes). Each validation runs in its own subtransaction with a short
-- lock_timeout; a LOCK failure skips that table (re-run mops it up) but a genuine
-- data conflict (check_violation) is allowed to PROPAGATE and abort loudly --
-- that is the fail-closed signal that a divergent row exists and must be handled.
DO $$
DECLARE
  r       record;
  n_ok    int := 0;
  n_skip  int := 0;
  skipped text[] := '{}';
BEGIN
  PERFORM set_config('lock_timeout', '5s', false);

  FOR r IN
    SELECT c.relname, con.conname
    FROM   pg_constraint con
    JOIN   pg_class     c   ON c.oid  = con.conrelid
    JOIN   pg_namespace nsp ON nsp.oid = c.relnamespace
    WHERE  nsp.nspname = 'public'
      AND  con.contype = 'c'
      AND  con.conname LIKE '%\_org\_tenant\_key\_match' ESCAPE '\'
      AND  NOT con.convalidated
    ORDER  BY c.relname
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', r.relname, r.conname);
      n_ok := n_ok + 1;
    EXCEPTION
      WHEN lock_not_available OR query_canceled THEN
        -- Busy table; skip and let a re-run validate it. Do NOT swallow a real
        -- check_violation -- that must propagate and fail the migration.
        n_skip := n_skip + 1;
        skipped := array_append(skipped, r.relname || ' (' || SQLSTATE || ')');
    END;
  END LOOP;

  RAISE NOTICE 'tenant-key CHECK: % validated, % skipped %', n_ok, n_skip, skipped;
END $$;

-- Rollback: none required. Validation changes no data; to revert the validated
-- state you would drop and re-add the constraints NOT VALID (see 202607300005).
