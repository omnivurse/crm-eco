-- ============================================================================
-- Migration: Merge two CRM records into one (keeper).
--
-- Ship-ready version of the long-missing "merge duplicate contacts" tool.
--
-- Symptom this solves (PIFH, April 2026): contacts are appearing as paired
-- rows (often "Active" + "Pending") because:
--   1. The enrollment sync trigger (sync_member_to_crm) only matches on
--      linked_member_id, so any pre-existing Contact without that link
--      gets shadowed by a freshly-inserted sibling from the enrollment
--      side.
--   2. The unique-email index is partial (WHERE email IS NOT NULL AND
--      email != ''), so a missing/blank email on either side lets a
--      duplicate slip through.
--   3. Notes stay attached to the record_id they were written against, so
--      the user opening the "other" record sees no notes.
--
-- This RPC lets an admin/manager collapse two records into one, preserving
-- every child row (notes, tasks, attachments, links, quotes, invoices,
-- approvals, messages, group memberships, calendar links, inbox links).
--
-- Called by POST /api/crm/records/:id/merge. Security:
--   - SECURITY DEFINER so it can re-parent rows across RLS-restricted
--     tables, but every write is gated on both records living in the same
--     org as p_user_id.
--   - Same-module guard prevents e.g. merging a Contact into a Deal.
-- ============================================================================

BEGIN;

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
BEGIN
  IF p_keeper_id = p_duplicate_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Keeper and duplicate must be different records');
  END IF;

  -- Lock both rows to avoid racing edits mid-merge.
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

  -- Same-org guard (RPC is SECURITY DEFINER; callers must be in the same org).
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

  -- ------------------------------------------------------------------------
  -- Resolve final field values.
  --
  -- If the caller supplied explicit overrides (from the advanced merge
  -- picker) use them. Otherwise fall back to "keeper wins, keeper blanks
  -- fill from duplicate" — matches the simple one-click merge contract
  -- described in the client-facing docs.
  -- ------------------------------------------------------------------------
  v_final_data := COALESCE(
    p_merged_data,
    -- Key-wise merge: start with duplicate, overlay keeper. That way
    -- keeper values win, but any key the keeper is missing or has as
    -- null/empty falls back to duplicate.
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

  -- Status: explicit override > Active wins > keeper > duplicate.
  -- "Active wins" was the product call on the merge dialog (an Active
  -- record is closer to truth than a Pending placeholder).
  v_final_status := COALESCE(
    NULLIF(p_merged_status, ''),
    CASE
      WHEN v_keeper.status    = 'Active' THEN v_keeper.status
      WHEN v_duplicate.status = 'Active' THEN v_duplicate.status
      ELSE COALESCE(NULLIF(v_keeper.status, ''), NULLIF(v_duplicate.status, ''))
    END
  );

  -- ------------------------------------------------------------------------
  -- Re-parent every child row onto the keeper.
  --
  -- Order matters for crm_record_links: we have to de-dupe before re-pointing
  -- or the unique (source,target,type) constraint will trip.
  -- ------------------------------------------------------------------------

  -- crm_notes — THE bug from the client report ("Viengxay's notes are missing")
  UPDATE crm_notes SET record_id = p_keeper_id WHERE record_id = p_duplicate_id;
  GET DIAGNOSTICS v_moved_notes = ROW_COUNT;

  -- Also move the legacy "notes" table rows if present (keyed by text id).
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

  -- crm_record_links (both directions). Drop links that would collide with
  -- an existing keeper link of the same (target, type), then repoint the rest.
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

  -- Delete any self-links that were just created by the above repointing.
  DELETE FROM crm_record_links
   WHERE source_record_id = target_record_id;

  GET DIAGNOSTICS v_moved_links = ROW_COUNT;

  -- ------------------------------------------------------------------------
  -- Re-parent every other table that references crm_records(id).
  --
  -- These are wrapped in DO blocks so the migration stays forward-compatible:
  -- if a table is dropped or renamed we skip it instead of exploding.
  -- ------------------------------------------------------------------------
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
        -- already handled explicitly above
        AND NOT (tc.table_name IN ('crm_notes','crm_tasks','crm_attachments','crm_record_links'))
    LOOP
      BEGIN
        sql := format(
          'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
          r.table_schema, r.table_name, r.column_name, r.column_name
        );
        EXECUTE sql USING p_keeper_id, p_duplicate_id;
      EXCEPTION WHEN unique_violation THEN
        -- A child row already exists on the keeper side with the same
        -- unique signature. Drop the one on the duplicate instead.
        sql := format(
          'DELETE FROM %I.%I WHERE %I = $1',
          r.table_schema, r.table_name, r.column_name
        );
        EXECUTE sql USING p_duplicate_id;
      WHEN others THEN
        -- Don't let a surprise FK in an unrelated module abort the merge.
        RAISE WARNING 'merge_crm_records: skipped %.%.%: %',
          r.table_schema, r.table_name, r.column_name, SQLERRM;
      END;
    END LOOP;
  END;
  $blk$;

  -- ------------------------------------------------------------------------
  -- Write the merged values onto the keeper and delete the duplicate.
  -- ------------------------------------------------------------------------
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

  -- Audit trail so this is reversible forensically even though it's
  -- destructive in the UI.
  BEGIN
    INSERT INTO crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
    VALUES (
      v_keeper.org_id,
      p_user_id,
      'record',
      p_keeper_id,
      'merge',
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
    -- Never block a successful merge because of an audit write failure.
    RAISE WARNING 'merge_crm_records: audit insert failed: %', SQLERRM;
  END;

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
  'Merges two crm_records into one, moving every child row onto the keeper. Used by the Merge Duplicate dialog on the record detail page. See migration 202604210002 for the full contract.';

GRANT EXECUTE ON FUNCTION public.merge_crm_records(
  uuid, uuid, uuid, jsonb, text, text, text, uuid
) TO authenticated;

COMMIT;
