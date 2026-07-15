-- Phase 5b of the CRM undo-delete system: make a mis-merge recoverable.
--
-- merge_crm_records re-parents every child row onto the keeper and then removed
-- the duplicate ("loser") with a physical DELETE. This CREATE OR REPLACE changes
-- ONLY that final statement to a soft-delete (deleted_origin='merge') so a wrong
-- merge leaves the loser restorable from Trash instead of gone forever. The full
-- deleted_snapshot audit row is still written as before.
--
-- Everything else is byte-identical to the baseline definition (baseline.sql
-- :15923). Because children are re-parented to the keeper BEFORE this point, the
-- soft-deleted loser has no children; Phase 1 read-hiding already keeps it out
-- of lists/search/detail, and resolve-record maps stale loser links to the
-- keeper. Known limitation (per design): restoring a merge loser does not
-- auto-un-reparent its children — it brings back the loser shell.
--
-- CREATE OR REPLACE preserves the existing GRANTs (incl. the anon revoke from
-- 202606130008), so grants are intentionally not re-issued here.

CREATE OR REPLACE FUNCTION public.merge_crm_records(p_keeper_id uuid, p_duplicate_id uuid, p_user_id uuid, p_merged_data jsonb DEFAULT NULL::jsonb, p_merged_status text DEFAULT NULL::text, p_merged_email text DEFAULT NULL::text, p_merged_phone text DEFAULT NULL::text, p_merged_owner uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_keeper       crm_records%ROWTYPE;
  v_duplicate    crm_records%ROWTYPE;
  v_user_org     uuid;
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
BEGIN
  IF p_keeper_id = p_duplicate_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Keeper and duplicate must be different records');
  END IF;

  -- Phase 5b: exclude already-trashed rows so a soft-deleted merge loser can't be
  -- re-merged (e.g. by bulk_auto_merge picking up the still-present loser) — that
  -- would re-stamp deleted_at and write a duplicate audit row. A trashed target
  -- now cleanly reports "not found".
  SELECT * INTO v_keeper    FROM crm_records WHERE id = p_keeper_id    AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Keeper record not found');
  END IF;

  SELECT * INTO v_duplicate FROM crm_records WHERE id = p_duplicate_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate record not found');
  END IF;

  SELECT organization_id INTO v_user_org FROM profiles WHERE id = p_user_id;
  IF v_user_org IS NULL OR v_user_org <> v_keeper.organization_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this organization');
  END IF;

  IF v_keeper.organization_id    <> v_duplicate.organization_id    THEN
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

  v_final_email  := COALESCE(NULLIF(p_merged_email, ''), NULLIF(v_keeper.email, ''), NULLIF(v_duplicate.email, ''));
  v_final_phone  := COALESCE(NULLIF(p_merged_phone, ''), NULLIF(v_keeper.phone, ''), NULLIF(v_duplicate.phone, ''));
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

  -- legacy notes table (record_id is uuid in this DB; previously cast to text by mistake)
  BEGIN
    EXECUTE 'UPDATE public.notes SET record_id = $1 WHERE record_id = $2'
      USING p_keeper_id, p_duplicate_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  UPDATE crm_tasks       SET record_id = p_keeper_id WHERE record_id = p_duplicate_id;
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
  UPDATE crm_record_links SET source_record_id = p_keeper_id WHERE source_record_id = p_duplicate_id;

  DELETE FROM crm_record_links
   WHERE target_record_id = p_duplicate_id
     AND EXISTS (
       SELECT 1 FROM crm_record_links kl
        WHERE kl.target_record_id = p_keeper_id
          AND kl.source_record_id = crm_record_links.source_record_id
          AND kl.link_type        = crm_record_links.link_type
     );
  UPDATE crm_record_links SET target_record_id = p_keeper_id WHERE target_record_id = p_duplicate_id;
  DELETE FROM crm_record_links WHERE source_record_id = target_record_id;

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
        sql := format('UPDATE %I.%I SET %I = $1 WHERE %I = $2',
          r.table_schema, r.table_name, r.column_name, r.column_name);
        EXECUTE sql USING p_keeper_id, p_duplicate_id;
      EXCEPTION WHEN unique_violation THEN
        sql := format('DELETE FROM %I.%I WHERE %I = $1',
          r.table_schema, r.table_name, r.column_name);
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

  -- Phase 5b: soft-delete the loser (was: DELETE FROM crm_records) so a
  -- mis-merge is restorable. Children were already re-parented to the keeper
  -- above, so the loser has no children; the row is hidden by the deleted_at
  -- read filters.
  UPDATE crm_records
     SET deleted_at     = now(),
         deleted_by     = p_user_id,
         deleted_origin = 'merge'
   WHERE id = p_duplicate_id;

  BEGIN
    INSERT INTO crm_audit_log (organization_id, actor_id, entity, entity_id, action, diff)
    VALUES (
      v_keeper.organization_id, p_user_id, 'record', p_keeper_id, 'merge',
      jsonb_build_object(
        'kept_id',           p_keeper_id,
        'deleted_id',        p_duplicate_id,
        'deleted_snapshot',  to_jsonb(v_duplicate),
        'moved_notes',       v_moved_notes,
        'moved_tasks',       v_moved_tasks,
        'moved_attachments', v_moved_attach,
        'moved_links',       v_moved_links,
        'merged_at',         now()
      )
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING 'merge_crm_records: audit insert failed: %', SQLERRM;
  END;

  RETURN jsonb_build_object('success', true,
    'kept_id', p_keeper_id, 'deleted_id', p_duplicate_id,
    'moved_notes', v_moved_notes, 'moved_tasks', v_moved_tasks,
    'moved_attachments', v_moved_attach, 'moved_links', v_moved_links);

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$_$;
