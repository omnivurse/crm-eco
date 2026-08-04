-- Import jobs: honest partial-failure status + a reaper for abandoned runs.
-- Project: sffisarikcreyyjzdjvb
-- Status: NOT YET APPLIED — awaiting approval gate.
-- Risk:   LOW. Widens a CHECK constraint (strictly permissive) and adds one
--         function. No data is modified by this migration itself.
--
-- WHY
--   `completeJob` in apps/crm/src/lib/imports/supabase-csv-update-adapters.ts
--   marked a run 'failed' only when EVERY write failed:
--       status: errorCount === writeAttemptCount && writeAttemptCount > 0
--                 ? 'failed' : 'completed'
--   so 999 failures out of 1000 rows reported 'completed'. There was also no
--   reaper: a run that crashed mid-flight left its row in 'processing' forever.
--
-- DEPLOY ORDER — the two halves must ship together, MIGRATION FIRST:
--   1. apply this migration (adds 'completed_with_errors' to the allowed set)
--   2. deploy the apps/crm change that starts writing that value
--   Deploying the code first would violate the CHECK, the job update would
--   throw, and the row would be stranded in 'processing' — the exact failure
--   this migration exists to remove.

SET lock_timeout = '5s';

BEGIN;

-- 1. Allow the new terminal status. Purely additive: every value previously
--    accepted is still accepted.
ALTER TABLE public.crm_import_jobs
  DROP CONSTRAINT IF EXISTS crm_import_jobs_status_check;

ALTER TABLE public.crm_import_jobs
  ADD CONSTRAINT crm_import_jobs_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'validating'::text,
    'processing'::text,
    'completed'::text,
    'completed_with_errors'::text,
    'failed'::text,
    'cancelled'::text
  ]));

COMMENT ON COLUMN public.crm_import_jobs.status IS
  'pending | validating | processing | completed | completed_with_errors | failed | cancelled. '
  'completed_with_errors means the run finished but at least one row failed — see error_count.';

-- 2. Reaper for runs that never reached a terminal state (process crash, edge
--    timeout, deploy mid-run). Without this they sit in 'processing' forever and
--    the UI shows a permanently spinning import.
--
--    SECURITY DEFINER + service_role-only EXECUTE, matching the template set by
--    202607290003 (consume_rate_limit / gc_security_rate_limits).
CREATE OR REPLACE FUNCTION public.reap_stalled_import_jobs(p_older_than interval DEFAULT '1 hour')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.crm_import_jobs
     SET status        = 'failed',
         error_message = COALESCE(error_message, 'Abandoned: no terminal status recorded'),
         completed_at  = now()
   WHERE status IN ('pending', 'validating', 'processing')
     AND COALESCE(started_at, created_at) < now() - p_older_than;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reap_stalled_import_jobs(interval) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reap_stalled_import_jobs(interval) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Schedule separately (pg_cron), once this is applied:
--   SELECT cron.schedule('reap-stalled-import-jobs', '*/15 * * * *',
--     $$SELECT public.reap_stalled_import_jobs()$$);

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- Run BEFORE reverting the app deploy, and only after confirming no rows hold
-- the new value:
--   SELECT count(*) FROM public.crm_import_jobs WHERE status = 'completed_with_errors';
--   -- if > 0:  UPDATE public.crm_import_jobs SET status = 'completed'
--   --            WHERE status = 'completed_with_errors';
--
--   DROP FUNCTION IF EXISTS public.reap_stalled_import_jobs(interval);
--   ALTER TABLE public.crm_import_jobs DROP CONSTRAINT IF EXISTS crm_import_jobs_status_check;
--   ALTER TABLE public.crm_import_jobs
--     ADD CONSTRAINT crm_import_jobs_status_check
--     CHECK (status = ANY (ARRAY['pending'::text, 'validating'::text, 'processing'::text,
--                                'completed'::text, 'failed'::text, 'cancelled'::text]));
