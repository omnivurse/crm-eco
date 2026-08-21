-- Follow-ups to the 2026-08-20 CSV-hardening push, found by post-deploy review.
--
-- (a) reap_stalled_import_jobs is now called by a 15-minute cron
--     (apps/crm/vercel.json → /api/cron/reap-stalled-import-jobs). The
--     function pre-dates that cron and was effectively dormant; running it on
--     a schedule exposed two faults:
--
--       1. crm_import_jobs is a SHARED table. Data jobs (dedupe / merge /
--          mass_update / mass_delete / enrich) are inserted with
--          source_type='data_job', status='pending' and sit there until an
--          admin approves them. The sweep has no source_type filter, so every
--          job waiting more than an hour for a human was being marked
--          'failed' — a job the admin never ran, shown as terminal in the UI.
--
--       2. A resumable CSV apply legitimately stays 'processing' for the
--          length of the file (each pass stops at a time budget and the client
--          continues). Reaping on the ORIGINAL start time killed long runs
--          mid-file; the next resume pass was then refused and the roster
--          stopped half-applied.
--
--     Fixed by scoping to genuine import kinds and by reaping on LAST
--     ACTIVITY (stats.last_pass_at, written by each pass) instead of first.
--
-- (b) crm_name_dob_key kept Supabase's default grant to `anon` — the only one
--     of the four new functions not revoked. Harmless in itself (it is a pure
--     function over its own argument and touches no table) but inconsistent.
--
-- (c) fn_rollback_import lost `AND org_id = v_job.org_id` on its final UPDATE
--     when 20260820140000 re-issued the body. Tautological today, but
--     fn_rollback_csv_update's comment claims to match it. Restored, and the
--     crm_import_rows UPDATE is now org-scoped through the job as well.
--
-- Rollback: re-apply 20260804110101 (reap function) and 20260820140000
--   (fn_rollback_import); `GRANT ALL ON FUNCTION public.crm_name_dob_key(jsonb) TO anon;`

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- (a) scope the sweep
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reap_stalled_import_jobs(
  p_older_than interval DEFAULT '01:00:00'::interval
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.crm_import_jobs
     SET status        = 'failed',
         error_message = COALESCE(error_message, 'Abandoned: no terminal status recorded'),
         completed_at  = now()
   WHERE status IN ('pending', 'validating', 'processing')
     -- Only real import runs. `data_job` rows wait on human approval and are
     -- not stalled; anything unrecognised is left alone rather than failed.
     AND source_type IN ('csv', 'csv_upload', 'csv_update', 'export', 'zoho')
     -- Last activity, not first: a resumable apply heartbeats stats.last_pass_at
     -- on every pass, so a long healthy run is never reaped mid-file.
     AND GREATEST(
           COALESCE((stats ->> 'last_pass_at')::timestamptz, '-infinity'::timestamptz),
           COALESCE(started_at, created_at)
         ) < now() - p_older_than;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- (b) match the other new functions' privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.crm_name_dob_key(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_name_dob_key(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_name_dob_key(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_name_dob_key(jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- (c) restore the org predicate fn_rollback_import used to carry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_rollback_import(p_job_id uuid)
RETURNS TABLE(deleted_count int, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_deleted int := 0;
  v_uid uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
BEGIN
  IF v_uid IS NULL AND NOT v_is_service THEN
    error_message := 'Not authenticated'; deleted_count := 0; RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_job FROM crm_import_jobs WHERE id = p_job_id;

  IF v_job IS NULL THEN
    error_message := 'Import job not found'; deleted_count := 0; RETURN NEXT; RETURN;
  END IF;

  IF NOT v_is_service
     AND NOT COALESCE(has_crm_role(v_job.org_id, ARRAY['crm_admin', 'crm_manager']::text[]), false)
  THEN
    error_message := 'Forbidden'; deleted_count := 0; RETURN NEXT; RETURN;
  END IF;

  IF v_job.source_type = 'csv_update' THEN
    error_message := 'This is a CSV update, not an insert import — use fn_rollback_csv_update';
    deleted_count := 0; RETURN NEXT; RETURN;
  END IF;

  IF NOT v_job.can_rollback THEN
    error_message := 'This import job cannot be rolled back'; deleted_count := 0; RETURN NEXT; RETURN;
  END IF;

  IF v_job.rolled_back_at IS NOT NULL THEN
    error_message := 'This import was already rolled back'; deleted_count := 0; RETURN NEXT; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'crm_records' AND column_name = 'deleted_at'
  ) THEN
    UPDATE crm_records
       SET deleted_at = now(),
           deleted_origin = COALESCE(deleted_origin, 'import_rollback')
     WHERE org_id = v_job.org_id
       AND deleted_at IS NULL
       AND id IN (
         SELECT r.record_id FROM crm_import_rows r
          WHERE r.job_id = p_job_id AND r.status = 'inserted' AND r.record_id IS NOT NULL
       );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSE
    DELETE FROM crm_records
     WHERE org_id = v_job.org_id
       AND id IN (
         SELECT r.record_id FROM crm_import_rows r
          WHERE r.job_id = p_job_id AND r.status = 'inserted' AND r.record_id IS NOT NULL
       );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  UPDATE crm_import_jobs
     SET rolled_back_at = now(), status = 'cancelled'
   WHERE id = p_job_id
     AND org_id = v_job.org_id;

  UPDATE crm_import_rows
     SET status = 'skipped'
   WHERE job_id = p_job_id
     AND status = 'inserted';

  deleted_count := v_deleted;
  error_message := NULL;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_rollback_import(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_rollback_import(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_rollback_import(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_rollback_import(uuid) TO service_role;
