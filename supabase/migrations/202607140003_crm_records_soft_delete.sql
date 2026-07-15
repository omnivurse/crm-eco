-- Phase 1 of the CRM undo-delete / recycle-bin system: soft-delete for crm_records.
--
-- Design (approved): deleting a record becomes an UPDATE that stamps deleted_at
-- instead of a physical DELETE. The existing 29-child ON DELETE CASCADE graph is
-- LEFT UNTOUCHED and only ever fires on final purge, so:
--   * nothing breaks and every existing FK/caller keeps working,
--   * children stay physically intact while trashed → restore is trivially correct
--     (they were never modified); global child lists hide them via a parent join,
--   * a true hard-delete still exists via crm_purge_record().
--
-- This migration is purely additive (nullable columns + one new table + functions),
-- so it is inert on deploy until the application starts calling the new RPCs.
-- Existing RLS policies are intentionally NOT modified in this phase: "hidden vs
-- trashed" is enforced at the query layer (reads add `deleted_at IS NULL`), and the
-- soft-delete/restore/purge writes go through SECURITY DEFINER RPCs.

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) Soft-delete columns on crm_records (nullable → all existing rows stay live)
-- ---------------------------------------------------------------------------
ALTER TABLE public.crm_records
  ADD COLUMN IF NOT EXISTS deleted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by      uuid,
  ADD COLUMN IF NOT EXISTS delete_batch_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_origin  text;

COMMENT ON COLUMN public.crm_records.deleted_at IS
  'Soft-delete timestamp. NULL = live. Non-NULL = in Trash (hidden from lists/search, restorable).';
COMMENT ON COLUMN public.crm_records.delete_batch_id IS
  'Groups records trashed together (single undo restores the whole batch).';
COMMENT ON COLUMN public.crm_records.deleted_origin IS
  'How it was trashed: user | bulk | merge | cascade | purge_pending.';

-- Trash-view lookups (small set) + keep live-list scans from touching trashed rows.
CREATE INDEX IF NOT EXISTS idx_crm_records_trash
  ON public.crm_records (organization_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_batch
  ON public.crm_records (delete_batch_id)
  WHERE delete_batch_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Trash-batch ledger (undo grouping + retention/auto-purge bookkeeping)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_trash_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  root_table      text NOT NULL,
  root_ids        uuid[] NOT NULL,
  item_count      integer NOT NULL DEFAULT 0,
  origin          text,
  actor_id        uuid,
  deleted_at      timestamptz NOT NULL DEFAULT now(),
  purge_after     timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  restored_at     timestamptz,
  purged_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_crm_trash_batches_org
  ON public.crm_trash_batches (organization_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_trash_batches_purge
  ON public.crm_trash_batches (purge_after)
  WHERE restored_at IS NULL AND purged_at IS NULL;

ALTER TABLE public.crm_trash_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_trash_batches_select ON public.crm_trash_batches;
CREATE POLICY crm_trash_batches_select ON public.crm_trash_batches
  FOR SELECT TO authenticated
  USING (public.is_crm_member(organization_id));

DROP POLICY IF EXISTS crm_trash_batches_service ON public.crm_trash_batches;
CREATE POLICY crm_trash_batches_service ON public.crm_trash_batches
  TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.crm_trash_batches TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) RPCs. SECURITY DEFINER (bypass RLS) so they can flip deleted_at, but each
--    re-validates org membership + crm_admin/crm_manager role internally — the
--    same roles as the existing "CRM admins can delete records" DELETE policy.
-- ---------------------------------------------------------------------------

-- Helper: resolve a record's org, or NULL if it isn't visible to this caller's org.
-- Uses coalesce(organization_id, org_id) because crm_records carries both (the
-- RLS policies key off organization_id; the API filters org_id — they mirror).

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
  SELECT array_agg(r.id), min(coalesce(r.organization_id, r.org_id))
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

CREATE OR REPLACE FUNCTION public.crm_soft_delete_record(
  p_record_id uuid,
  p_origin text DEFAULT 'user'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN public.crm_soft_delete_records_bulk(ARRAY[p_record_id], p_origin);
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
  SELECT min(coalesce(organization_id, org_id)) INTO v_org
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

CREATE OR REPLACE FUNCTION public.crm_restore_record(p_record_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT coalesce(organization_id, org_id) INTO v_org
  FROM public.crm_records WHERE id = p_record_id AND deleted_at IS NOT NULL;

  IF v_org IS NULL THEN
    RETURN false; -- not found or already live
  END IF;
  IF NOT public.has_crm_role(v_org, ARRAY['crm_admin','crm_manager']) THEN
    RAISE EXCEPTION 'Not authorized to restore records' USING errcode = '42501';
  END IF;

  UPDATE public.crm_records
     SET deleted_at = NULL, deleted_by = NULL,
         delete_batch_id = NULL, deleted_origin = NULL
   WHERE id = p_record_id;

  RETURN true;
END;
$$;

-- Permanent delete of a single trashed record. Storage-blob cleanup is done by the
-- API layer BEFORE calling this (SQL can't reach Storage); this does the physical
-- DB delete, which fires the existing ON DELETE CASCADE to remove all children.
CREATE OR REPLACE FUNCTION public.crm_purge_record(p_record_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- Only a record already in the Trash may be permanently deleted, so a direct
  -- RPC call can't hard-delete a LIVE record and bypass the recovery window.
  SELECT coalesce(organization_id, org_id) INTO v_org
  FROM public.crm_records WHERE id = p_record_id AND deleted_at IS NOT NULL;

  IF v_org IS NULL THEN
    RETURN false; -- not found, or not trashed
  END IF;
  IF NOT public.has_crm_role(v_org, ARRAY['crm_admin','crm_manager']) THEN
    RAISE EXCEPTION 'Not authorized to permanently delete records' USING errcode = '42501';
  END IF;

  DELETE FROM public.crm_records WHERE id = p_record_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_soft_delete_records_bulk(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_soft_delete_record(uuid, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_restore_batch(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_restore_record(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_purge_record(uuid)                     TO authenticated;

COMMENT ON FUNCTION public.crm_soft_delete_records_bulk IS
  'Undo-delete Phase 1: soft-delete crm_records (one batch), role-checked. Returns batch_id.';
COMMENT ON FUNCTION public.crm_restore_batch IS
  'Undo-delete Phase 1: restore every record in a trash batch (powers the Undo toast).';
COMMENT ON FUNCTION public.crm_purge_record IS
  'Undo-delete Phase 1: permanent hard-delete of one trashed record (fires existing cascade).';
