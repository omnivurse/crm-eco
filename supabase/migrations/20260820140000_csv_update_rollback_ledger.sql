-- CSV-update rollback ledger.
-- NOT applied by the authoring agent — rehearse on staging, then `supabase db push`.
--
-- Why:
--   fn_rollback_import only soft-deletes rows an import INSERTED. A monthly
--   catch-up file performs UPDATEs, so that function reverts nothing — yet it
--   still stamps rolled_back_at and status='cancelled', making an un-reverted
--   batch look rolled back. There is currently no way to undo a CSV update.
--
-- What this adds (all additive; no existing column or row is modified):
--   (a) crm_import_jobs.can_rollback / .rolled_back_at
--       The DEPLOYED fn_rollback_import (20260719190645) already dereferences
--       v_job.can_rollback, but NO migration in supabase/migrations ever
--       created it — only migrations_archive/202603110011, which was never
--       applied. So fn_rollback_import currently raises at call time for every
--       job. Nothing in the app calls it, so the breakage is latent.
--   (b) crm_import_rows before/after images for csv_update rows.
--       status 'updated' is already permitted by crm_import_rows_status_check;
--       match_type is NOT widened — the csv matcher's key ('zoho_id' | 'email'
--       | 'phone' | 'name_dob') is recorded in match_key, and match_type keeps
--       to the existing allowed vocabulary.
--   (c) fn_rollback_csv_update(job_id) — CONDITIONAL restore.
--   (d) fn_rollback_import refuses source_type='csv_update' instead of
--       silently reverting nothing.
--
-- Rollback of THIS migration:
--   DROP FUNCTION IF EXISTS public.fn_rollback_csv_update(uuid);
--   ALTER TABLE public.crm_import_rows
--     DROP COLUMN IF EXISTS before_patch,
--     DROP COLUMN IF EXISTS applied_patch,
--     DROP COLUMN IF EXISTS record_updated_at_before,
--     DROP COLUMN IF EXISTS match_key;
--   -- (leave crm_import_jobs.can_rollback / rolled_back_at in place: the
--   --  deployed fn_rollback_import requires them.)
--   -- then re-apply 20260719190645_harden_fn_rollback_import.sql to restore
--   -- the previous fn_rollback_import body.

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- (a) Job-level rollback bookkeeping the deployed function already expects
-- ---------------------------------------------------------------------------
ALTER TABLE public.crm_import_jobs
  ADD COLUMN IF NOT EXISTS can_rollback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rolled_back_at timestamptz;

COMMENT ON COLUMN public.crm_import_jobs.can_rollback IS
  'Set true by a writer that recorded per-row before-images. Defaults false so a job without a ledger can never be "rolled back" into a no-op.';

-- ---------------------------------------------------------------------------
-- (b) Per-row before/after images
-- ---------------------------------------------------------------------------
ALTER TABLE public.crm_import_rows
  ADD COLUMN IF NOT EXISTS before_patch jsonb,
  ADD COLUMN IF NOT EXISTS applied_patch jsonb,
  ADD COLUMN IF NOT EXISTS record_updated_at_before timestamptz,
  ADD COLUMN IF NOT EXISTS match_key text;

COMMENT ON COLUMN public.crm_import_rows.before_patch IS
  'Prior values of ONLY the keys this row changed: {"data": {...}, "columns": {...}}. Restore source for fn_rollback_csv_update.';
COMMENT ON COLUMN public.crm_import_rows.applied_patch IS
  'Values this row wrote: {"data": {...}, "columns": {...}}. Rollback restores a key ONLY while the live value still equals what was applied, so later human edits are never clobbered.';

-- No new index: idx_crm_import_rows_status is already btree (job_id, status),
-- which is exactly what the rollback scan needs. A duplicate would cost write
-- throughput on every import row for nothing.
--
-- before_patch / applied_patch hold copies of RECORD CONTENT. The existing
-- "CRM members can view import rows" policy lets any org member SELECT this
-- table, which would turn the ledger into a side-channel around whatever
-- record-level visibility the product enforces. Column-level privileges are
-- checked independently of RLS, so revoke these two columns outright — the
-- rollback function is SECURITY DEFINER and does not need the caller to hold
-- them.
-- A column-level REVOKE alone does nothing while a TABLE-level SELECT grant
-- exists (the table grant covers every column). Drop the table grant and
-- re-grant every column except the two before/after images. Built dynamically
-- so a future column is included automatically rather than silently losing
-- visibility. No application code SELECTs this table today — the import paths
-- only INSERT/UPDATE, and the rollback function is SECURITY DEFINER.
DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name  = 'crm_import_rows'
     AND column_name NOT IN ('before_patch', 'applied_patch');

  EXECUTE 'REVOKE SELECT ON public.crm_import_rows FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.crm_import_rows TO authenticated', v_cols);
  EXECUTE 'REVOKE SELECT ON public.crm_import_rows FROM anon';
END $$;

-- ---------------------------------------------------------------------------
-- (c) Conditional restore
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_rollback_csv_update(p_job_id uuid)
RETURNS TABLE(
  restored_count int,
  skipped_changed_count int,
  skipped_missing_count int,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
-- The `authenticated` role carries statement_timeout=8s. Restoring a
-- few thousand records cannot finish in 8s, and the rollback would abort
-- part-way — leaving a half-undone batch. Raise it for this function only.
SET statement_timeout = '120s'
AS $$
DECLARE
  v_job          RECORD;
  v_row          RECORD;
  v_rec          RECORD;
  v_uid          uuid    := auth.uid();
  v_is_service   boolean := coalesce(auth.role(), '') = 'service_role';
  v_restored     int     := 0;
  v_changed      int     := 0;
  v_missing      int     := 0;
  v_restore_data jsonb;
  v_key          text;
  v_before_val   jsonb;
  v_applied_val  jsonb;
  v_live_val     jsonb;
  v_any_key      boolean;
  v_before_cols  jsonb;
  v_applied_cols jsonb;
  v_set_list     text;
  v_col_type     text;
  v_touched      boolean;
  v_null_keys    text[];
BEGIN
  restored_count := 0; skipped_changed_count := 0; skipped_missing_count := 0;

  IF v_uid IS NULL AND NOT v_is_service THEN
    error_message := 'Not authenticated'; RETURN NEXT; RETURN;
  END IF;

  -- Lock the job row: two concurrent undos of the same job would otherwise
  -- both pass the rolled_back_at check and restore twice, and the second one
  -- would see the first's output as the live value.
  SELECT * INTO v_job FROM crm_import_jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job IS NULL THEN
    error_message := 'Import job not found'; RETURN NEXT; RETURN;
  END IF;

  IF NOT v_is_service
     AND NOT COALESCE(has_crm_role(v_job.org_id, ARRAY['crm_admin', 'crm_manager']::text[]), false)
  THEN
    error_message := 'Forbidden'; RETURN NEXT; RETURN;
  END IF;

  IF v_job.source_type IS DISTINCT FROM 'csv_update' THEN
    error_message := 'This job is not a CSV update — use fn_rollback_import';
    RETURN NEXT; RETURN;
  END IF;

  IF NOT v_job.can_rollback THEN
    error_message := 'This update has no before-images recorded and cannot be rolled back';
    RETURN NEXT; RETURN;
  END IF;

  IF v_job.rolled_back_at IS NOT NULL THEN
    error_message := 'This update was already rolled back'; RETURN NEXT; RETURN;
  END IF;

  -- A later csv_update touching the same records would make this restore
  -- reinstate values the newer job legitimately replaced. Refuse instead.
  -- Only a later job that actually WROTE one of these records blocks the undo.
  -- Without the status filter a later job that matched nothing (every row
  -- unchanged or unmatched) would permanently block this one. The tuple
  -- comparison breaks timestamp ties deterministically by id, so two jobs
  -- started in the same millisecond cannot each consider the other "later".
  IF EXISTS (
    SELECT 1
      FROM crm_import_rows r
      JOIN crm_import_jobs j2 ON j2.id = r.job_id
     WHERE j2.org_id      = v_job.org_id
       AND j2.source_type  = 'csv_update'
       AND j2.id          <> v_job.id
       AND j2.rolled_back_at IS NULL
       AND r.status = 'updated'
       AND (COALESCE(j2.started_at, j2.created_at), j2.id)
           > (COALESCE(v_job.started_at, v_job.created_at), v_job.id)
       AND r.record_id IN (
         SELECT record_id FROM crm_import_rows
          WHERE job_id = p_job_id AND status = 'updated' AND record_id IS NOT NULL
       )
  ) THEN
    error_message := 'A later CSV update touched these records — roll that job back first';
    RETURN NEXT; RETURN;
  END IF;

  -- Group by RECORD, not by ledger row. If one job wrote the same record more
  -- than once (a retried resume pass), replaying rows in order would restore
  -- the second row's before-image — an INTERMEDIATE value the record never
  -- had before the import. Collapse to the EARLIEST before-value per key and
  -- the LATEST applied-value per key, so "undo" always means "back to how it
  -- was before this job touched it".
  FOR v_row IN
    SELECT
      rec.record_id,
      (SELECT jsonb_object_agg(k, v) FROM (
         SELECT DISTINCT ON (e.key) e.key AS k, e.value AS v
           FROM crm_import_rows r, jsonb_each(COALESCE(r.before_patch -> 'data', '{}'::jsonb)) e
          WHERE r.job_id = p_job_id AND r.record_id = rec.record_id
            AND r.status = 'updated' AND r.before_patch IS NOT NULL
          ORDER BY e.key, r.row_index ASC, r.id ASC
       ) s) AS before_data,
      (SELECT jsonb_object_agg(k, v) FROM (
         SELECT DISTINCT ON (e.key) e.key AS k, e.value AS v
           FROM crm_import_rows r, jsonb_each(COALESCE(r.applied_patch -> 'data', '{}'::jsonb)) e
          WHERE r.job_id = p_job_id AND r.record_id = rec.record_id
            AND r.status = 'updated' AND r.before_patch IS NOT NULL
          ORDER BY e.key, r.row_index DESC, r.id DESC
       ) s) AS applied_data,
      (SELECT jsonb_object_agg(k, v) FROM (
         SELECT DISTINCT ON (e.key) e.key AS k, e.value AS v
           FROM crm_import_rows r, jsonb_each(COALESCE(r.before_patch -> 'columns', '{}'::jsonb)) e
          WHERE r.job_id = p_job_id AND r.record_id = rec.record_id
            AND r.status = 'updated' AND r.before_patch IS NOT NULL
          ORDER BY e.key, r.row_index ASC, r.id ASC
       ) s) AS before_cols,
      (SELECT jsonb_object_agg(k, v) FROM (
         SELECT DISTINCT ON (e.key) e.key AS k, e.value AS v
           FROM crm_import_rows r, jsonb_each(COALESCE(r.applied_patch -> 'columns', '{}'::jsonb)) e
          WHERE r.job_id = p_job_id AND r.record_id = rec.record_id
            AND r.status = 'updated' AND r.before_patch IS NOT NULL
          ORDER BY e.key, r.row_index DESC, r.id DESC
       ) s) AS applied_cols
    FROM (
      SELECT DISTINCT record_id
        FROM crm_import_rows
       WHERE job_id = p_job_id
         AND status = 'updated'
         AND record_id IS NOT NULL
         AND before_patch IS NOT NULL
    ) rec
  LOOP
    -- FOR UPDATE so the conditional comparison and the write below cannot
    -- straddle someone else's edit to the same record.
    SELECT id, data INTO v_rec
      FROM crm_records
     WHERE id = v_row.record_id
       AND org_id = v_job.org_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF v_rec IS NULL THEN
      v_missing := v_missing + 1;
      CONTINUE;
    END IF;

    v_restore_data := '{}'::jsonb;
    v_any_key := false;

    -- Restore a key ONLY while the live value still equals what this job
    -- wrote. A key edited since the import belongs to whoever edited it.
    FOR v_key IN SELECT jsonb_object_keys(COALESCE(v_row.before_data, '{}'::jsonb))
    LOOP
      v_before_val  := v_row.before_data  -> v_key;
      v_applied_val := v_row.applied_data -> v_key;
      v_live_val    := v_rec.data -> v_key;

      IF v_applied_val IS NOT DISTINCT FROM v_live_val THEN
        IF v_before_val IS NULL OR v_before_val = 'null'::jsonb THEN
          -- The key did not exist before this import: remove it again.
          v_restore_data := v_restore_data || jsonb_build_object(v_key, NULL);
        ELSE
          v_restore_data := v_restore_data || jsonb_build_object(v_key, v_before_val);
        END IF;
        v_any_key := true;
      ELSE
        v_changed := v_changed + 1;
      END IF;
    END LOOP;

    -- INDEXED COLUMNS. The import writes status / stage / title / email /
    -- phone and the derived date+carrier mirrors — the columns the
    -- activation and cancellation crons read. Restoring only `data` while
    -- stamping the job "rolled back" would leave those columns carrying the
    -- import's values with no way to ever undo them.
    v_before_cols  := COALESCE(v_row.before_cols, '{}'::jsonb);
    v_applied_cols := COALESCE(v_row.applied_cols, '{}'::jsonb);
    v_set_list := '';

    FOR v_key IN SELECT jsonb_object_keys(v_before_cols)
    LOOP
      -- Never let a ledger key name a column that is not safe to write.
      IF v_key IN ('id','org_id','organization_id','module_id','created_at',
                   'created_by','updated_at','deleted_at','deleted_by',
                   'deleted_origin') THEN
        CONTINUE;
      END IF;

      SELECT format_type(a.atttypid, a.atttypmod) INTO v_col_type
        FROM pg_attribute a
       WHERE a.attrelid = 'public.crm_records'::regclass
         AND a.attname = v_key
         AND a.attnum > 0
         AND NOT a.attisdropped;
      IF v_col_type IS NULL THEN
        CONTINUE;  -- ledger names a column this database does not have
      END IF;

      -- Same conditional rule as the JSONB half: put the column back only
      -- while it still holds exactly what this job wrote.
      v_set_list := v_set_list || format(
        '%I = CASE WHEN %I::text IS NOT DISTINCT FROM %L THEN %L::%s ELSE %I END, ',
        v_key, v_key,
        v_applied_cols ->> v_key,
        v_before_cols  ->> v_key, v_col_type,
        v_key);
    END LOOP;

    -- ONE statement for both halves. Splitting them was wrong: crm_records
    -- has a BEFORE UPDATE trigger (set_record_title) that rewrites derived
    -- columns whenever `data` changes, so a separate first UPDATE would move
    -- the very values the column conditions are compared against, and every
    -- column restore would then fall through to its ELSE branch. Inside a
    -- single UPDATE all SET expressions see the pre-update row.
    v_touched := false;

    IF v_any_key OR v_set_list <> '' THEN
      SELECT COALESCE(array_agg(k), ARRAY[]::text[]) INTO v_null_keys
        FROM jsonb_each(v_restore_data) AS e(k, val)
       WHERE val = 'null'::jsonb;

      EXECUTE format(
        'UPDATE public.crm_records SET %s data = (data || $3) - $4 '
        'WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL',
        v_set_list)
      USING v_rec.id, v_job.org_id, v_restore_data, v_null_keys;
      v_touched := true;
    END IF;

    IF v_touched THEN
      v_restored := v_restored + 1;
    END IF;
  END LOOP;

  UPDATE crm_import_jobs
     SET rolled_back_at = now(),
         status = 'cancelled',
         stats = COALESCE(stats, '{}'::jsonb) || jsonb_build_object(
           'rollback', jsonb_build_object(
             'restored_records',  v_restored,
             'skipped_changed_keys', v_changed,
             'skipped_missing_records', v_missing,
             'rolled_back_by', v_uid
           ))
   WHERE id = p_job_id
     AND org_id = v_job.org_id;  -- defence in depth, matching fn_rollback_import

  restored_count        := v_restored;
  skipped_changed_count := v_changed;
  skipped_missing_count := v_missing;
  error_message         := NULL;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.fn_rollback_csv_update(uuid) IS
  'Undo a csv_update import by restoring per-key before-images, but ONLY for keys whose live value still equals what the import wrote. Keys edited since the import are left alone and counted in skipped_changed_count. Note: crm_records has BEFORE UPDATE triggers that stamp updated_at, so a rollback sets a fresh updated_at; it does not restore the original timestamp.';

REVOKE ALL ON FUNCTION public.fn_rollback_csv_update(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_rollback_csv_update(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_rollback_csv_update(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_rollback_csv_update(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (d) Stop fn_rollback_import from pretending it reverted a CSV update
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

  -- NEW: a csv_update job has no INSERTED rows, so this function would revert
  -- nothing yet still stamp the job as rolled back.
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
   WHERE id = p_job_id;

  UPDATE crm_import_rows
     SET status = 'skipped'
   WHERE job_id = p_job_id AND status = 'inserted';

  deleted_count := v_deleted;
  error_message := NULL;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_rollback_import(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_rollback_import(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_rollback_import(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_rollback_import(uuid) TO service_role;
