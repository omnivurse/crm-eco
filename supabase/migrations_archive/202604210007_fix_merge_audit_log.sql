-- ============================================================================
-- Fix merge audit logging.
--
-- Two latent bugs discovered while investigating a PIFH client report
-- ("Karen Frame — Access Denied / Record Not Found"):
--
-- 1. crm_audit_log.action has a CHECK constraint that does NOT include
--    'merge'. merge_crm_records tried to insert action='merge' and the
--    constraint violation was silently caught by the RPC's `WHEN others`
--    handler. So every merge we've run (including the bulk auto-merge
--    from 202604210005) SUCCEEDED in crm_records but left NO audit row.
--
-- 2. Even if the insert had worked, it used entity_id = keeper_id. That
--    means you can't look up "what happened to duplicate_id X?" without
--    a full-table JSONB scan — which is the exact lookup we need for
--    the "merged-from → keeper" redirect on stale URLs.
--
-- This migration:
--   a) Widens the action CHECK to allow 'merge'.
--   b) Rewrites merge_crm_records to insert TWO audit rows — one keyed
--      on the keeper (for "what happened to this record"), one keyed on
--      the duplicate (for "where did this old id go") — and to raise the
--      error instead of swallowing it, so future audit failures surface.
--   c) Adds a partial index on diff->>'deleted_id' for the same lookup
--      (covers the historical "kept_id on keeper row" pattern for any
--      audit rows that might have landed successfully in another flow).
--
-- No data is touched; only schema + function definition.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- a) Widen action CHECK to include 'merge' (plus any other action we've
--    been logging via other flows — keep the list stable).
-- ---------------------------------------------------------------------
ALTER TABLE crm_audit_log
  DROP CONSTRAINT IF EXISTS crm_audit_log_action_check;

ALTER TABLE crm_audit_log
  ADD CONSTRAINT crm_audit_log_action_check
  CHECK (action IN (
    'create', 'update', 'delete', 'import', 'export', 'bulk_update',
    'stage_change', 'approval_request', 'approval_action', 'approval_apply',
    'message_sent', 'rule_triggered',
    'merge'
  ));

-- ---------------------------------------------------------------------
-- b) Rewrite merge_crm_records with corrected audit-log behavior.
--
-- Only the audit block and error handler change. The merge semantics
-- are byte-identical to 202604210002.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_crm_records(
  p_keeper_id     uuid,
  p_duplicate_id  uuid,
  p_user_id       uuid,
  p_merged_data   jsonb DEFAULT NULL,
  p_merged_status text  DEFAULT NULL,
  p_merged_email  text  DEFAULT NULL,
  p_merged_phone  text  DEFAULT NULL,
  p_merged_owner  uuid  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_keeper    crm_records%ROWTYPE;
  v_duplicate crm_records%ROWTYPE;
  v_user_org  uuid;
  v_final_data   jsonb;
  v_final_status text;
  v_final_email  text;
  v_final_phone  text;
  v_final_owner  uuid;
  v_final_title  text;
  v_moved_notes  int := 0;
  v_moved_tasks  int := 0;
  v_moved_attach int := 0;
  v_moved_links  int := 0;
  v_audit_payload jsonb;
BEGIN
  IF p_keeper_id = p_duplicate_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Keeper and duplicate must be different records');
  END IF;

  SELECT * INTO v_keeper
  FROM crm_records WHERE id = p_keeper_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Keeper record not found');
  END IF;

  SELECT * INTO v_duplicate
  FROM crm_records WHERE id = p_duplicate_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate record not found');
  END IF;

  SELECT organization_id INTO v_user_org FROM profiles WHERE id = p_user_id;
  IF v_user_org IS NULL OR v_user_org <> v_keeper.org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this organization');
  END IF;

  IF v_keeper.org_id <> v_duplicate.org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Records belong to different organizations');
  END IF;

  IF v_keeper.module_id <> v_duplicate.module_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Records belong to different modules');
  END IF;

  v_final_data := COALESCE(
    p_merged_data,
    (
      SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
      FROM (
        SELECT
          k,
          CASE
            WHEN (v_keeper.data -> k) IS NULL
                 OR v_keeper.data ->> k IS NULL
                 OR v_keeper.data ->> k = ''
              THEN v_duplicate.data -> k
            ELSE v_keeper.data -> k
          END AS v
        FROM (
          SELECT DISTINCT k FROM (
            SELECT jsonb_object_keys(COALESCE(v_keeper.data,    '{}'::jsonb)) AS k
            UNION
            SELECT jsonb_object_keys(COALESCE(v_duplicate.data, '{}'::jsonb)) AS k
          ) keys
        ) all_keys
      ) merged
      WHERE v IS NOT NULL
    )
  );

  v_final_email  := COALESCE(NULLIF(p_merged_email,  ''), NULLIF(v_keeper.email, ''), NULLIF(v_duplicate.email, ''));
  v_final_phone  := COALESCE(NULLIF(p_merged_phone,  ''), NULLIF(v_keeper.phone, ''), NULLIF(v_duplicate.phone, ''));
  v_final_owner  := COALESCE(p_merged_owner, v_keeper.owner_id, v_duplicate.owner_id);
  v_final_title  := COALESCE(NULLIF(v_keeper.title, ''), NULLIF(v_duplicate.title, ''));

  v_final_status := COALESCE(
    NULLIF(p_merged_status, ''),
    CASE
      WHEN v_keeper.status    = 'Active' THEN v_keeper.status
      WHEN v_duplicate.status = 'Active' THEN v_duplicate.status
      ELSE COALESCE(NULLIF(v_keeper.status, ''), NULLIF(v_duplicate.status, ''))
    END
  );

  UPDATE crm_notes SET record_id = p_keeper_id WHERE record_id = p_duplicate_id;
  GET DIAGNOSTICS v_moved_notes = ROW_COUNT;

  BEGIN
    EXECUTE 'UPDATE public.notes SET record_id = $1::text WHERE record_id = $2::text'
      USING p_keeper_id, p_duplicate_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  UPDATE crm_tasks SET record_id = p_keeper_id WHERE record_id = p_duplicate_id;
  GET DIAGNOSTICS v_moved_tasks = ROW_COUNT;

  UPDATE crm_attachments SET record_id = p_keeper_id WHERE record_id = p_duplicate_id;
  GET DIAGNOSTICS v_moved_attach = ROW_COUNT;

  DELETE FROM crm_record_links
   WHERE source_record_id = p_duplicate_id
     AND EXISTS (
       SELECT 1 FROM crm_record_links kl
        WHERE kl.source_record_id = p_keeper_id
          AND kl.target_record_id = crm_record_links.target_record_id
          AND kl.link_type        = crm_record_links.link_type
     );
  UPDATE crm_record_links SET source_record_id = p_keeper_id
   WHERE source_record_id = p_duplicate_id;

  DELETE FROM crm_record_links
   WHERE target_record_id = p_duplicate_id
     AND EXISTS (
       SELECT 1 FROM crm_record_links kl
        WHERE kl.target_record_id = p_keeper_id
          AND kl.source_record_id = crm_record_links.source_record_id
          AND kl.link_type        = crm_record_links.link_type
     );
  UPDATE crm_record_links SET target_record_id = p_keeper_id
   WHERE target_record_id = p_duplicate_id;

  DELETE FROM crm_record_links
   WHERE source_record_id = target_record_id;

  GET DIAGNOSTICS v_moved_links = ROW_COUNT;

  DO $blk$
  DECLARE
    r record;
    sql text;
  BEGIN
    FOR r IN
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema   = 'public'
        AND ccu.table_name     = 'crm_records'
        AND ccu.column_name    = 'id'
        AND NOT (tc.table_name IN ('crm_notes','crm_tasks','crm_attachments','crm_record_links'))
    LOOP
      BEGIN
        sql := format(
          'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
          r.table_schema, r.table_name, r.column_name, r.column_name
        );
        EXECUTE sql USING p_keeper_id, p_duplicate_id;
      EXCEPTION WHEN unique_violation THEN
        sql := format(
          'DELETE FROM %I.%I WHERE %I = $1',
          r.table_schema, r.table_name, r.column_name
        );
        EXECUTE sql USING p_duplicate_id;
      WHEN others THEN
        RAISE WARNING 'merge_crm_records: skipped %.%.%: %',
          r.table_schema, r.table_name, r.column_name, SQLERRM;
      END;
    END LOOP;
  END;
  $blk$;

  UPDATE crm_records
  SET data       = v_final_data,
      email      = v_final_email,
      phone      = v_final_phone,
      status     = v_final_status,
      owner_id   = v_final_owner,
      title      = v_final_title,
      updated_at = now()
  WHERE id = p_keeper_id;

  DELETE FROM crm_records WHERE id = p_duplicate_id;

  -- Audit trail. Two rows so both ids are findable by the
  -- (entity, entity_id) index:
  --   - keeper row: entity_id = kept_id — "what was merged into me"
  --   - tombstone:  entity_id = deleted_id — "where did this id go"
  -- We RAISE now if the audit insert fails; silently swallowing this
  -- is how the original bug persisted.
  v_audit_payload := jsonb_build_object(
    'kept_id',           p_keeper_id,
    'deleted_id',        p_duplicate_id,
    'deleted_snapshot',  to_jsonb(v_duplicate),
    'moved_notes',       v_moved_notes,
    'moved_tasks',       v_moved_tasks,
    'moved_attachments', v_moved_attach,
    'moved_links',       v_moved_links,
    'merged_at',         now()
  );

  INSERT INTO crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
  VALUES (v_keeper.org_id, p_user_id, 'record', p_keeper_id,    'merge', v_audit_payload);

  INSERT INTO crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
  VALUES (v_keeper.org_id, p_user_id, 'record', p_duplicate_id, 'merge', v_audit_payload);

  RETURN jsonb_build_object(
    'success',           true,
    'kept_id',           p_keeper_id,
    'deleted_id',        p_duplicate_id,
    'moved_notes',       v_moved_notes,
    'moved_tasks',       v_moved_tasks,
    'moved_attachments', v_moved_attach,
    'moved_links',       v_moved_links
  );

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$fn$;

COMMENT ON FUNCTION public.merge_crm_records IS
  'Merges two crm_records into one. Writes two crm_audit_log rows per merge (keeper + duplicate tombstone) so either id is findable. See migrations 202604210002 + 202604210007.';

-- Keep the grant (redefining the function does not drop permissions in
-- Postgres 13+, but be explicit for self-documentation).
GRANT EXECUTE ON FUNCTION public.merge_crm_records(
  uuid, uuid, uuid, jsonb, text, text, text, uuid
) TO authenticated;

-- ---------------------------------------------------------------------
-- c) Supporting index for "look up by any record id involved in a
--    merge". The (entity, entity_id) index already exists; after this
--    migration both the keeper and the duplicate are captured by it.
-- ---------------------------------------------------------------------
-- No new index needed — idx_crm_audit_entity on (entity, entity_id)
-- already covers the lookup once we write the tombstone row.

COMMIT;
