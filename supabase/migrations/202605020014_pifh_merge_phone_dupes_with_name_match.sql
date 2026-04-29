-- =============================================================================
-- Conservative phone-only cross-module merge.
--
-- Email-based dedup (202605020012/13) caught 960 duplicates. There are still
-- 48 cross-module clusters that share a digit-normalized phone but no email
-- match. Auto-merging on phone alone is unsafe — sample showed legitimate
-- false positives like:
--   • "Erika Sugihara" (lead)  + "Court Tuck" (member)   — shared workplace #
--   • "Gordon Matthews" (contact) + "Gordon Matthews" (member) — same person
--
-- Heuristic: merge a phone-cluster only when the candidate records' titles
-- are trigram-similar above 0.5. That cleanly cuts the same-name dupes
-- from the shared-phone-different-name cases.
--
-- For each qualifying cluster: keeper = contacts row (or oldest), dups =
-- the rest. Reuse the same merge body as 202605020012, just with a phone
-- cluster source.
-- =============================================================================

SET LOCAL statement_timeout = 0;

DO $outer$
DECLARE
  v_org_id  CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  v_actor   CONSTANT uuid := 'c74f79a4-7f73-4977-90de-62ddd8c89250';
  cluster   record;
  dup_id    uuid;
  v_keeper  crm_records%ROWTYPE;
  v_dup     crm_records%ROWTYPE;
  v_final_data   jsonb;
  v_clusters int := 0;
  v_processed int := 0;
  v_merged    int := 0;
  v_skipped_name_mismatch int := 0;
  v_errors    int := 0;
  fk_updates  text[];
  fk_deletes  text[];
  i           int;
BEGIN
  -- Pre-compute FK templates once (same trick as 202605020012).
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
      AND ccu.table_schema = 'public' AND ccu.table_name = 'crm_records' AND ccu.column_name = 'id'
      AND tc.table_name NOT IN ('crm_notes','crm_tasks','crm_attachments','crm_record_links')
  )
  SELECT array_agg(upd_sql), array_agg(del_sql) INTO fk_updates, fk_deletes FROM fks;

  -- Per-phone-cluster loop. Pick keeper = contacts row first, oldest second.
  FOR cluster IN
    WITH
    contacts_module AS (
      SELECT id AS module_id FROM public.crm_modules
       WHERE org_id = v_org_id AND key = 'contacts' LIMIT 1
    ),
    grouped AS (
      SELECT
        regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') AS digits,
        array_agg(r.id ORDER BY
          (CASE WHEN r.module_id = (SELECT module_id FROM contacts_module) THEN 0 ELSE 1 END),
          r.created_at ASC,
          r.id ASC
        ) AS ids
      FROM public.crm_records r
      WHERE r.org_id = v_org_id
        AND length(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g')) >= 10
        -- Skip records that already had their email merged to keep this
        -- migration narrowly scoped to PHONE-only matches.
        AND (r.email IS NULL OR btrim(r.email) = '' OR
             NOT EXISTS (
               SELECT 1 FROM public.crm_records r2
                WHERE r2.id <> r.id
                  AND r2.org_id = r.org_id
                  AND r2.module_id <> r.module_id
                  AND lower(btrim(r2.email)) = lower(btrim(r.email))
             ))
      GROUP BY regexp_replace(coalesce(r.phone, ''), '\D', '', 'g')
      HAVING count(DISTINCT r.module_id) > 1
    )
    SELECT digits, ids[1] AS keeper_id, ids[2:] AS dup_ids FROM grouped
  LOOP
    v_clusters := v_clusters + 1;
    SELECT * INTO v_keeper FROM public.crm_records WHERE id = cluster.keeper_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    FOREACH dup_id IN ARRAY cluster.dup_ids LOOP
      v_processed := v_processed + 1;

      BEGIN
        SELECT * INTO v_dup FROM public.crm_records WHERE id = dup_id FOR UPDATE;
        IF NOT FOUND THEN CONTINUE; END IF;
        IF v_dup.org_id <> v_keeper.org_id THEN
          v_errors := v_errors + 1;
          CONTINUE;
        END IF;

        -- Conservative guard: only merge if the names are clearly the same
        -- person. Trigram similarity > 0.5 catches "Gordon Matthews" vs
        -- "Gordon Matthews" (1.0) but rejects "Erika Sugihara" vs
        -- "Court Tuck" (~0.1).
        IF similarity(coalesce(v_keeper.title, ''), coalesce(v_dup.title, '')) < 0.5 THEN
          v_skipped_name_mismatch := v_skipped_name_mismatch + 1;
          RAISE NOTICE '[merge-phone] skipped (name mismatch): keeper=% (%) vs dup=% (%)',
            v_keeper.title, v_keeper.id, v_dup.title, v_dup.id;
          CONTINUE;
        END IF;

        -- ── Same merge body as 202605020012 ──
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

        UPDATE public.crm_notes SET record_id = v_keeper.id WHERE record_id = v_dup.id;
        UPDATE public.crm_tasks SET record_id = v_keeper.id WHERE record_id = v_dup.id;
        BEGIN
          UPDATE public.crm_attachments SET record_id = v_keeper.id WHERE record_id = v_dup.id;
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
                          AND kl.link_type = crm_record_links.link_type);
        UPDATE public.crm_record_links SET source_record_id = v_keeper.id WHERE source_record_id = v_dup.id;
        DELETE FROM public.crm_record_links
         WHERE target_record_id = v_dup.id
           AND EXISTS (SELECT 1 FROM public.crm_record_links kl
                        WHERE kl.target_record_id = v_keeper.id
                          AND kl.source_record_id = crm_record_links.source_record_id
                          AND kl.link_type = crm_record_links.link_type);
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
              'kept_id', v_keeper.id,
              'deleted_id', v_dup.id,
              'reason', 'cross-module phone+name dupe cleanup',
              'merged_at', now()
            ));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        v_merged := v_merged + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE '[merge-phone] keeper=% dup=% raised %: %',
          v_keeper.id, dup_id, SQLSTATE, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[merge-phone] done. clusters=% processed=% merged=% skipped_name_mismatch=% errors=%',
    v_clusters, v_processed, v_merged, v_skipped_name_mismatch, v_errors;
END $outer$;
