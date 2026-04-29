-- =============================================================================
-- Fix: merge_crm_records was failing every call with
--   "operator does not exist: uuid = text"
-- because the legacy `public.notes` re-parent step casts the keeper/dup ids
-- to `text` (assuming an older schema) but `notes.record_id` is now `uuid`.
-- Confirmed via information_schema on 2026-04-29:
--   public.notes.record_id  = uuid
-- The narrow EXCEPTION handler in that block only caught
-- undefined_table / undefined_column, so the operator-does-not-exist error
-- bubbled to the outer handler and the function returned
--   { success: false, error: "operator does not exist: uuid = text" }
-- with PL/pgSQL implicitly rolling back the entire function body.
-- Net effect: ..0018 attempted 466 merges, every one rolled back, ZERO data
-- changes. Safe to re-run after the fix.
--
-- This migration:
--   1. CREATE OR REPLACE merge_crm_records — removes the spurious ::text
--      cast on the legacy notes update; everything else is identical to
--      the live function definition (verified via pg_get_functiondef).
--   2. Re-runs the same cluster-merge loop from ..0018. Idempotent: only
--      clusters still present in crm_duplicate_audit get processed.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) Patch merge_crm_records — drop the ::text cast on legacy notes update
-- ─────────────────────────────────────────────────────────────────────────────
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

  SELECT * INTO v_keeper    FROM crm_records WHERE id = p_keeper_id    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Keeper record not found');
  END IF;

  SELECT * INTO v_duplicate FROM crm_records WHERE id = p_duplicate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate record not found');
  END IF;

  SELECT organization_id INTO v_user_org FROM profiles WHERE id = p_user_id;
  IF v_user_org IS NULL OR v_user_org <> v_keeper.org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this organization');
  END IF;

  IF v_keeper.org_id    <> v_duplicate.org_id    THEN
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

  -- ── FIX: legacy notes table — record_id is uuid in this DB, not text.
  -- Drop the ::text cast that was producing "operator does not exist:
  -- uuid = text" on every merge. Keep narrow exception so a missing
  -- table/column is still tolerated.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) Re-run the cluster-merge loop now that the RPC works.
-- Body identical to ..0018 — see that migration's header for reasoning.
-- ─────────────────────────────────────────────────────────────────────────────
SET LOCAL statement_timeout = 0;

DO $outer$
DECLARE
  v_actor   CONSTANT uuid := 'c74f79a4-7f73-4977-90de-62ddd8c89250';
  v_org     CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  cluster   record;
  dup_id    uuid;
  v_total_clusters     int := 0;
  v_processed          int := 0;
  v_merges             int := 0;
  v_skipped_suffix     int := 0;
  v_skipped_stale      int := 0;
  v_skipped_xmodule    int := 0;
  v_errors             int := 0;
  v_merge_result       jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_actor AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION '[merge] actor profile.id % is not on PIFH org %', v_actor, v_org;
  END IF;

  CREATE TEMP TABLE _merge_clusters_v2 ON COMMIT DROP AS
  SELECT
    keeper_id_oldest,
    duplicate_ids,
    rule,
    titles,
    module_ids,
    member_count,
    coalesce(min_name_similarity, 0) AS min_name_similarity,
    row_number() OVER (
      ORDER BY
        CASE WHEN rule = 'email' THEN 0 ELSE 1 END,
        member_count DESC,
        keeper_id_oldest
    ) AS process_order
  FROM public.crm_duplicate_audit
  WHERE org_id = v_org
    AND (
      rule = 'email'
      OR (rule = 'phone+name' AND coalesce(min_name_similarity, 0) >= 0.5)
    );

  SELECT count(*) INTO v_total_clusters FROM _merge_clusters_v2;
  RAISE NOTICE '[merge-rerun] starting. clusters_to_process=%', v_total_clusters;

  FOR cluster IN
    SELECT * FROM _merge_clusters_v2 ORDER BY process_order
  LOOP
    v_processed := v_processed + 1;

    IF (SELECT count(DISTINCT m) FROM unnest(cluster.module_ids) m) > 1 THEN
      v_skipped_xmodule := v_skipped_xmodule + 1;
      CONTINUE;
    END IF;

    IF cluster.rule = 'phone+name' AND (
      SELECT count(DISTINCT coalesce(
        lower((regexp_match(btrim(t), '(?i)(?:^|[\s,])(jr\.?|sr\.?|ii|iii|iv)\s*$'))[1]),
        ''
      ))
      FROM unnest(cluster.titles) t
    ) > 1 THEN
      v_skipped_suffix := v_skipped_suffix + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.crm_records WHERE id = cluster.keeper_id_oldest) THEN
      v_skipped_stale := v_skipped_stale + 1;
      CONTINUE;
    END IF;

    FOREACH dup_id IN ARRAY cluster.duplicate_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.crm_records WHERE id = dup_id) THEN
        v_skipped_stale := v_skipped_stale + 1;
        CONTINUE;
      END IF;

      BEGIN
        SELECT public.merge_crm_records(
          p_keeper_id    => cluster.keeper_id_oldest,
          p_duplicate_id => dup_id,
          p_user_id      => v_actor
        ) INTO v_merge_result;

        IF (v_merge_result->>'success')::boolean IS TRUE THEN
          v_merges := v_merges + 1;
        ELSE
          v_errors := v_errors + 1;
          RAISE NOTICE '[merge-rerun] keeper=% dup=% returned %',
            cluster.keeper_id_oldest, dup_id, v_merge_result;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE '[merge-rerun] keeper=% dup=% raised %: %',
          cluster.keeper_id_oldest, dup_id, SQLSTATE, SQLERRM;
      END;

      IF v_merges % 50 = 0 AND v_merges > 0 THEN
        RAISE NOTICE '[merge-rerun] progress: % merges (cluster %/%)',
          v_merges, v_processed, v_total_clusters;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[merge-rerun] DONE. clusters=% merges=% skipped_xmodule=% skipped_suffix=% skipped_stale=% errors=%',
    v_total_clusters, v_merges, v_skipped_xmodule, v_skipped_suffix, v_skipped_stale, v_errors;
END $outer$;
