-- =============================================================================
-- Cross-module duplicate merge (PIFH) — inline implementation, batched.
--
-- See header notes in the original draft for the *why*. This revision:
--   1. Pre-computes the FK list ONCE outside the per-cluster loop (the
--      previous version re-walked information_schema 960 times and tripped
--      Supabase's 2-minute statement timeout).
--   2. Disables statement timeout for the migration session so the merge
--      loop can run to completion against the full 942-cluster set.
--   3. Builds the merge SQL templates as text once, then `EXECUTE`s them
--      per duplicate. Same shape as the existing `merge_crm_records` RPC
--      but module-agnostic (we *want* a cross-module merge — contacts
--      keeper, members duplicate).
-- =============================================================================

SET LOCAL statement_timeout = 0;

DO $outer$
DECLARE
  v_org_id  CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  v_actor   CONSTANT uuid := 'c74f79a4-7f73-4977-90de-62ddd8c89250'; -- omnivurse profile.id
  cluster   record;
  dup_id    uuid;
  v_keeper  crm_records%ROWTYPE;
  v_dup     crm_records%ROWTYPE;
  v_final_data   jsonb;
  v_final_title  text;
  v_final_email  text;
  v_final_phone  text;
  v_final_status text;
  v_final_owner  uuid;
  v_clusters int := 0;
  v_processed int := 0;
  v_merged    int := 0;
  v_errors    int := 0;
  fk_tables   text[];   -- "schema.table" pairs (for logging)
  fk_updates  text[];   -- pre-built UPDATE SQL templates
  fk_deletes  text[];   -- matching DELETE SQL for unique_violation fallback
  i           int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION '[merge-cross] actor profile.id % is not on org %', v_actor, v_org_id;
  END IF;

  -- ── Pre-compute FK metadata ONCE ──
  -- Walk information_schema for every FK referencing crm_records(id) and
  -- build a parallel pair of UPDATE / DELETE SQL templates. Doing this once
  -- (vs per-cluster) is a 960× win and keeps the migration well inside any
  -- statement_timeout.
  WITH fks AS (
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      format('UPDATE %I.%I SET %I = $1 WHERE %I = $2',
             tc.table_schema, tc.table_name, kcu.column_name, kcu.column_name
      ) AS upd_sql,
      format('DELETE FROM %I.%I WHERE %I = $1',
             tc.table_schema, tc.table_name, kcu.column_name
      ) AS del_sql
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
      -- Handled with custom dedupe logic below.
      AND tc.table_name NOT IN (
        'crm_notes','crm_tasks','crm_attachments','crm_record_links'
      )
  )
  SELECT
    array_agg(table_schema || '.' || table_name),
    array_agg(upd_sql),
    array_agg(del_sql)
   INTO fk_tables, fk_updates, fk_deletes
  FROM fks;

  RAISE NOTICE '[merge-cross] discovered % child FK tables', coalesce(array_length(fk_tables, 1), 0);

  -- ── Per-cluster merge loop ──
  FOR cluster IN
    WITH
    contacts_module AS (
      SELECT id AS module_id FROM public.crm_modules
       WHERE org_id = v_org_id AND key = 'contacts'
       LIMIT 1
    ),
    grouped AS (
      SELECT
        lower(btrim(r.email)) AS norm_email,
        array_agg(r.id ORDER BY
          (CASE WHEN r.module_id = (SELECT module_id FROM contacts_module) THEN 0 ELSE 1 END),
          r.created_at ASC,
          r.id ASC
        ) AS ids
      FROM public.crm_records r
      WHERE r.org_id = v_org_id
        AND r.email IS NOT NULL
        AND btrim(r.email) <> ''
      GROUP BY lower(btrim(r.email))
      HAVING count(DISTINCT r.module_id) > 1
    )
    SELECT
      norm_email,
      ids[1] AS keeper_id,
      ids[2:] AS dup_ids
      FROM grouped
  LOOP
    v_clusters := v_clusters + 1;

    SELECT * INTO v_keeper FROM public.crm_records WHERE id = cluster.keeper_id FOR UPDATE;
    IF NOT FOUND OR v_keeper.module_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Refuse to merge if the keeper isn't actually in contacts.
    IF NOT EXISTS (
      SELECT 1 FROM public.crm_modules
       WHERE id = v_keeper.module_id AND key = 'contacts' AND org_id = v_org_id
    ) THEN
      CONTINUE;
    END IF;

    FOREACH dup_id IN ARRAY cluster.dup_ids LOOP
      v_processed := v_processed + 1;

      BEGIN
        SELECT * INTO v_dup FROM public.crm_records WHERE id = dup_id FOR UPDATE;
        IF NOT FOUND THEN CONTINUE; END IF;
        IF v_dup.org_id <> v_keeper.org_id THEN
          v_errors := v_errors + 1;
          CONTINUE;
        END IF;

        -- Merge JSONB: keeper wins on conflict, dup fills blanks.
        SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO v_final_data
        FROM (
          SELECT
            k,
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
              SELECT jsonb_object_keys(COALESCE(v_dup.data,    '{}'::jsonb)) AS k
            ) keys
          ) all_keys
        ) merged
        WHERE v IS NOT NULL;

        v_final_title  := COALESCE(NULLIF(v_keeper.title,  ''), NULLIF(v_dup.title,  ''));
        v_final_email  := COALESCE(NULLIF(v_keeper.email,  ''), NULLIF(v_dup.email,  ''));
        v_final_phone  := COALESCE(NULLIF(v_keeper.phone,  ''), NULLIF(v_dup.phone,  ''));
        v_final_owner  := COALESCE(v_keeper.owner_id, v_dup.owner_id);
        v_final_status := CASE
          WHEN v_keeper.status = 'Active' THEN v_keeper.status
          WHEN v_dup.status    = 'Active' THEN v_dup.status
          ELSE COALESCE(NULLIF(v_keeper.status, ''), NULLIF(v_dup.status, ''))
        END;

        -- High-traffic child tables (explicit, not via FK loop):
        UPDATE public.crm_notes  SET record_id = v_keeper.id WHERE record_id = v_dup.id;
        UPDATE public.crm_tasks  SET record_id = v_keeper.id WHERE record_id = v_dup.id;
        BEGIN
          UPDATE public.crm_attachments SET record_id = v_keeper.id WHERE record_id = v_dup.id;
        EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
        END;

        -- crm_record_links: dedupe before repoint to avoid (source,target,type) unique tripping.
        DELETE FROM public.crm_record_links
         WHERE source_record_id = v_dup.id
           AND EXISTS (
             SELECT 1 FROM public.crm_record_links kl
              WHERE kl.source_record_id = v_keeper.id
                AND kl.target_record_id = crm_record_links.target_record_id
                AND kl.link_type        = crm_record_links.link_type
           );
        UPDATE public.crm_record_links SET source_record_id = v_keeper.id
         WHERE source_record_id = v_dup.id;

        DELETE FROM public.crm_record_links
         WHERE target_record_id = v_dup.id
           AND EXISTS (
             SELECT 1 FROM public.crm_record_links kl
              WHERE kl.target_record_id = v_keeper.id
                AND kl.source_record_id = crm_record_links.source_record_id
                AND kl.link_type        = crm_record_links.link_type
           );
        UPDATE public.crm_record_links SET target_record_id = v_keeper.id
         WHERE target_record_id = v_dup.id;

        DELETE FROM public.crm_record_links
         WHERE source_record_id = target_record_id;

        -- Re-point every other FK using the pre-built SQL templates.
        IF fk_updates IS NOT NULL THEN
          FOR i IN 1..array_length(fk_updates, 1) LOOP
            BEGIN
              EXECUTE fk_updates[i] USING v_keeper.id, v_dup.id;
            EXCEPTION WHEN unique_violation THEN
              EXECUTE fk_deletes[i] USING v_dup.id;
            WHEN OTHERS THEN
              NULL; -- forward-compat: ignore odd FKs we can't auto-handle
            END;
          END LOOP;
        END IF;

        UPDATE public.crm_records SET
          data       = v_final_data,
          title      = v_final_title,
          email      = v_final_email,
          phone      = v_final_phone,
          status     = v_final_status,
          owner_id   = v_final_owner,
          updated_at = now()
        WHERE id = v_keeper.id;

        DELETE FROM public.crm_records WHERE id = v_dup.id;

        BEGIN
          INSERT INTO public.crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
          VALUES (
            v_keeper.org_id, v_actor, 'record', v_keeper.id, 'merge',
            jsonb_build_object(
              'kept_id', v_keeper.id,
              'deleted_id', v_dup.id,
              'reason', 'cross-module duplicate cleanup',
              'deleted_module_id', v_dup.module_id,
              'deleted_snapshot', to_jsonb(v_dup),
              'merged_at', now()
            )
          );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        v_merged := v_merged + 1;
        IF v_merged % 100 = 0 THEN
          RAISE NOTICE '[merge-cross] progress: % merges complete', v_merged;
        END IF;

      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE '[merge-cross] keeper=% dup=% raised %: %',
          v_keeper.id, dup_id, SQLSTATE, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[merge-cross] done. clusters=% processed=% merged=% errors=%',
    v_clusters, v_processed, v_merged, v_errors;
END $outer$;
