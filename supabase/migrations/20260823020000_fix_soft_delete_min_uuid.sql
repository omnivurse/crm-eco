-- 20260823020000_fix_soft_delete_min_uuid.sql
--
-- FB-5 (Road to Ten wave 2): record delete → Trash was broken at the RPC layer.
-- crm_soft_delete_records_bulk (and therefore crm_soft_delete_record, the ONLY
-- delete path the record page + bulk delete use) and crm_restore_batch resolve
-- the org with `min(coalesce(organization_id, org_id))` — but Postgres has NO
-- min(uuid) aggregate (202606230002 even documents that), so every call fails:
--   ERROR: function min(uuid) does not exist
-- and DELETE /api/crm/records/[id] answers 500.
--
-- Fix: pick the org with `(array_agg(...))[1]` instead. Both call sites operate
-- under a single-org invariant (the bulk function rejects cross-org batches
-- right below the SELECT; a trash batch is created for exactly one org), so
-- "first aggregated value" and "minimum" identify the same org.
--
-- Additive + reversible: CREATE OR REPLACE of two functions; the previous
-- definitions live in 202607140003_crm_records_soft_delete.sql (rollback =
-- re-run its two definitions, restoring the min() text — see block at the end).

CREATE OR REPLACE FUNCTION public.crm_soft_delete_records_bulk(
  p_record_ids uuid[],
  p_origin text DEFAULT 'user'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_org       uuid;
  v_batch     uuid := gen_random_uuid();
  v_ids       uuid[];
  v_count     integer;
BEGIN
  IF p_record_ids IS NULL OR array_length(p_record_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No record ids supplied' USING errcode = '22023';
  END IF;

  -- All targeted, currently-live records the caller may delete, sharing one org.
  -- (array_agg(...))[1] instead of min(...): Postgres has no min(uuid), and the
  -- cross-org guard below makes any aggregated value THE org.
  SELECT array_agg(r.id), (array_agg(coalesce(r.organization_id, r.org_id)))[1]
    INTO v_ids, v_org
  FROM public.crm_records r
  WHERE r.id = ANY(p_record_ids)
    AND r.deleted_at IS NULL;

  IF v_ids IS NULL THEN
    -- Nothing live to delete (already trashed or not found) — no-op, no batch.
    RETURN NULL;
  END IF;

  -- Reject cross-org batches and enforce role on the resolved org.
  IF (SELECT count(DISTINCT coalesce(organization_id, org_id))
        FROM public.crm_records WHERE id = ANY(v_ids)) <> 1 THEN
    RAISE EXCEPTION 'Records span multiple organizations' USING errcode = '22023';
  END IF;

  IF NOT public.has_crm_role(v_org, ARRAY['crm_admin','crm_manager']) THEN
    RAISE EXCEPTION 'Not authorized to delete records' USING errcode = '42501';
  END IF;

  UPDATE public.crm_records
     SET deleted_at = now(),
         deleted_by = v_uid,
         delete_batch_id = v_batch,
         deleted_origin = p_origin
   WHERE id = ANY(v_ids)
     AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.crm_trash_batches
    (id, organization_id, root_table, root_ids, item_count, origin, actor_id)
  VALUES
    (v_batch, v_org, 'crm_records', v_ids, v_count, p_origin, v_uid);

  RETURN v_batch;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_restore_batch(p_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org   uuid;
  v_count integer;
BEGIN
  -- A trash batch belongs to exactly one org; (array_agg(...))[1] replaces the
  -- nonexistent min(uuid).
  SELECT (array_agg(coalesce(organization_id, org_id)))[1] INTO v_org
  FROM public.crm_records WHERE delete_batch_id = p_batch_id;

  IF v_org IS NULL THEN
    RETURN 0; -- nothing to restore
  END IF;
  IF NOT public.has_crm_role(v_org, ARRAY['crm_admin','crm_manager']) THEN
    RAISE EXCEPTION 'Not authorized to restore records' USING errcode = '42501';
  END IF;

  UPDATE public.crm_records
     SET deleted_at = NULL, deleted_by = NULL,
         delete_batch_id = NULL, deleted_origin = NULL
   WHERE delete_batch_id = p_batch_id
     AND deleted_at IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.crm_trash_batches
     SET restored_at = now()
   WHERE id = p_batch_id AND restored_at IS NULL;

  RETURN v_count;
END;
$$;

-- ─── ROLLBACK ────────────────────────────────────────────────────────────────
-- Re-apply the two definitions from 202607140003_crm_records_soft_delete.sql
-- (crm_soft_delete_records_bulk lines 90-153, crm_restore_batch lines 170-201).
-- Note that doing so restores the min(uuid) failure.
