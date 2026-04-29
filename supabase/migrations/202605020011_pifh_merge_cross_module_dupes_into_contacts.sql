-- =============================================================================
-- Merge cross-module duplicate records into the canonical Contacts row.
--
-- Diagnosis: searching "Amanda Caras" in PIFH returned two records — one in
-- the Contacts module (id c7b86e58…, created 2024-04) and one in the Members
-- module (id 3edf4201…, created 2026-03). Same email, same phone, same
-- person, two CRM rows. A scan of the org found 942 such people:
--
--   contacts + members          → 918 people  (the bulk; admin-portal sync
--                                              created members records that
--                                              shadow existing contacts)
--   contacts + leads + members  →  18 people
--   contacts + leads            →   5 people
--   advisors + contacts         →   1 person
--
-- Total extra (mergeable) rows: 960. A user searching Amanda's name sees both,
-- can't tell which to act on, and any update to one drifts from the other.
--
-- Fix: for every duplicate cluster keyed by `lower(trim(email))`, pick the
-- record in the **contacts** module as the canonical keeper and call the
-- existing `merge_crm_records` RPC for every other record in the cluster.
-- The RPC handles:
--   • merging JSONB `data` (keeper wins on conflicts; missing keys filled)
--   • re-pointing every child row (notes, tasks, links, audit log, recently
--     viewed, deal stage history, attachments, etc.) to the keeper
--   • writing an audit log entry for the merge
--   • deleting the duplicate
--
-- Actor: the merge RPC requires a user id for the audit trail. We use the
-- existing PIFH admin (omnivurse@gmail.com / 46be4d37-…) so the merges
-- show up under a real account.
--
-- Safety:
--   • Skips clusters that have no contacts-module record (extremely rare —
--     0 rows under the current dataset, but the guard is defensive).
--   • Logs progress every 100 merges so a stuck migration is easy to spot.
--   • Catches per-merge errors and continues — one bad row can't block the
--     other 959.
--   • Idempotent: the duplicate clusters disappear after each merge, so
--     re-running the migration is a no-op.
-- =============================================================================

DO $$
DECLARE
  v_org_id      CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  v_actor_uid   CONSTANT uuid := '46be4d37-858a-4e46-abba-f4b75c096aa6';
  cluster       record;
  dup_id        uuid;
  v_processed   int := 0;
  v_merged      int := 0;
  v_skipped     int := 0;
  v_errors      int := 0;
  v_clusters    int := 0;
  v_merge_result jsonb;
BEGIN
  -- Sanity: actor must exist and be on the target org.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE user_id = v_actor_uid AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION '[merge-dupes] actor user_id % is not on org %', v_actor_uid, v_org_id;
  END IF;

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
          -- Keeper preference: contacts module first, then oldest record.
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

    -- Skip if the keeper isn't in contacts (no contacts row in this cluster).
    IF NOT EXISTS (
      SELECT 1 FROM public.crm_records r
        JOIN public.crm_modules m ON m.id = r.module_id
       WHERE r.id = cluster.keeper_id AND m.key = 'contacts'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    FOREACH dup_id IN ARRAY cluster.dup_ids LOOP
      v_processed := v_processed + 1;

      BEGIN
        SELECT public.merge_crm_records(
          p_keeper_id    => cluster.keeper_id,
          p_duplicate_id => dup_id,
          p_user_id      => v_actor_uid
        ) INTO v_merge_result;

        IF (v_merge_result->>'success')::boolean IS NOT FALSE THEN
          v_merged := v_merged + 1;
        ELSE
          v_errors := v_errors + 1;
          RAISE NOTICE '[merge-dupes] keeper=% dup=% returned: %',
            cluster.keeper_id, dup_id, v_merge_result;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE '[merge-dupes] keeper=% dup=% raised %: %',
          cluster.keeper_id, dup_id, SQLSTATE, SQLERRM;
      END;

      IF v_merged % 100 = 0 AND v_merged > 0 THEN
        RAISE NOTICE '[merge-dupes] progress: % merges complete', v_merged;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[merge-dupes] done. clusters=% processed=% merged=% skipped=% errors=%',
    v_clusters, v_processed, v_merged, v_skipped, v_errors;
END $$;
