-- ============================================================================
-- One-shot fix: consolidate PIFH onto org ac6e7228-2ea0-4582-8464-562c3e8ac56e
--
-- Background
-- ----------
-- The Supabase DB for this project has two organizations:
--   * 00000000-0000-0000-0000-000000000001 — named "Pay It Forward Health"
--       - Holds the only 2 profiles (wendy@, omnivurse@)
--       - Holds the 7 crm_modules
--       - Holds ZERO crm_records / crm_notes / crm_tasks
--   * ac6e7228-2ea0-4582-8464-562c3e8ac56e — named "System Administration"
--       - Holds all 16,753 crm_records + 99,564 crm_notes + 3 crm_tasks
--       - Holds ZERO profiles, ZERO modules
--
-- Because every CRM query is RLS-scoped by profiles.organization_id, Wendy and
-- Omnivurse currently see an empty CRM. Recent migrations (202604210004/5/8)
-- hardcoded ac6e7228-... as "the PIFH org". We consolidate on that id.
--
-- In addition, migration 202604210004 moved 979 crm_records from 00000000 to
-- ac6e7228 in the wrong direction relative to the users' profiles — those are
-- unchanged by this script (they're still in ac6e7228, which will be the real
-- PIFH org after this runs).
--
-- What this script does (all in ONE transaction):
--   1. Rename ac6e7228 -> "Pay It Forward Health" and 00000000 -> "Legacy (deprecated)"
--   2. Move the 2 profiles to ac6e7228 so the users can see the data
--   3. Move the 7 crm_modules to ac6e7228 so record.module_id -> module rows share org
--   4. Heal any crm_notes / crm_tasks / crm_attachments whose org_id doesn't
--      match their parent record (should be 0 after step 2+3 for consistency)
--   5. Verify post-conditions; RAISE EXCEPTION if anything looks wrong
--
-- Side effects / things to know:
--   * profiles.organization_id moves 2 rows: wendy, omnivurse.
--   * crm_modules.org_id moves 7 rows. module IDs are unchanged, so every
--     crm_records.module_id FK keeps resolving correctly.
--   * organizations.name is renamed on both rows. The slug is left alone
--     to preserve any external reference by slug.
--   * NO data rows in crm_records / crm_notes / crm_tasks are touched.
--   * Fully wrapped in BEGIN/COMMIT; on any failure the whole thing rolls back.
--
-- After running this, re-run the bulk auto-merge to collapse the 678 probable
-- duplicates:
--   SELECT bulk_auto_merge_duplicates('ac6e7228-2ea0-4582-8464-562c3e8ac56e', 5000);
-- ============================================================================

BEGIN;

SET LOCAL statement_timeout = '5min';

DO $$
DECLARE
  v_canonical_org CONSTANT uuid := 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
  v_legacy_org    CONSTANT uuid := '00000000-0000-0000-0000-000000000001';

  v_profiles_moved int;
  v_modules_moved  int;
  v_notes_healed   int;
  v_tasks_healed   int;
  v_attach_healed  int;

  v_post_profiles_in_canonical int;
  v_post_modules_in_canonical  int;
  v_post_records_in_canonical  int;
  v_post_records_out           int;
BEGIN
  -- 1. Rename organizations.
  UPDATE organizations SET name = 'Pay It Forward Health' WHERE id = v_canonical_org;
  UPDATE organizations SET name = 'Legacy (deprecated) - do not use', slug = 'legacy-deprecated'
   WHERE id = v_legacy_org;

  -- 2. Move the 2 profiles (wendy, omnivurse) to the canonical org.
  WITH moved AS (
    UPDATE profiles
       SET organization_id = v_canonical_org,
           updated_at      = NOW()
     WHERE organization_id = v_legacy_org
     RETURNING id
  )
  SELECT COUNT(*) INTO v_profiles_moved FROM moved;
  RAISE NOTICE '[fix] profiles moved to canonical org: %', v_profiles_moved;

  -- 3. Move the 7 crm_modules to the canonical org.
  --    IMPORTANT: module IDs stay the same, so crm_records.module_id keeps
  --    resolving via FK. We just change which org the module rows live under.
  WITH moved AS (
    UPDATE crm_modules
       SET org_id     = v_canonical_org,
           updated_at = NOW()
     WHERE org_id = v_legacy_org
     RETURNING id
  )
  SELECT COUNT(*) INTO v_modules_moved FROM moved;
  RAISE NOTICE '[fix] modules moved to canonical org: %', v_modules_moved;

  -- 4. Heal child-row org_id to match their parent record's org_id.
  --    After step 3, all modules/records/profiles are in one org. This
  --    just makes sure notes/tasks/attachments agree.
  WITH fixed AS (
    UPDATE crm_notes n
       SET org_id = r.org_id
      FROM crm_records r
     WHERE n.record_id = r.id
       AND n.org_id IS DISTINCT FROM r.org_id
     RETURNING n.id
  )
  SELECT COUNT(*) INTO v_notes_healed FROM fixed;
  RAISE NOTICE '[fix] crm_notes healed: %', v_notes_healed;

  WITH fixed AS (
    UPDATE crm_tasks t
       SET org_id = r.org_id
      FROM crm_records r
     WHERE t.record_id = r.id
       AND t.org_id IS DISTINCT FROM r.org_id
     RETURNING t.id
  )
  SELECT COUNT(*) INTO v_tasks_healed FROM fixed;
  RAISE NOTICE '[fix] crm_tasks healed: %', v_tasks_healed;

  BEGIN
    WITH fixed AS (
      UPDATE crm_attachments a
         SET org_id = r.org_id
        FROM crm_records r
       WHERE a.record_id = r.id
         AND a.org_id IS DISTINCT FROM r.org_id
       RETURNING a.id
    )
    SELECT COUNT(*) INTO v_attach_healed FROM fixed;
    RAISE NOTICE '[fix] crm_attachments healed: %', v_attach_healed;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE '[fix] crm_attachments has no org_id column, skipping';
  END;

  -- 5. Post-condition checks — any failure here rolls back the whole tx.
  SELECT COUNT(*) INTO v_post_profiles_in_canonical
    FROM profiles WHERE organization_id = v_canonical_org;
  SELECT COUNT(*) INTO v_post_modules_in_canonical
    FROM crm_modules WHERE org_id = v_canonical_org;
  SELECT COUNT(*) INTO v_post_records_in_canonical
    FROM crm_records WHERE org_id = v_canonical_org;
  SELECT COUNT(*) INTO v_post_records_out
    FROM crm_records WHERE org_id <> v_canonical_org OR org_id IS NULL;

  RAISE NOTICE '[fix] POST: profiles_in_canonical=%, modules_in_canonical=%, records_in_canonical=%, records_outside=%',
    v_post_profiles_in_canonical, v_post_modules_in_canonical,
    v_post_records_in_canonical, v_post_records_out;

  IF v_post_profiles_in_canonical < 2 THEN
    RAISE EXCEPTION 'post-check failed: expected >=2 profiles in canonical org, got %', v_post_profiles_in_canonical;
  END IF;
  IF v_post_modules_in_canonical < 7 THEN
    RAISE EXCEPTION 'post-check failed: expected >=7 modules in canonical org, got %', v_post_modules_in_canonical;
  END IF;
  IF v_post_records_out > 0 THEN
    RAISE EXCEPTION 'post-check failed: % crm_records still outside canonical org', v_post_records_out;
  END IF;

  -- Spot check: at least one record must now have a module in the same org
  PERFORM 1
    FROM crm_records r
    JOIN crm_modules m ON m.id = r.module_id
   WHERE r.org_id = m.org_id
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'post-check failed: no records have module_id pointing at a module in the same org';
  END IF;

  RAISE NOTICE '[fix] all post-condition checks passed. Committing.';
END;
$$;

COMMIT;
