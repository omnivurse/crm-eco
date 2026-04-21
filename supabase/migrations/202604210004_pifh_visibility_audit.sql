-- ============================================================================
-- PIFH visibility audit + repair
--
-- Every row in this database belongs to PIFH (org_id
-- ac6e7228-2ea0-4582-8464-562c3e8ac56e). A prior reunify migration
-- (202603290001) consolidated most of the split data, but this one
-- catches any stragglers and heals cross-org misfilings that would make
-- a record *present* in the DB but *invisible* to PIFH users (because
-- every CRM query is scoped by profile.organization_id).
--
-- This migration is intentionally conservative:
--   - It REPAIRS (UPDATEs) obvious misfilings where the correct PIFH
--     counterpart is unambiguous.
--   - It REPORTS (RAISE NOTICE) anything else for manual inspection.
--   - It does NOT delete anything.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_pifh_org_id CONSTANT uuid := 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';

  v_misorg_records       int;
  v_null_org_records     int;
  v_misorg_notes         int;
  v_misorg_tasks         int;
  v_misorg_attach        int;
  v_misfiled_module_recs int;
  v_bad_owner_records    int;
  v_total_records        int;

  v_other_orgs           int;
BEGIN
  -- --------------------------------------------------------------
  -- 1. Pre-audit counts
  -- --------------------------------------------------------------
  SELECT COUNT(*) INTO v_total_records FROM crm_records;
  SELECT COUNT(*) INTO v_misorg_records
    FROM crm_records WHERE org_id IS NOT NULL AND org_id <> v_pifh_org_id;
  SELECT COUNT(*) INTO v_null_org_records
    FROM crm_records WHERE org_id IS NULL;
  SELECT COUNT(DISTINCT org_id) INTO v_other_orgs
    FROM crm_records WHERE org_id IS NOT NULL AND org_id <> v_pifh_org_id;

  RAISE NOTICE '[PIFH audit] crm_records total=%, already_pifh=%, misorg=% (across % distinct orgs), null_org=%',
    v_total_records,
    v_total_records - v_misorg_records - v_null_org_records,
    v_misorg_records,
    v_other_orgs,
    v_null_org_records;

  -- --------------------------------------------------------------
  -- 2. Heal misfiled crm_records: anything under a non-PIFH org_id
  --    that didn't land in the March reunify. Safe because this DB
  --    is single-tenant (PIFH) by definition, per client confirmation.
  -- --------------------------------------------------------------
  IF v_misorg_records > 0 THEN
    RAISE NOTICE '[PIFH audit] re-homing % misfiled records to PIFH', v_misorg_records;
    UPDATE crm_records SET org_id = v_pifh_org_id
     WHERE org_id IS NOT NULL AND org_id <> v_pifh_org_id;
  END IF;

  IF v_null_org_records > 0 THEN
    RAISE NOTICE '[PIFH audit] re-homing % records with NULL org_id to PIFH', v_null_org_records;
    UPDATE crm_records SET org_id = v_pifh_org_id WHERE org_id IS NULL;
  END IF;

  -- --------------------------------------------------------------
  -- 3. Repoint records whose module_id belongs to a non-PIFH module.
  --    After step 2 every record is on PIFH, but a record may still
  --    be pointed at a module row owned by another org (a leftover
  --    from the split-data era). Map it to PIFH's module with the
  --    same `key`, if one exists.
  -- --------------------------------------------------------------
  WITH misfiled AS (
    SELECT r.id AS record_id, m.key AS module_key
    FROM crm_records r
    JOIN crm_modules  m ON m.id = r.module_id
    WHERE m.org_id <> v_pifh_org_id
  ),
  remapped AS (
    UPDATE crm_records r
       SET module_id = pifh_m.id
      FROM misfiled
      JOIN crm_modules pifh_m
        ON pifh_m.org_id = v_pifh_org_id
       AND pifh_m.key    = misfiled.module_key
       AND pifh_m.is_enabled = true
     WHERE r.id = misfiled.record_id
     RETURNING r.id
  )
  SELECT COUNT(*) INTO v_misfiled_module_recs FROM remapped;

  IF v_misfiled_module_recs > 0 THEN
    RAISE NOTICE '[PIFH audit] remapped % records to PIFH-owned module rows', v_misfiled_module_recs;
  END IF;

  -- --------------------------------------------------------------
  -- 4. Heal child tables whose own org_id column is stale / wrong.
  --    crm_notes / crm_tasks / crm_attachments each carry an org_id
  --    that should equal their referenced record's org_id. RLS joins
  --    on this column directly; if it's wrong the row is invisible
  --    to PIFH users even though the parent record is correct.
  -- --------------------------------------------------------------
  WITH fixed AS (
    UPDATE crm_notes n
       SET org_id = r.org_id
      FROM crm_records r
     WHERE n.record_id = r.id
       AND n.org_id IS DISTINCT FROM r.org_id
     RETURNING n.id
  )
  SELECT COUNT(*) INTO v_misorg_notes FROM fixed;
  IF v_misorg_notes > 0 THEN
    RAISE NOTICE '[PIFH audit] healed % crm_notes with mismatched org_id', v_misorg_notes;
  END IF;

  WITH fixed AS (
    UPDATE crm_tasks t
       SET org_id = r.org_id
      FROM crm_records r
     WHERE t.record_id = r.id
       AND t.org_id IS DISTINCT FROM r.org_id
     RETURNING t.id
  )
  SELECT COUNT(*) INTO v_misorg_tasks FROM fixed;
  IF v_misorg_tasks > 0 THEN
    RAISE NOTICE '[PIFH audit] healed % crm_tasks with mismatched org_id', v_misorg_tasks;
  END IF;

  -- crm_attachments may not have an org_id column in every environment;
  -- skip gracefully if so.
  BEGIN
    WITH fixed AS (
      UPDATE crm_attachments a
         SET org_id = r.org_id
        FROM crm_records r
       WHERE a.record_id = r.id
         AND a.org_id IS DISTINCT FROM r.org_id
       RETURNING a.id
    )
    SELECT COUNT(*) INTO v_misorg_attach FROM fixed;
    IF v_misorg_attach > 0 THEN
      RAISE NOTICE '[PIFH audit] healed % crm_attachments with mismatched org_id', v_misorg_attach;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE '[PIFH audit] crm_attachments has no org_id column, skipping';
  END;

  -- --------------------------------------------------------------
  -- 5. Null out owner_id on records pointing to profiles that
  --    aren't in PIFH. Leaves the record visible to everyone on the
  --    team (owner-scoped views will treat it as unowned) instead
  --    of filtering it out for all PIFH users.
  -- --------------------------------------------------------------
  WITH fixed AS (
    UPDATE crm_records r
       SET owner_id = NULL
     WHERE r.owner_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM profiles p
          WHERE p.id = r.owner_id
            AND p.organization_id = v_pifh_org_id
       )
     RETURNING r.id
  )
  SELECT COUNT(*) INTO v_bad_owner_records FROM fixed;
  IF v_bad_owner_records > 0 THEN
    RAISE NOTICE '[PIFH audit] cleared owner_id on % records (owner outside PIFH)', v_bad_owner_records;
  END IF;

  RAISE NOTICE '[PIFH audit] complete. Every crm_records row is now PIFH-owned.';
END;
$$;

COMMIT;
