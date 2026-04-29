-- =============================================================================
-- PIFH cleanup of remaining within-module duplicate CLUSTERS.
--
-- Audit run on 2026-04-29 against crm_duplicate_audit_summary returned:
--   • 1 email cluster (cross-module — Susan King across two modules)
--     → SKIPPED here. RPC rejects cross-module merges. Resolve via UI.
--   • 577 phone+name clusters; 420 pass min_name_similarity ≥ 0.5
--     → 478 mergeable records under that threshold.
--
-- Sample inspection of the top 30 phone+name clusters showed they're
-- almost all genuine same-person dupes (identical titles repeated, or
-- typos like "Monica Prosrse"/"Monica Prosise"). The one risk pattern
-- is *generational suffix* mismatch: one record "Curtis Spruill" plus
-- another "Curtis Spruill Jr" sharing the household phone might be
-- father+son, not the same person. The trigram filter doesn't catch it.
--
-- Tier-1 (auto-merge here) requires:
--   1. rule = 'phone+name' AND min_name_similarity ≥ 0.5
--   2. all member module_ids are identical (RPC same-module guard)
--   3. suffix-coherent: every member's trailing Jr/Sr/II/III/IV token
--      (or absence thereof) matches every other member's
--
-- Tier-2 (skipped, logged for manual review):
--   • cross-module clusters
--   • suffix-mismatched clusters (Jr+nothing, Sr+nothing, etc.)
--
-- Idempotent: merges destroy the cluster, re-running becomes a no-op.
--
-- Actor: omnivurse@gmail.com (profiles.id = c74f79a4…). The merge_crm_records
-- RPC checks profiles.id = p_user_id (NOT auth.user_id), confirmed by
-- live `pg_proc` introspection on 2026-04-29.
-- =============================================================================

SET LOCAL statement_timeout = 0;

DO $outer$
DECLARE
  v_actor   CONSTANT uuid := 'c74f79a4-7f73-4977-90de-62ddd8c89250';
  v_org     CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  cluster   record;
  dup_id    uuid;
  v_total_clusters     int := 0;
  v_processed          int := 0;
  v_merges             int := 0;
  v_skipped_suffix     int := 0;
  v_skipped_stale      int := 0;
  v_skipped_xmodule    int := 0;
  v_errors             int := 0;
  v_merge_result       jsonb;
BEGIN
  -- Sanity: actor's profile.id resolves to PIFH (the RPC checks profiles.id
  -- not user_id; verified live via pg_proc).
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_actor AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION '[merge] actor profile.id % is not on PIFH org %', v_actor, v_org;
  END IF;

  -- Materialize cluster snapshot. The audit view aggregates from crm_records
  -- which we're about to mutate — a temp table guarantees a stable iterator.
  CREATE TEMP TABLE _merge_clusters ON COMMIT DROP AS
  SELECT
    keeper_id_oldest,
    duplicate_ids,
    rule,
    titles,
    module_ids,
    member_count,
    coalesce(min_name_similarity, 0) AS min_name_similarity,
    row_number() OVER (
      ORDER BY
        CASE WHEN rule = 'email' THEN 0 ELSE 1 END,
        member_count DESC,
        keeper_id_oldest
    ) AS process_order
  FROM public.crm_duplicate_audit
  WHERE org_id = v_org
    AND (
      rule = 'email'
      OR (rule = 'phone+name' AND coalesce(min_name_similarity, 0) >= 0.5)
    );

  SELECT count(*) INTO v_total_clusters FROM _merge_clusters;
  RAISE NOTICE '[merge] starting. clusters_to_process=%', v_total_clusters;

  FOR cluster IN
    SELECT * FROM _merge_clusters ORDER BY process_order
  LOOP
    v_processed := v_processed + 1;

    -- Tier-2 skip: cross-module clusters (RPC rejects them).
    IF (SELECT count(DISTINCT m) FROM unnest(cluster.module_ids) m) > 1 THEN
      v_skipped_xmodule := v_skipped_xmodule + 1;
      RAISE NOTICE '[merge] skip cross-module cluster: rule=% titles=% modules=%',
        cluster.rule, cluster.titles, cluster.module_ids;
      CONTINUE;
    END IF;

    -- Tier-2 skip: generational-suffix mismatch within cluster.
    -- Captures Jr / Jr. / Sr / Sr. / II / III / IV at end of title (case-insens).
    IF cluster.rule = 'phone+name' AND (
      SELECT count(DISTINCT coalesce(
        lower((regexp_match(btrim(t), '(?i)(?:^|[\s,])(jr\.?|sr\.?|ii|iii|iv)\s*$'))[1]),
        ''
      ))
      FROM unnest(cluster.titles) t
    ) > 1 THEN
      v_skipped_suffix := v_skipped_suffix + 1;
      RAISE NOTICE '[merge] skip suffix-mismatch: %', cluster.titles;
      CONTINUE;
    END IF;

    -- Keeper may have been merged in an earlier cluster (cross-rule overlap).
    IF NOT EXISTS (SELECT 1 FROM public.crm_records WHERE id = cluster.keeper_id_oldest) THEN
      v_skipped_stale := v_skipped_stale + 1;
      CONTINUE;
    END IF;

    FOREACH dup_id IN ARRAY cluster.duplicate_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.crm_records WHERE id = dup_id) THEN
        v_skipped_stale := v_skipped_stale + 1;
        CONTINUE;
      END IF;

      BEGIN
        SELECT public.merge_crm_records(
          p_keeper_id    => cluster.keeper_id_oldest,
          p_duplicate_id => dup_id,
          p_user_id      => v_actor
        ) INTO v_merge_result;

        IF (v_merge_result->>'success')::boolean IS TRUE THEN
          v_merges := v_merges + 1;
        ELSE
          v_errors := v_errors + 1;
          RAISE NOTICE '[merge] keeper=% dup=% returned %',
            cluster.keeper_id_oldest, dup_id, v_merge_result;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE '[merge] keeper=% dup=% raised %: %',
          cluster.keeper_id_oldest, dup_id, SQLSTATE, SQLERRM;
      END;

      IF v_merges % 50 = 0 AND v_merges > 0 THEN
        RAISE NOTICE '[merge] progress: % merges done (cluster %/%)',
          v_merges, v_processed, v_total_clusters;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[merge] DONE. clusters=% merges=% skipped_xmodule=% skipped_suffix=% skipped_stale=% errors=%',
    v_total_clusters, v_merges, v_skipped_xmodule, v_skipped_suffix, v_skipped_stale, v_errors;
END $outer$;
