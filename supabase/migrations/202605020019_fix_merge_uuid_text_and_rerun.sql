-- =============================================================================
-- (1) Fix merge_crm_records: legacy public.notes update was casting uuid → text,
--     producing "operator does not exist: uuid = text" because notes.record_id
--     is uuid in this DB.
--
-- (2) Bulk-merge remaining within-module duplicate clusters in PIFH.
--     Implementation copied from ..0014 (the prior phone+name sweep) which is
--     ~50× faster than calling merge_crm_records 466 times: pre-computes the FK
--     re-parent SQL templates once instead of re-querying information_schema
--     inside every merge. ..0014's body merged 48 records in seconds; this
--     migration applies the same pattern over the ~466 records the audit view
--     surfaces.
--
-- Tier-1 (auto-merge) requires:
--   • email rule:       any cross/same-module duplicates with shared email
--   • phone+name rule:  min_name_similarity >= 0.5 AND suffix-coherent
--                       (no Jr/Sr/II/III/IV mismatch within the cluster)
--
-- Idempotent: the audit view re-evaluates from current crm_records, so a
-- re-run becomes a no-op if everything was already merged.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) Patch merge_crm_records — drop the spurious ::text cast
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

  DELETE FROM crm_records WHERE id = p_duplicate_id;

  BEGIN
    INSERT INTO crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
    VALUES (
      v_keeper.org_id, p_user_id, 'record', p_keeper_id, 'merge',
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
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) Fast inline merge — same logic as ..0014, applied across the audit view
-- ─────────────────────────────────────────────────────────────────────────────
SET LOCAL statement_timeout = 0;

DO $outer$
DECLARE
  v_actor   CONSTANT uuid := 'c74f79a4-7f73-4977-90de-62ddd8c89250';
  v_org     CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  cluster   record;
  dup_id    uuid;
  v_keeper  crm_records%ROWTYPE;
  v_dup     crm_records%ROWTYPE;
  v_final_data jsonb;
  v_total_clusters     int := 0;
  v_processed          int := 0;
  v_merged             int := 0;
  v_skipped_suffix     int := 0;
  v_skipped_stale      int := 0;
  v_errors             int := 0;
  fk_updates           text[];
  fk_deletes           text[];
  i                    int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION '[merge-fast] actor % not on PIFH org', v_actor;
  END IF;

  -- Pre-compute FK templates ONCE (this is the speedup vs calling
  -- merge_crm_records, which re-runs this query inside every call).
  WITH fks AS (
    SELECT
      format('UPDATE %I.%I SET %I = $1 WHERE %I = $2',
             tc.table_schema, tc.table_name, kcu.column_name, kcu.column_name) AS upd_sql,
      format('DELETE FROM %I.%I WHERE %I = $1',
             tc.table_schema, tc.table_name, kcu.column_name) AS del_sql
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name   = 'crm_records'
      AND ccu.column_name  = 'id'
      AND tc.table_name NOT IN ('crm_notes','crm_tasks','crm_attachments','crm_record_links')
  )
  SELECT array_agg(upd_sql), array_agg(del_sql) INTO fk_updates, fk_deletes FROM fks;

  -- Snapshot the cluster list (audit view aggregates over crm_records, which
  -- we're about to mutate — temp table guarantees a stable iterator).
  CREATE TEMP TABLE _merge_clusters_fast ON COMMIT DROP AS
  SELECT
    keeper_id_oldest,
    duplicate_ids,
    rule,
    titles,
    coalesce(min_name_similarity, 0) AS min_sim,
    member_count,
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

  SELECT count(*) INTO v_total_clusters FROM _merge_clusters_fast;
  RAISE NOTICE '[merge-fast] starting. clusters=%', v_total_clusters;

  FOR cluster IN
    SELECT * FROM _merge_clusters_fast ORDER BY process_order
  LOOP
    v_processed := v_processed + 1;

    -- Suffix-coherence guard (Jr/Sr/II/III/IV mismatch → skip, likely father+son).
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

    -- Lock keeper. If gone (merged in earlier cluster), skip.
    SELECT * INTO v_keeper FROM public.crm_records WHERE id = cluster.keeper_id_oldest FOR UPDATE;
    IF NOT FOUND THEN
      v_skipped_stale := v_skipped_stale + 1;
      CONTINUE;
    END IF;

    FOREACH dup_id IN ARRAY cluster.duplicate_ids LOOP
      BEGIN
        SELECT * INTO v_dup FROM public.crm_records WHERE id = dup_id FOR UPDATE;
        IF NOT FOUND THEN
          v_skipped_stale := v_skipped_stale + 1;
          CONTINUE;
        END IF;

        IF v_dup.org_id <> v_keeper.org_id THEN
          v_errors := v_errors + 1;
          CONTINUE;
        END IF;

        -- Same-module guard. The 1 email cross-module cluster (Susan King)
        -- gets skipped here — handle that one via the UI.
        IF v_dup.module_id <> v_keeper.module_id THEN
          v_skipped_stale := v_skipped_stale + 1;
          CONTINUE;
        END IF;

        -- Key-wise data merge: keeper wins, keeper blanks fill from dup.
        SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO v_final_data
        FROM (
          SELECT k,
            CASE
              WHEN (v_keeper.data -> k) IS NULL
                OR v_keeper.data ->> k IS NULL
                OR v_keeper.data ->> k = ''
              THEN v_dup.data -> k
              ELSE v_keeper.data -> k
            END AS v
          FROM (
            SELECT DISTINCT k FROM (
              SELECT jsonb_object_keys(COALESCE(v_keeper.data, '{}'::jsonb)) AS k
              UNION
              SELECT jsonb_object_keys(COALESCE(v_dup.data, '{}'::jsonb)) AS k
            ) keys
          ) all_keys
        ) merged
        WHERE v IS NOT NULL;

        UPDATE public.crm_notes       SET record_id = v_keeper.id WHERE record_id = v_dup.id;
        UPDATE public.crm_tasks       SET record_id = v_keeper.id WHERE record_id = v_dup.id;
        BEGIN
          UPDATE public.crm_attachments SET record_id = v_keeper.id WHERE record_id = v_dup.id;
        EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
        END;
        BEGIN
          UPDATE public.notes SET record_id = v_keeper.id WHERE record_id = v_dup.id;
        EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
        END;

        DELETE FROM public.crm_record_links
         WHERE source_record_id = v_dup.id AND target_record_id = v_keeper.id;
        DELETE FROM public.crm_record_links
         WHERE target_record_id = v_dup.id AND source_record_id = v_keeper.id;
        DELETE FROM public.crm_record_links
         WHERE source_record_id = v_dup.id
           AND EXISTS (SELECT 1 FROM public.crm_record_links kl
                        WHERE kl.source_record_id = v_keeper.id
                          AND kl.target_record_id = crm_record_links.target_record_id
                          AND kl.link_type        = crm_record_links.link_type);
        UPDATE public.crm_record_links SET source_record_id = v_keeper.id WHERE source_record_id = v_dup.id;
        DELETE FROM public.crm_record_links
         WHERE target_record_id = v_dup.id
           AND EXISTS (SELECT 1 FROM public.crm_record_links kl
                        WHERE kl.target_record_id = v_keeper.id
                          AND kl.source_record_id = crm_record_links.source_record_id
                          AND kl.link_type        = crm_record_links.link_type);
        UPDATE public.crm_record_links SET target_record_id = v_keeper.id WHERE target_record_id = v_dup.id;
        DELETE FROM public.crm_record_links WHERE source_record_id = target_record_id;

        IF fk_updates IS NOT NULL THEN
          FOR i IN 1..array_length(fk_updates, 1) LOOP
            BEGIN
              EXECUTE fk_updates[i] USING v_keeper.id, v_dup.id;
            EXCEPTION WHEN unique_violation THEN
              EXECUTE fk_deletes[i] USING v_dup.id;
            WHEN OTHERS THEN NULL;
            END;
          END LOOP;
        END IF;

        UPDATE public.crm_records SET
          data       = v_final_data,
          title      = COALESCE(NULLIF(v_keeper.title, ''), NULLIF(v_dup.title, '')),
          email      = COALESCE(NULLIF(v_keeper.email, ''), NULLIF(v_dup.email, '')),
          phone      = COALESCE(NULLIF(v_keeper.phone, ''), NULLIF(v_dup.phone, '')),
          status     = CASE
            WHEN v_keeper.status = 'Active' THEN v_keeper.status
            WHEN v_dup.status    = 'Active' THEN v_dup.status
            ELSE COALESCE(NULLIF(v_keeper.status, ''), NULLIF(v_dup.status, ''))
          END,
          owner_id   = COALESCE(v_keeper.owner_id, v_dup.owner_id),
          updated_at = now()
        WHERE id = v_keeper.id;

        DELETE FROM public.crm_records WHERE id = v_dup.id;

        BEGIN
          INSERT INTO public.crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
          VALUES (v_keeper.org_id, v_actor, 'record', v_keeper.id, 'merge',
            jsonb_build_object(
              'kept_id',    v_keeper.id,
              'deleted_id', v_dup.id,
              'reason',     format('within-module bulk dedupe (%s)', cluster.rule),
              'merged_at',  now()
            ));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        v_merged := v_merged + 1;

        -- Refresh the in-memory keeper row since we just updated it; subsequent
        -- iterations within the same cluster need the latest data/title/etc.
        SELECT * INTO v_keeper FROM public.crm_records WHERE id = v_keeper.id;

      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE '[merge-fast] keeper=% dup=% raised %: %',
          v_keeper.id, dup_id, SQLSTATE, SQLERRM;
      END;

      IF v_merged % 50 = 0 AND v_merged > 0 THEN
        RAISE NOTICE '[merge-fast] progress: % merges (cluster %/%)',
          v_merged, v_processed, v_total_clusters;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[merge-fast] DONE. clusters=% merged=% skipped_suffix=% skipped_stale=% errors=%',
    v_total_clusters, v_merged, v_skipped_suffix, v_skipped_stale, v_errors;
END $outer$;
