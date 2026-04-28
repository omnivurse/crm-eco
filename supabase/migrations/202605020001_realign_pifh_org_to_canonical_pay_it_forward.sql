-- =============================================================================
-- Re-align PIFH CRM data to the canonical "Pay It Forward Health" org row
-- (`00000000-0000-0000-0000-000000000001`), where the active profiles live.
--
-- Background
-- ----------
-- Two `organizations` rows had drifted apart for the same tenant:
--   • 00000000-0000-0000-0000-000000000001  "Pay It Forward Health"   ← profiles live here
--   • ac6e7228-2ea0-4582-8464-562c3e8ac56e  "System Administration"    ← records ended up here
--
-- The previous alignment migration (`202605011000_pifh_crm_org_full_alignment`)
-- moved CRM data to `ac6e7228…`, but Wendy and the rest of the PIFH staff
-- still authenticate against `00000000…`. Result: she logs in, the layout
-- redirects her into a CRM with zero records and only two modules
-- (`deals`, `prospects`), so `/crm/modules/contacts` and
-- `/crm/modules/leads` 404 because those module keys live on the wrong org.
--
-- Fix
-- ---
-- Move every CRM/product row keyed by `org_id` (or `organization_id`) from
-- `ac6e7228…` → `00000000-0000-0000-0000-000000000001`, with explicit
-- handling for:
--   • `UNIQUE(org_id, key)` collisions on `crm_modules` (repoint dependents,
--     drop the dup)
--   • Every other UNIQUE constraint that includes `org_id` or
--     `organization_id` (delete source-org duplicates whose non-org
--     columns already exist in the target org so the bulk UPDATE doesn't
--     trip the constraint).
--
-- After the merge, archive the old org row so future imports / migrations
-- never accidentally repopulate it.
--
-- Idempotent: re-running after the merge is a no-op.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_old_org CONSTANT uuid := 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
  v_new_org CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  v_table   text;
  v_count   bigint;
  v_total   bigint := 0;
  v_dup_modules int := 0;
  v_collision_count int;
  v_constraint record;
  v_org_col text;
  v_other_cols text;
  v_sql text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_new_org) THEN
    RAISE EXCEPTION '[realign] target org % missing — refusing to merge', v_new_org;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_old_org) THEN
    RAISE NOTICE '[realign] source org % already absent — nothing to do', v_old_org;
    RETURN;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1. crm_modules — handle UNIQUE(org_id, key) up front by repointing
  --    every dependent row (records, fields, layouts, views) at the
  --    canonical (target-org) module, then dropping the duplicate.
  -- ---------------------------------------------------------------------------
  WITH dups AS (
    SELECT old_m.id AS old_id, new_m.id AS new_id, old_m.key
    FROM public.crm_modules old_m
    JOIN public.crm_modules new_m
      ON new_m.org_id = v_new_org
     AND new_m.key    = old_m.key
    WHERE old_m.org_id = v_old_org
  )
  SELECT COUNT(*) INTO v_dup_modules FROM dups;

  IF v_dup_modules > 0 THEN
    RAISE NOTICE '[realign] crm_modules collisions on key: %', v_dup_modules;

    UPDATE public.crm_records r
       SET module_id = d.new_id
      FROM (
        SELECT old_m.id AS old_id, new_m.id AS new_id
          FROM public.crm_modules old_m
          JOIN public.crm_modules new_m
            ON new_m.org_id = v_new_org AND new_m.key = old_m.key
         WHERE old_m.org_id = v_old_org
      ) d
     WHERE r.module_id = d.old_id;

    UPDATE public.crm_fields f
       SET module_id = d.new_id
      FROM (
        SELECT old_m.id AS old_id, new_m.id AS new_id
          FROM public.crm_modules old_m
          JOIN public.crm_modules new_m
            ON new_m.org_id = v_new_org AND new_m.key = old_m.key
         WHERE old_m.org_id = v_old_org
      ) d
     WHERE f.module_id = d.old_id;

    UPDATE public.crm_layouts l
       SET module_id = d.new_id
      FROM (
        SELECT old_m.id AS old_id, new_m.id AS new_id
          FROM public.crm_modules old_m
          JOIN public.crm_modules new_m
            ON new_m.org_id = v_new_org AND new_m.key = old_m.key
         WHERE old_m.org_id = v_old_org
      ) d
     WHERE l.module_id = d.old_id;

    UPDATE public.crm_views v
       SET module_id = d.new_id
      FROM (
        SELECT old_m.id AS old_id, new_m.id AS new_id
          FROM public.crm_modules old_m
          JOIN public.crm_modules new_m
            ON new_m.org_id = v_new_org AND new_m.key = old_m.key
         WHERE old_m.org_id = v_old_org
      ) d
     WHERE v.module_id = d.old_id;

    DELETE FROM public.crm_modules
     WHERE org_id = v_old_org
       AND key IN (SELECT key FROM public.crm_modules WHERE org_id = v_new_org);
  END IF;

  -- Re-home the surviving (non-collision) crm_modules.
  UPDATE public.crm_modules SET org_id = v_new_org
   WHERE org_id = v_old_org;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE '[realign] crm_modules re-homed: %', v_count;
    v_total := v_total + v_count;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2. Pre-empt UNIQUE-constraint collisions on every other table.
  --
  --    For each UNIQUE constraint that includes `org_id` or `organization_id`,
  --    delete source-org rows whose non-org columns already exist in the
  --    target org. The target-org row "wins" — by definition it's the one
  --    Wendy / her team have been writing against, so its values are the
  --    ones to keep.
  -- ---------------------------------------------------------------------------
  FOR v_constraint IN
    SELECT
      tc.table_name,
      tc.constraint_name,
      array_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS cols
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema    = tc.table_schema
    WHERE tc.table_schema    = 'public'
      AND tc.constraint_type = 'UNIQUE'
      AND tc.table_name     <> 'crm_modules'
      AND tc.table_name     <> 'organizations'
      AND tc.table_name     <> 'profiles'
    GROUP BY tc.table_name, tc.constraint_name
  LOOP
    IF 'org_id' = ANY(v_constraint.cols) THEN
      v_org_col := 'org_id';
    ELSIF 'organization_id' = ANY(v_constraint.cols) THEN
      v_org_col := 'organization_id';
    ELSE
      CONTINUE;
    END IF;

    SELECT string_agg(format('s.%I = t.%I', col, col), ' AND ')
      INTO v_other_cols
      FROM unnest(v_constraint.cols) AS col
     WHERE col NOT IN ('org_id', 'organization_id');

    IF v_other_cols IS NULL THEN
      RAISE NOTICE '[realign] skipping single-col org UNIQUE %.%',
        v_constraint.table_name, v_constraint.constraint_name;
      CONTINUE;
    END IF;

    v_sql := format(
      'DELETE FROM public.%I s USING public.%I t WHERE s.%I = $1 AND t.%I = $2 AND %s',
      v_constraint.table_name,
      v_constraint.table_name,
      v_org_col,
      v_org_col,
      v_other_cols
    );

    BEGIN
      EXECUTE v_sql USING v_old_org, v_new_org;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count > 0 THEN
        RAISE NOTICE '[realign] %: deleted % source-org duplicates blocking %',
          v_constraint.table_name, v_count, v_constraint.constraint_name;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[realign] %: dedup query failed (%) — continuing',
        v_constraint.table_name, SQLERRM;
    END;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 3. Bulk-update org_id across every public BASE TABLE that has it.
  -- ---------------------------------------------------------------------------
  FOR v_table IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name   = c.table_name
       AND t.table_type   = 'BASE TABLE'
     WHERE c.table_schema = 'public'
       AND c.column_name  = 'org_id'
       AND c.table_name  <> 'crm_modules'
     ORDER BY c.table_name
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET org_id = $1 WHERE org_id = $2',
      v_table
    ) USING v_new_org, v_old_org;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '[realign] %: % rows moved (org_id)', v_table, v_count;
      v_total := v_total + v_count;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 4. Same for `organization_id` (product/identity-style tables).
  --    Skip `profiles` (kept as-is) and `organizations` (parent table).
  -- ---------------------------------------------------------------------------
  FOR v_table IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name   = c.table_name
       AND t.table_type   = 'BASE TABLE'
     WHERE c.table_schema  = 'public'
       AND c.column_name   = 'organization_id'
       AND c.table_name NOT IN ('profiles', 'organizations')
     ORDER BY c.table_name
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET organization_id = $1 WHERE organization_id = $2',
      v_table
    ) USING v_new_org, v_old_org;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '[realign] %: % rows moved (organization_id)', v_table, v_count;
      v_total := v_total + v_count;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 5. Owner sanity: a record whose owner_id refers to a profile outside the
  --    canonical org gets owner_id NULLed out (mirrors the prior PIFH audit).
  -- ---------------------------------------------------------------------------
  UPDATE public.crm_records r SET owner_id = NULL
   WHERE r.owner_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id = r.owner_id
          AND p.organization_id = v_new_org
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE '[realign] cleared owner_id for % records (owner not in canonical org)', v_count;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 6. Defensive sweep: any record whose module_id still points at a module
  --    in another org gets re-homed to the canonical-org module of the same
  --    key (or surfaces a warning if no equivalent exists).
  -- ---------------------------------------------------------------------------
  UPDATE public.crm_records r
     SET module_id = canon.id
    FROM public.crm_modules off, public.crm_modules canon
   WHERE r.module_id   = off.id
     AND r.org_id      = v_new_org
     AND off.org_id   <> v_new_org
     AND canon.org_id  = v_new_org
     AND canon.key     = off.key;

  SELECT COUNT(*) INTO v_collision_count
    FROM public.crm_records r
    JOIN public.crm_modules m ON m.id = r.module_id
   WHERE r.org_id = v_new_org
     AND m.org_id <> v_new_org;

  IF v_collision_count > 0 THEN
    RAISE WARNING '[realign] % records still point at off-org modules — manual review needed', v_collision_count;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 7. Archive the old org row so future imports/migrations cannot select it
  --    as canonical. We rename it loud-and-clear and keep the row (rather
  --    than DELETE) so any straggling FK pointer doesn't fail.
  -- ---------------------------------------------------------------------------
  UPDATE public.organizations
     SET status = 'archived',
         name   = '[DEPRECATED 2026-04-27] ' ||
                  COALESCE(name, 'unnamed') ||
                  ' (merged into Pay It Forward Health)',
         slug   = COALESCE(slug, 'unknown') || '-deprecated-2026-04-27',
         updated_at = now()
   WHERE id = v_old_org
     AND status IS DISTINCT FROM 'archived';

  RAISE NOTICE '[realign] complete. % total rows re-keyed onto %.', v_total, v_new_org;
END $$;

COMMIT;
