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

  RAISE NOTICE 'crm_audit_strict: all assertions passed';
END $$;
