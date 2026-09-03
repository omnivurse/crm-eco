-- Fail fast on real referential / merge-audit corruption (use with psql ON_ERROR_STOP + --strict in CI runner).
-- Intentionally ignores: crm_tasks.record_id IS NULL (valid "standalone" tasks per schema).

DO $$
DECLARE
  orphan_mod        bigint;
  rv_bad            bigint;
  merge_kept        bigint;
  merge_del         bigint;
  dup_mig_versions  bigint;
  notes_orphan      bigint;
  task_bad_fk       bigint;
  hs_member_id_drift bigint;
  hs_effective_drift bigint;
  hs_contribution_drift bigint;
  hs_ministry_entity_drift bigint;
  hs_other_drift bigint;
BEGIN
  SELECT COUNT(*) INTO orphan_mod
  FROM public.crm_records r
  LEFT JOIN public.crm_modules m ON m.id = r.module_id
  WHERE m.id IS NULL;

  SELECT COUNT(*) INTO rv_bad
  FROM public.crm_recently_viewed v
  LEFT JOIN public.crm_records r ON r.id = v.record_id
  WHERE r.id IS NULL;

  SELECT COUNT(*) INTO merge_kept
  FROM public.crm_audit_log a
  WHERE a.entity IN ('record', 'crm_records')
    AND a.action = 'merge'
    AND (a.diff->>'kept_id' IS NULL OR a.diff->>'kept_id' = '');

  SELECT COUNT(*) INTO merge_del
  FROM public.crm_audit_log a
  WHERE a.entity IN ('record', 'crm_records')
    AND a.action = 'merge'
    AND (a.diff->>'deleted_id' IS NULL OR a.diff->>'deleted_id' = '');

  SELECT COUNT(*) INTO dup_mig_versions
  FROM (
    SELECT 1
    FROM supabase_migrations.schema_migrations
    GROUP BY version
    HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO notes_orphan
  FROM public.crm_notes n
  LEFT JOIN public.crm_records r ON r.id = n.record_id
  WHERE r.id IS NULL;

  SELECT COUNT(*) INTO task_bad_fk
  FROM public.crm_tasks t
  LEFT JOIN public.crm_records r ON r.id = t.record_id
  WHERE t.record_id IS NOT NULL AND r.id IS NULL;

  IF orphan_mod > 0 THEN
    RAISE EXCEPTION 'crm_audit_strict: % crm_records rows reference missing crm_modules', orphan_mod;
  END IF;

  IF rv_bad > 0 THEN
    RAISE EXCEPTION 'crm_audit_strict: % crm_recently_viewed rows reference missing crm_records', rv_bad;
  END IF;

  IF merge_kept > 0 OR merge_del > 0 THEN
    RAISE EXCEPTION 'crm_audit_strict: merge audit malformed (missing kept_id: %, missing deleted_id: %)', merge_kept, merge_del;
  END IF;

  IF dup_mig_versions > 0 THEN
    RAISE EXCEPTION 'crm_audit_strict: % duplicate version keys in supabase_migrations.schema_migrations', dup_mig_versions;
  END IF;

  IF notes_orphan > 0 THEN
    RAISE EXCEPTION 'crm_audit_strict: % orphaned crm_notes rows (missing crm_records)', notes_orphan;
  END IF;

  IF task_bad_fk > 0 THEN
    RAISE EXCEPTION 'crm_audit_strict: % crm_tasks have record_id set but no crm_records row (broken merge trail)', task_bad_fk;
  END IF;

  -- Health Share canonical-key drift (Zoho legacy vs form keys), across the
  -- contacts AND members person modules.
  --
  -- Sourced from public.crm_healthshare_canonical_drift(), which is defined in
  -- terms of the SAME projector the write-path trigger and the backfill use
  -- (public.crm_healthshare_canonical_patch — see
  -- 20260903190000_healthshare_canonical_projection_guard.sql). That is
  -- deliberate: the assertion cannot drift away from the projector, and the
  -- insurer-vs-ministry rule lives in exactly one place
  -- (public._crm_carrier_is_insurance) instead of being copy-pasted here.
  --
  -- Non-zero means a write path persisted legacy keys without canonical ones —
  -- i.e. the trigger is disabled or a new leak exists. Remedy:
  --   SELECT * FROM public.crm_healthshare_canonical_drift();   -- what/where
  --   SELECT * FROM public.backfill_healthshare_canonical_keys(); -- repair
  SELECT
    COALESCE(SUM(d.member_id_drift), 0),
    COALESCE(SUM(d.effective_drift), 0),
    COALESCE(SUM(d.contribution_drift), 0),
    COALESCE(SUM(d.sharing_entity_drift), 0),
    COALESCE(SUM(d.status_drift + d.insurance_carrier_drift), 0)
  INTO hs_member_id_drift, hs_effective_drift, hs_contribution_drift,
       hs_ministry_entity_drift, hs_other_drift
  FROM public.crm_healthshare_canonical_drift() d;

  IF hs_member_id_drift > 0 OR hs_effective_drift > 0 OR hs_contribution_drift > 0
     OR hs_ministry_entity_drift > 0 OR hs_other_drift > 0 THEN
    RAISE EXCEPTION
      'crm_audit_strict: healthshare canonical drift (member_id=%, effective=%, contribution=%, ministry_entity=%, status+carrier=%) — run SELECT * FROM public.backfill_healthshare_canonical_keys(); / check crm_2_healthshare_canonical_trg',
      hs_member_id_drift, hs_effective_drift, hs_contribution_drift,
      hs_ministry_entity_drift, hs_other_drift;
  END IF;

  RAISE NOTICE 'crm_audit_strict: all assertions passed';
END $$;
