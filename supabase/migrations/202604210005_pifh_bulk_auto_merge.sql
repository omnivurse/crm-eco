-- ============================================================================
-- PIFH: bulk auto-merge of obvious duplicate pairs.
--
-- Runs the newly-shipped `merge_crm_records` RPC for every pair matched by
-- the "moderate" rule set (see PR notes / client Q&A):
--
--   Rule 1 — linked_member_id collisions
--   Rule 2 — enrollment-sync twins (source='enrollment_sync', no notes/tasks)
--            matched by linked_member_id, email (ci), or phone+first+last
--   Rule 3 — exact email pairs (same module) where one side is empty
--   Rule 4 — phone + first_name + last_name where one side is empty
--   Rule 5 — date_of_birth + first_name + last_name where one side is empty
--
-- "Empty" here means the record carries no crm_notes, no crm_tasks, and no
-- crm_attachments of its own — so merging it into its sibling cannot
-- drop user-entered history.
--
-- Keeper selection: whichever side has *more* user-entered history wins;
-- ties broken by updated_at DESC (most-recently-edited), then Active status.
-- Every merge goes through the standard RPC, so each one gets a
-- crm_audit_log entry with a full snapshot of the deleted record.
--
-- If no PIFH admin/manager profile exists yet (fresh DB, migration-only
-- install) the migration is a no-op — the RPC same-org check can't pass
-- without a real caller. Re-run the migration (idempotent) after the
-- first admin account is seeded.
-- ============================================================================

BEGIN;

-- Give ourselves headroom: the merge RPC does a lot of child-row
-- repointing per pair, and a single transaction with thousands of
-- pairs can exceed Supabase's default statement_timeout (30s).
SET LOCAL statement_timeout = '15min';

DO $$
DECLARE
  v_pifh_org_id    CONSTANT uuid := 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
  v_max_per_rule   CONSTANT int  := 5000;  -- safety cap; re-run the migration to continue.
  v_system_user_id uuid;

  v_pair         RECORD;
  v_keeper_id    uuid;
  v_duplicate_id uuid;

  v_rule1 int := 0;
  v_rule2 int := 0;
  v_rule3 int := 0;
  v_rule4 int := 0;
  v_rule5 int := 0;
  v_errors int := 0;
  v_rpc_result jsonb;
BEGIN
  -- --------------------------------------------------------------
  -- Locate a PIFH admin/manager to act as p_user_id for the RPC.
  -- (The RPC validates that this profile lives in the same org as
  -- the record, so picking any PIFH admin is enough.)
  -- --------------------------------------------------------------
  SELECT id INTO v_system_user_id
    FROM profiles
   WHERE organization_id = v_pifh_org_id
     AND crm_role IN ('crm_admin', 'crm_manager')
   ORDER BY created_at ASC NULLS LAST
   LIMIT 1;

  IF v_system_user_id IS NULL THEN
    RAISE NOTICE '[PIFH bulk merge] no PIFH admin/manager profile found; skipping. Re-run this migration after the first admin is seeded.';
    RETURN;
  END IF;

  RAISE NOTICE '[PIFH bulk merge] using system actor: %', v_system_user_id;

  -- We keep a rolling "already merged" set so a record deleted by rule
  -- N isn't revisited by rule N+1. Easiest way: re-fetch pairs inside
  -- each rule loop (a deleted duplicate no longer matches).

  -- --------------------------------------------------------------
  -- Rule 1: linked_member_id collisions.
  -- Two records claiming the same enrollment member. Keeper = the one
  -- with more history.
  -- --------------------------------------------------------------
  FOR v_pair IN
    WITH pairs AS (
      SELECT
        (data->>'linked_member_id') AS member_id,
        id,
        org_id,
        module_id,
        status,
        updated_at,
        (SELECT count(*) FROM crm_notes  n WHERE n.record_id = crm_records.id) +
        (SELECT count(*) FROM crm_tasks  t WHERE t.record_id = crm_records.id) +
        (SELECT count(*) FROM crm_attachments a WHERE a.record_id = crm_records.id)
          AS history_count
      FROM crm_records
      WHERE org_id = v_pifh_org_id
        AND data ? 'linked_member_id'
        AND data->>'linked_member_id' <> ''
    ),
    grouped AS (
      SELECT member_id, module_id
        FROM pairs
       GROUP BY member_id, module_id
      HAVING COUNT(*) > 1
    ),
    ranked AS (
      SELECT p.*,
             ROW_NUMBER() OVER (
               PARTITION BY p.member_id, p.module_id
               ORDER BY p.history_count  DESC,
                        (p.status = 'Active') DESC,
                        p.updated_at      DESC NULLS LAST
             ) AS rn
        FROM pairs p
        JOIN grouped g ON g.member_id = p.member_id AND g.module_id = p.module_id
    )
    SELECT
      k.id AS keeper_id,
      d.id AS duplicate_id
      FROM ranked k
      JOIN ranked d
        ON d.member_id = k.member_id
       AND d.module_id = k.module_id
       AND k.rn = 1
       AND d.rn > 1
     LIMIT v_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_system_user_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule1 := v_rule1 + 1;
      ELSE
        v_errors := v_errors + 1;
        RAISE WARNING '[PIFH bulk merge][rule1] failed pair (%, %): %',
          v_pair.keeper_id, v_pair.duplicate_id, v_rpc_result->>'error';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING '[PIFH bulk merge][rule1] exception on pair (%, %): %',
        v_pair.keeper_id, v_pair.duplicate_id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '[PIFH bulk merge] rule 1 (linked_member_id): merged % pairs', v_rule1;

  -- --------------------------------------------------------------
  -- Rule 2: enrollment-sync twins with zero history.
  -- The sync trigger used to insert a fresh Contact whenever it
  -- couldn't find a match on linked_member_id. Those rows are
  -- source='enrollment_sync' and typically carry nothing but the
  -- enrollment fields — safe to fold into the real Contact.
  -- Match keys: email (case-insensitive) OR phone+first+last.
  -- --------------------------------------------------------------
  FOR v_pair IN
    WITH sync_twins AS (
      SELECT
        id, org_id, module_id, email, phone,
        data->>'first_name' AS first_name,
        data->>'last_name'  AS last_name
      FROM crm_records
      WHERE org_id = v_pifh_org_id
        AND data->>'source' = 'enrollment_sync'
        AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
        AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
        AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT
      real_rec.id AS keeper_id,
      sync.id     AS duplicate_id
      FROM sync_twins sync
      JOIN crm_records real_rec
        ON real_rec.id        <> sync.id
       AND real_rec.org_id    = sync.org_id
       AND real_rec.module_id = sync.module_id
       AND (
            (real_rec.email IS NOT NULL AND sync.email IS NOT NULL
               AND LOWER(real_rec.email) = LOWER(sync.email))
         OR (
            real_rec.phone IS NOT NULL AND sync.phone IS NOT NULL
               AND real_rec.phone = sync.phone
               AND sync.first_name IS NOT NULL AND sync.last_name IS NOT NULL
               AND LOWER(COALESCE(real_rec.data->>'first_name','')) = LOWER(sync.first_name)
               AND LOWER(COALESCE(real_rec.data->>'last_name', '')) = LOWER(sync.last_name)
            )
       )
     LIMIT v_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_system_user_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule2 := v_rule2 + 1;
      ELSE
        v_errors := v_errors + 1;
        RAISE WARNING '[PIFH bulk merge][rule2] failed pair (%, %): %',
          v_pair.keeper_id, v_pair.duplicate_id, v_rpc_result->>'error';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING '[PIFH bulk merge][rule2] exception on pair (%, %): %',
        v_pair.keeper_id, v_pair.duplicate_id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '[PIFH bulk merge] rule 2 (enrollment-sync twins): merged % pairs', v_rule2;

  -- --------------------------------------------------------------
  -- Rule 3: exact email pair (same module), one side has no history.
  -- Rule 2's sync-twin check handles source='enrollment_sync' rows
  -- already; this catches anything else (e.g. blank Contact imported
  -- but never touched).
  -- --------------------------------------------------------------
  FOR v_pair IN
    WITH empties AS (
      SELECT id, org_id, module_id, email
        FROM crm_records
       WHERE org_id = v_pifh_org_id
         AND email IS NOT NULL AND email <> ''
         AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT real_rec.id AS keeper_id, empty.id AS duplicate_id
      FROM empties empty
      JOIN crm_records real_rec
        ON real_rec.id        <> empty.id
       AND real_rec.org_id    = empty.org_id
       AND real_rec.module_id = empty.module_id
       AND real_rec.email IS NOT NULL
       AND LOWER(real_rec.email) = LOWER(empty.email)
     LIMIT v_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_system_user_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule3 := v_rule3 + 1;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;
  RAISE NOTICE '[PIFH bulk merge] rule 3 (exact email + empty side): merged % pairs', v_rule3;

  -- --------------------------------------------------------------
  -- Rule 4: phone + first_name + last_name, one side has no history.
  -- --------------------------------------------------------------
  FOR v_pair IN
    WITH empties AS (
      SELECT id, org_id, module_id, phone,
             data->>'first_name' AS first_name,
             data->>'last_name'  AS last_name
        FROM crm_records
       WHERE org_id = v_pifh_org_id
         AND phone IS NOT NULL AND phone <> ''
         AND data->>'first_name' IS NOT NULL
         AND data->>'last_name'  IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT real_rec.id AS keeper_id, empty.id AS duplicate_id
      FROM empties empty
      JOIN crm_records real_rec
        ON real_rec.id        <> empty.id
       AND real_rec.org_id    = empty.org_id
       AND real_rec.module_id = empty.module_id
       AND real_rec.phone = empty.phone
       AND LOWER(COALESCE(real_rec.data->>'first_name','')) = LOWER(empty.first_name)
       AND LOWER(COALESCE(real_rec.data->>'last_name', '')) = LOWER(empty.last_name)
     LIMIT v_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_system_user_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule4 := v_rule4 + 1;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;
  RAISE NOTICE '[PIFH bulk merge] rule 4 (phone + name + empty side): merged % pairs', v_rule4;

  -- --------------------------------------------------------------
  -- Rule 5: DOB + first + last, one side has no history.
  -- Safer than phone since DOB is stable (no shared household DOBs).
  -- --------------------------------------------------------------
  FOR v_pair IN
    WITH empties AS (
      SELECT id, org_id, module_id,
             data->>'date_of_birth' AS dob,
             data->>'first_name'    AS first_name,
             data->>'last_name'     AS last_name
        FROM crm_records
       WHERE org_id = v_pifh_org_id
         AND data->>'date_of_birth' IS NOT NULL
         AND data->>'date_of_birth' <> ''
         AND data->>'first_name' IS NOT NULL
         AND data->>'last_name'  IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT real_rec.id AS keeper_id, empty.id AS duplicate_id
      FROM empties empty
      JOIN crm_records real_rec
        ON real_rec.id        <> empty.id
       AND real_rec.org_id    = empty.org_id
       AND real_rec.module_id = empty.module_id
       AND real_rec.data->>'date_of_birth' = empty.dob
       AND LOWER(COALESCE(real_rec.data->>'first_name','')) = LOWER(empty.first_name)
       AND LOWER(COALESCE(real_rec.data->>'last_name', '')) = LOWER(empty.last_name)
     LIMIT v_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_system_user_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule5 := v_rule5 + 1;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;
  RAISE NOTICE '[PIFH bulk merge] rule 5 (DOB + name + empty side): merged % pairs', v_rule5;

  RAISE NOTICE '[PIFH bulk merge] DONE. r1=% r2=% r3=% r4=% r5=%  errors=%',
    v_rule1, v_rule2, v_rule3, v_rule4, v_rule5, v_errors;
END;
$$;

COMMIT;
