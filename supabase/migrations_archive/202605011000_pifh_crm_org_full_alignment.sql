-- ============================================================================
-- Pay It Forward (PIFH) — full CRM org_id alignment
--
-- Canonical org: ac6e7228-2ea0-4582-8464-562c3e8ac56e
--
-- Re-applies the same safe repairs as 202604210004_pifh_visibility_audit.sql,
-- then aligns other crm_* rows whose org_id drifted (imports, links, audit,
-- standalone tasks) so list/search/RLS stay consistent with
-- profiles.organization_id for this single-tenant CRM.
--
-- Does NOT blindly re-home duplicate crm_modules rows (would violate
-- UNIQUE(org_id, key)); module remapping uses the PIFH module with the same
-- `key` when the record pointed at another org’s module.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_pifh_org_id CONSTANT uuid := 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';

  v_misorg_records       int;
  v_null_org_records     int;
  v_misfiled_module_recs int;
  v_bad_owner_records    int;
  v_links_source         int;
  v_links_target         int;
  v_relations_from       int;
  v_relations_to         int;
  v_audit_fixed          int;
  v_import_src           int;
  v_import_map           int;
  v_import_jobs          int;
  v_tasks_orphan         int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_pifh_org_id) THEN
    RAISE EXCEPTION '[PIFH] organizations row missing for canonical id %', v_pifh_org_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 1) crm_records: all rows on PIFH org
  -- --------------------------------------------------------------------------
  UPDATE public.crm_records SET org_id = v_pifh_org_id
   WHERE org_id IS NOT NULL AND org_id <> v_pifh_org_id;
  GET DIAGNOSTICS v_misorg_records = ROW_COUNT;

  UPDATE public.crm_records SET org_id = v_pifh_org_id WHERE org_id IS NULL;
  GET DIAGNOSTICS v_null_org_records = ROW_COUNT;

  IF v_misorg_records > 0 THEN
    RAISE NOTICE '[PIFH align] crm_records re-homed from other orgs: %', v_misorg_records;
  END IF;
  IF v_null_org_records > 0 THEN
    RAISE NOTICE '[PIFH align] crm_records NULL org_id fixed: %', v_null_org_records;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2) Point records at PIFH-owned module with same key
  -- --------------------------------------------------------------------------
  WITH misfiled AS (
    SELECT r.id AS record_id, m.key AS module_key
    FROM public.crm_records r
    JOIN public.crm_modules m ON m.id = r.module_id
    WHERE m.org_id <> v_pifh_org_id
  ),
  remapped AS (
    UPDATE public.crm_records r
       SET module_id = pifh_m.id
      FROM misfiled
      JOIN public.crm_modules pifh_m
        ON pifh_m.org_id = v_pifh_org_id
       AND pifh_m.key     = misfiled.module_key
       AND pifh_m.is_enabled = true
     WHERE r.id = misfiled.record_id
     RETURNING r.id
  )
  SELECT COUNT(*) INTO v_misfiled_module_recs FROM remapped;

  IF v_misfiled_module_recs > 0 THEN
    RAISE NOTICE '[PIFH align] crm_records module_id remapped to PIFH modules: %', v_misfiled_module_recs;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3) Child tables: org_id must match parent record
  -- --------------------------------------------------------------------------
  UPDATE public.crm_notes n SET org_id = r.org_id
   FROM public.crm_records r
   WHERE n.record_id = r.id AND n.org_id IS DISTINCT FROM r.org_id;

  UPDATE public.crm_tasks t SET org_id = r.org_id
   FROM public.crm_records r
   WHERE t.record_id IS NOT NULL AND t.record_id = r.id AND t.org_id IS DISTINCT FROM r.org_id;

  BEGIN
    UPDATE public.crm_attachments a SET org_id = r.org_id
     FROM public.crm_records r
     WHERE a.record_id = r.id AND a.org_id IS DISTINCT FROM r.org_id;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE '[PIFH align] crm_attachments has no org_id; skipped';
  END;

  -- Standalone tasks (no record): still CRM-scoped to PIFH
  UPDATE public.crm_tasks t SET org_id = v_pifh_org_id
   WHERE t.record_id IS NULL AND t.org_id IS DISTINCT FROM v_pifh_org_id;
  GET DIAGNOSTICS v_tasks_orphan = ROW_COUNT;
  IF v_tasks_orphan > 0 THEN
    RAISE NOTICE '[PIFH align] standalone crm_tasks org_id set to PIFH: %', v_tasks_orphan;
  END IF;

  -- --------------------------------------------------------------------------
  -- 4) Record graph + audit: follow surviving record org
  -- --------------------------------------------------------------------------
  UPDATE public.crm_record_links l SET org_id = r.org_id
   FROM public.crm_records r
   WHERE r.id = l.source_record_id AND l.org_id IS DISTINCT FROM r.org_id;
  GET DIAGNOSTICS v_links_source = ROW_COUNT;

  UPDATE public.crm_record_links l SET org_id = r.org_id
   FROM public.crm_records r
   WHERE r.id = l.target_record_id AND l.org_id IS DISTINCT FROM r.org_id;
  GET DIAGNOSTICS v_links_target = ROW_COUNT;

  IF v_links_source + v_links_target > 0 THEN
    RAISE NOTICE '[PIFH align] crm_record_links org_id healed (source/target): % + %',
      v_links_source, v_links_target;
  END IF;

  UPDATE public.crm_relations rel SET org_id = r.org_id
   FROM public.crm_records r
   WHERE r.id = rel.from_record_id AND rel.org_id IS DISTINCT FROM r.org_id;
  GET DIAGNOSTICS v_relations_from = ROW_COUNT;

  UPDATE public.crm_relations rel SET org_id = r.org_id
   FROM public.crm_records r
   WHERE r.id = rel.to_record_id AND rel.org_id IS DISTINCT FROM r.org_id;
  GET DIAGNOSTICS v_relations_to = ROW_COUNT;

  IF v_relations_from + v_relations_to > 0 THEN
    RAISE NOTICE '[PIFH align] crm_relations org_id healed (from/to endpoints): % + %',
      v_relations_from, v_relations_to;
  END IF;

  UPDATE public.crm_audit_log a SET org_id = r.org_id
   FROM public.crm_records r
   WHERE a.entity = 'crm_records'
     AND a.entity_id = r.id
     AND a.org_id IS DISTINCT FROM r.org_id;
  GET DIAGNOSTICS v_audit_fixed = ROW_COUNT;
  IF v_audit_fixed > 0 THEN
    RAISE NOTICE '[PIFH align] crm_audit_log (crm_records) org_id healed: %', v_audit_fixed;
  END IF;

  -- Remaining audit rows with wrong org (other entities) — align to PIFH
  UPDATE public.crm_audit_log SET org_id = v_pifh_org_id
   WHERE org_id IS DISTINCT FROM v_pifh_org_id;

  -- --------------------------------------------------------------------------
  -- 5) Import pipeline metadata (safe: single-tenant)
  -- --------------------------------------------------------------------------
  UPDATE public.crm_import_sources SET org_id = v_pifh_org_id
   WHERE org_id IS DISTINCT FROM v_pifh_org_id;
  GET DIAGNOSTICS v_import_src = ROW_COUNT;

  UPDATE public.crm_import_mappings SET org_id = v_pifh_org_id
   WHERE org_id IS DISTINCT FROM v_pifh_org_id;
  GET DIAGNOSTICS v_import_map = ROW_COUNT;

  UPDATE public.crm_import_jobs SET org_id = v_pifh_org_id
   WHERE org_id IS DISTINCT FROM v_pifh_org_id;
  GET DIAGNOSTICS v_import_jobs = ROW_COUNT;

  IF v_import_src + v_import_map + v_import_jobs > 0 THEN
    RAISE NOTICE '[PIFH align] import tables rows updated: sources=%, mappings=%, jobs=%',
      v_import_src, v_import_map, v_import_jobs;
  END IF;

  -- --------------------------------------------------------------------------
  -- 6) Owner outside PIFH — same as visibility audit
  -- --------------------------------------------------------------------------
  UPDATE public.crm_records r SET owner_id = NULL
   WHERE r.owner_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id = r.owner_id
          AND p.organization_id = v_pifh_org_id
     );
  GET DIAGNOSTICS v_bad_owner_records = ROW_COUNT;
  IF v_bad_owner_records > 0 THEN
    RAISE NOTICE '[PIFH align] cleared owner_id for % rows (owner not in PIFH)', v_bad_owner_records;
  END IF;

  -- --------------------------------------------------------------------------
  -- 7) Schema modules used only by PIFH records — re-home module org
  --     (skips rows that would collide on (org_id, key) with an existing PIFH module)
  -- --------------------------------------------------------------------------
  UPDATE public.crm_modules m SET org_id = v_pifh_org_id
   WHERE m.org_id IS DISTINCT FROM v_pifh_org_id
     AND EXISTS (SELECT 1 FROM public.crm_records r WHERE r.module_id = m.id AND r.org_id = v_pifh_org_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.crm_modules keep
        WHERE keep.org_id = v_pifh_org_id
          AND keep.key = m.key
          AND keep.id <> m.id
     );

  RAISE NOTICE '[PIFH align] complete. Core CRM data scoped to Pay It Forward org %.', v_pifh_org_id;

END;
$$;

COMMIT;
