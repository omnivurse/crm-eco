-- Harden fn_rollback_import: require authenticated CRM admin/manager for the
-- job's org before deleting inserted records. Additive CREATE OR REPLACE.
-- Rollback: restore prior function body from migrations_archive/202603110011.

SET lock_timeout = '5s';

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
  -- Fail closed for anon. Service role may call without a user JWT (jobs).
  IF v_uid IS NULL AND NOT v_is_service THEN
    error_message := 'Not authenticated';
    deleted_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_job FROM crm_import_jobs WHERE id = p_job_id;

  IF v_job IS NULL THEN
    error_message := 'Import job not found';
    deleted_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Authenticated users must be CRM admin/manager on the job's org.
  IF NOT v_is_service
     AND NOT COALESCE(has_crm_role(v_job.org_id, ARRAY['crm_admin', 'crm_manager']::text[]), false)
  THEN
    error_message := 'Forbidden';
    deleted_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT v_job.can_rollback THEN
    error_message := 'This import job cannot be rolled back';
    deleted_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_job.rolled_back_at IS NOT NULL THEN
    error_message := 'This import was already rolled back';
    deleted_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Soft-delete preferred when column exists; fall back to hard delete of
  -- inserted-only rows scoped to the job's org (never cross-tenant).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_records'
      AND column_name = 'deleted_at'
  ) THEN
    UPDATE crm_records
    SET
      deleted_at = now(),
      deleted_origin = COALESCE(deleted_origin, 'import_rollback')
    WHERE org_id = v_job.org_id
      AND id IN (
        SELECT r.record_id FROM crm_import_rows r
        WHERE r.job_id = p_job_id
          AND r.status = 'inserted'
          AND r.record_id IS NOT NULL
      )
      AND deleted_at IS NULL;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSE
    DELETE FROM crm_records
    WHERE org_id = v_job.org_id
      AND id IN (
        SELECT r.record_id FROM crm_import_rows r
        WHERE r.job_id = p_job_id
          AND r.status = 'inserted'
          AND r.record_id IS NOT NULL
      );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  UPDATE crm_import_jobs
  SET rolled_back_at = now(),
      status = 'cancelled'
  WHERE id = p_job_id
    AND org_id = v_job.org_id;

  UPDATE crm_import_rows
  SET status = 'skipped'
  WHERE job_id = p_job_id AND status = 'inserted';

  deleted_count := v_deleted;
  error_message := NULL;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.fn_rollback_import(uuid) IS
  'Rolls back an import by soft-deleting (or deleting) inserted records. Requires has_crm_role admin/manager for the job org.';

REVOKE ALL ON FUNCTION public.fn_rollback_import(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_rollback_import(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_rollback_import(uuid) TO service_role;
