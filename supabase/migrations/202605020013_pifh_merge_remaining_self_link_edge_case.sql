-- =============================================================================
-- Catch the 1 cross-module duplicate that 202605020012 couldn't merge.
--
-- Background: the previous migration merged 959 of 960 PIFH cross-module
-- duplicates. The single remaining cluster (Shelby Cooper, contacts +
-- leads) tripped `crm_record_links_check` because a record_links row
-- existed with source = leads-dup-id and target = contacts-keeper-id (or
-- vice-versa). When the merge re-pointed source_record_id from the dup to
-- the keeper, the link became source = target = keeper, which the check
-- constraint correctly rejects.
--
-- Fix: before re-pointing record_links, also delete any link where the
-- *opposite* endpoint already equals the keeper — that link would become a
-- self-reference after re-pointing. Then merge as before.
-- =============================================================================

DO $$
DECLARE
  v_keeper_id CONSTANT uuid := 'da29851b-2c2a-4f0c-8d18-5cd8e03326fd'; -- Shelby Cooper, contacts
  v_dup_id    CONSTANT uuid := '8634a642-ea8a-4dc3-89a2-357024796c9a'; -- Shelby Cooper, leads
  v_actor     CONSTANT uuid := 'c74f79a4-7f73-4977-90de-62ddd8c89250';
  v_keeper    crm_records%ROWTYPE;
  v_dup       crm_records%ROWTYPE;
  v_final_data jsonb;
BEGIN
  SELECT * INTO v_keeper FROM public.crm_records WHERE id = v_keeper_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE NOTICE '[merge-shelby] keeper % not found, skipping', v_keeper_id;
    RETURN;
  END IF;
  SELECT * INTO v_dup FROM public.crm_records WHERE id = v_dup_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE NOTICE '[merge-shelby] dup % already gone, skipping', v_dup_id;
    RETURN;
  END IF;

  -- JSONB union (keeper wins, dup fills blanks)
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
        SELECT jsonb_object_keys(COALESCE(v_dup.data,    '{}'::jsonb)) AS k
      ) keys
    ) all_keys
  ) merged
  WHERE v IS NOT NULL;

  UPDATE public.crm_notes  SET record_id = v_keeper_id WHERE record_id = v_dup_id;
  UPDATE public.crm_tasks  SET record_id = v_keeper_id WHERE record_id = v_dup_id;
  BEGIN
    UPDATE public.crm_attachments SET record_id = v_keeper_id WHERE record_id = v_dup_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- crm_record_links: extra self-reference guard. Drop any link that would
  -- become source = target after the re-point.
  DELETE FROM public.crm_record_links
   WHERE source_record_id = v_dup_id AND target_record_id = v_keeper_id;
  DELETE FROM public.crm_record_links
   WHERE target_record_id = v_dup_id AND source_record_id = v_keeper_id;

  -- Standard dedupe before repoint
  DELETE FROM public.crm_record_links
   WHERE source_record_id = v_dup_id
     AND EXISTS (
       SELECT 1 FROM public.crm_record_links kl
        WHERE kl.source_record_id = v_keeper_id
          AND kl.target_record_id = crm_record_links.target_record_id
          AND kl.link_type        = crm_record_links.link_type
     );
  UPDATE public.crm_record_links SET source_record_id = v_keeper_id WHERE source_record_id = v_dup_id;

  DELETE FROM public.crm_record_links
   WHERE target_record_id = v_dup_id
     AND EXISTS (
       SELECT 1 FROM public.crm_record_links kl
        WHERE kl.target_record_id = v_keeper_id
          AND kl.source_record_id = crm_record_links.source_record_id
          AND kl.link_type        = crm_record_links.link_type
     );
  UPDATE public.crm_record_links SET target_record_id = v_keeper_id WHERE target_record_id = v_dup_id;

  -- Walk every other FK to crm_records(id) and re-point.
  DECLARE
    fk record;
  BEGIN
    FOR fk IN
      SELECT tc.table_schema, tc.table_name, kcu.column_name
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
         AND tc.table_name NOT IN ('crm_notes','crm_tasks','crm_attachments','crm_record_links')
    LOOP
      BEGIN
        EXECUTE format(
          'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
          fk.table_schema, fk.table_name, fk.column_name, fk.column_name
        ) USING v_keeper_id, v_dup_id;
      EXCEPTION WHEN unique_violation THEN
        EXECUTE format('DELETE FROM %I.%I WHERE %I = $1',
                       fk.table_schema, fk.table_name, fk.column_name)
        USING v_dup_id;
      WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END;

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
  WHERE id = v_keeper_id;

  DELETE FROM public.crm_records WHERE id = v_dup_id;

  INSERT INTO public.crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
  VALUES (
    v_keeper.org_id, v_actor, 'record', v_keeper_id, 'merge',
    jsonb_build_object(
      'kept_id', v_keeper_id,
      'deleted_id', v_dup_id,
      'reason', 'cross-module duplicate cleanup (self-link edge case)',
      'merged_at', now()
    )
  );

  RAISE NOTICE '[merge-shelby] merged dup % into keeper %', v_dup_id, v_keeper_id;
END $$;
