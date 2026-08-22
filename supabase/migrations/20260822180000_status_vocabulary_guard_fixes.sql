-- ============================================================================
-- Status vocabulary guard — fix-forward after the 22 Aug review (PIFH)
-- ----------------------------------------------------------------------------
-- 20260822170000 went live with five defects the adversarial review then
-- confirmed. This closes them without changing the vocabulary itself:
--   1. INSERTs that set only organization_id bypassed the guard (it fires before
--      trg_sync_org_tenant_key fills org_id) — now resolves the org from either.
--   2. A row whose status COLUMN is NULL but whose form mirror holds a word lost
--      the mirror on an unrelated edit — now the mirror is promoted when it is a
--      vocabulary word, and left alone otherwise; the mirror is only removed when
--      this very write cleared the column.
--   3. A NULL element in crm_status_vocabulary.statuses silently disabled the
--      guard — constraint + NULL-safe membership test.
--   4. fn_rollback_csv_update could no longer restore a pre-import legacy status
--      (the guard refused it and a PostgREST caller cannot set the bypass) — the
--      function now sets crm.status_guard = off for its own transaction.
--   5. auto_cancel_expired_records() wrote 'Cancelled' onto LEADS too, a word
--      outside the leads pipeline — now scoped to non-lead modules.
-- Plus three data corrections from the same review:
--   • record_type COLUMN set to 'group' where batch 1 wrote it to JSONB only (5);
--   • four contacts batch 1 moved to 'Pending' from an application-in-process
--     label carry a coverage start date already in the past — the nightly
--     activation cron would have flipped them to Active tomorrow; they become
--     'In Process' (same meaning, not auto-activated) — listed in the NOTICE;
--   • lead Linda Klumpers (batch 1: Enrolled → Converted) is linked to her
--     existing contact so the conversion is real, not a dead end.
-- ============================================================================

SET lock_timeout = '5s';

-- 3. no NULL elements
ALTER TABLE public.crm_status_vocabulary
  DROP CONSTRAINT IF EXISTS crm_status_vocabulary_no_nulls;
ALTER TABLE public.crm_status_vocabulary
  ADD CONSTRAINT crm_status_vocabulary_no_nulls CHECK (array_position(statuses, NULL) IS NULL);

-- 1 + 2 + 3. the guard, second edition
CREATE OR REPLACE FUNCTION public.crm_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_org        uuid;
  v_module     text;
  v_vocab      text[];
  v_mirror_key text;
  v_status     text;
  v_canon      text;
  v_new_mirror text;
  v_old_mirror text;
  v_new_js     text;
  v_old_js     text;
  v_in_vocab   boolean;
BEGIN
  v_org := COALESCE(NEW.org_id, NEW.organization_id);
  SELECT key INTO v_module FROM public.crm_modules WHERE id = NEW.module_id;
  SELECT statuses INTO v_vocab
    FROM public.crm_status_vocabulary
   WHERE org_id = v_org AND module_key = v_module;
  IF v_vocab IS NULL THEN
    RETURN NEW;                                   -- not a guarded org/module
  END IF;

  v_mirror_key := CASE WHEN v_module = 'leads' THEN 'lead_status' ELSE 'contact_status' END;
  NEW.data := COALESCE(NEW.data, '{}'::jsonb);

  -- A writer that changed only the JSONB mirror (or data.status) and not the
  -- column: promote it, the column is the truth. data.status wins last, as in
  -- the application's own mirror.
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    v_new_mirror := NULLIF(btrim(NEW.data->>v_mirror_key), '');
    v_old_mirror := NULLIF(btrim(COALESCE(OLD.data, '{}'::jsonb)->>v_mirror_key), '');
    IF v_new_mirror IS NOT NULL AND v_new_mirror IS DISTINCT FROM v_old_mirror THEN
      NEW.status := v_new_mirror;
    END IF;
    v_new_js := NULLIF(btrim(NEW.data->>'status'), '');
    v_old_js := NULLIF(btrim(COALESCE(OLD.data, '{}'::jsonb)->>'status'), '');
    IF v_new_js IS NOT NULL AND v_new_js IS DISTINCT FROM v_old_js THEN
      NEW.status := v_new_js;
    END IF;
  END IF;

  -- Column NULL but the mirror holds a vocabulary word (the five null-status
  -- records, or an insert that only filled the form field): adopt it. A
  -- non-vocabulary mirror is left exactly as it is for a human.
  IF NULLIF(btrim(NEW.status), '') IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS NULL) THEN   -- not when THIS write clears it
    v_new_mirror := NULLIF(btrim(NEW.data->>v_mirror_key), '');
    IF v_new_mirror IS NOT NULL THEN
      SELECT v INTO v_canon FROM unnest(v_vocab) AS v WHERE v IS NOT NULL AND lower(v) = lower(v_new_mirror) LIMIT 1;
      IF v_canon IS NOT NULL THEN
        NEW.status := v_canon;
      END IF;
    END IF;
  END IF;

  -- Canonical spelling: trim, then a case-insensitive match onto the vocabulary.
  v_status := NULLIF(btrim(NEW.status), '');
  v_in_vocab := v_status IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(v_vocab) AS v WHERE v = v_status);
  IF v_status IS NOT NULL AND NOT v_in_vocab THEN
    SELECT v INTO v_canon FROM unnest(v_vocab) AS v WHERE v IS NOT NULL AND lower(v) = lower(v_status) LIMIT 1;
    IF v_canon IS NOT NULL THEN
      v_status := v_canon;
      v_in_vocab := true;
    END IF;
  END IF;
  NEW.status := v_status;

  -- The guard proper: refuse a CHANGE to a word outside the vocabulary.
  IF v_status IS NOT NULL
     AND NOT v_in_vocab
     AND (TG_OP = 'INSERT' OR v_status IS DISTINCT FROM OLD.status)
     AND COALESCE(NULLIF(current_setting('crm.status_guard', true), ''), 'on') <> 'off' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('Status "%s" is not in the %s vocabulary. Allowed: %s', v_status, v_module, array_to_string(v_vocab, ', ')),
      HINT    = 'Choose one of the allowed statuses. A legacy value already on a record is kept until it is migrated.';
  END IF;

  -- The mirror follows the column, always.
  IF v_status IS NULL THEN
    -- only this write clearing the column removes the mirror; a column that
    -- was already NULL keeps whatever the form field holds (see above)
    IF TG_OP = 'UPDATE' AND OLD.status IS NOT NULL THEN
      NEW.data := NEW.data - v_mirror_key;
      IF NEW.data ? 'status' THEN NEW.data := NEW.data - 'status'; END IF;
    END IF;
  ELSE
    IF NEW.data->>v_mirror_key IS DISTINCT FROM v_status THEN
      NEW.data := NEW.data || jsonb_build_object(v_mirror_key, v_status);
    END IF;
    IF (NEW.data ? 'status') AND NEW.data->>'status' IS DISTINCT FROM v_status THEN
      NEW.data := NEW.data || jsonb_build_object('status', v_status);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. the CSV-update undo sets the bypass for its own transaction
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
  -- Restoring a pre-import status may legitimately be a word outside the
  -- vocabulary (20260822170000): the undo must win, so the guard's change
  -- rule is off for this transaction (spelling + mirror rules still apply).
  PERFORM set_config('crm.status_guard', 'off', true);
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

-- 5. the nightly cancel sweep never writes a lifecycle word onto a lead
CREATE OR REPLACE FUNCTION public.auto_cancel_expired_records() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE crm_records c
    SET status = 'Cancelled',
        data = COALESCE(c.data, '{}'::jsonb) || jsonb_build_object(
          'contact_status', 'Cancelled',
          'auto_cancelled_at', to_char(now(), 'YYYY-MM-DD'),
          'auto_cancelled_reason', 'Cancellation date passed'
        ),
        updated_at = now()
    WHERE c.cancellation_date IS NOT NULL
      AND c.cancellation_date < CURRENT_DATE
      AND c.status NOT IN ('Cancelled', 'Terminated', 'Archived', 'Deceased')
      -- leads carry a pipeline status, not a lifecycle one
      AND NOT EXISTS (SELECT 1 FROM crm_modules m WHERE m.id = c.module_id AND m.key = 'leads')
    RETURNING c.id
  )
  SELECT count(*) INTO v_count FROM expired;

  RETURN jsonb_build_object('cancelled_count', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- Data corrections (PIFH)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_org constant uuid := '00000000-0000-0000-0000-000000000001';
  v_n int; v_names text;
BEGIN
  -- record_type column follows the JSONB value batch 1 wrote
  UPDATE public.crm_records
     SET record_type = 'group'
   WHERE org_id = v_org AND deleted_at IS NULL
     AND data->>'record_type' = 'group'
     AND record_type IS DISTINCT FROM 'group';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'record_type column set to group on % records', v_n;

  -- applications still in process must not be auto-activated by the cron
  WITH moved AS (
    UPDATE public.crm_records c
       SET status = 'In Process'
      FROM public.crm_modules m
     WHERE m.id = c.module_id AND m.key IN ('contacts','members')
       AND c.org_id = v_org AND c.deleted_at IS NULL
       AND c.status = 'Pending'
       AND c.data->>'legacy_status' IN ('Application in Process','B Enrollment Application','Sedera App in Process','Sedera Application in Process','LHS App Incomplete')
       AND COALESCE(c.original_start_date, c.current_year_start_date,
                    NULLIF(c.data->>'start_date','')::date) <= CURRENT_DATE
    RETURNING c.title
  )
  SELECT count(*), string_agg(title, ', ' ORDER BY title) INTO v_n, v_names FROM moved;
  RAISE NOTICE 'Pending → In Process (past start date, application in flight): % — %', v_n, COALESCE(v_names, '—');

  -- Linda Klumpers: the converted lead points at her existing contact
  UPDATE public.crm_records
     SET data = data || jsonb_build_object('converted_contact_id', '89683cde-0049-4a45-aabc-f46667d3bff2',
                                           'converted_date', COALESCE(data->>'converted_date', to_char(CURRENT_DATE,'YYYY-MM-DD')))
   WHERE id = '31ea02ef-1587-454c-834d-a144b69a0ef7' AND org_id = v_org
     AND NULLIF(data->>'converted_contact_id','') IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'converted lead linked to contact: %', v_n;
END $$;
