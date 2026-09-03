-- ============================================================================
-- Health Share canonical keys: one projector, enforced on the write path
-- ----------------------------------------------------------------------------
-- WHY
-- `20260811140000_backfill_healthshare_canonical_keys` was a ONE-TIME DO block
-- that snapshotted matching rows into
-- `crm_records_hs_canonical_backfill_20260811` and then UPDATEd by joining that
-- snapshot. Rows that became health-share AFTER it ran are therefore never
-- reachable by a re-run, and nothing on the write path fills canonical keys.
--
-- The enrollment sync is the live leak: `sync_member_to_crm()` writes
-- `member_number` / `start_date` / `contact_status` onto the contacts twin and
-- `sync_member_to_crm_records()` writes `member_number` / `start_date` /
-- `monthly_share` onto the members row — neither writes `sharing_member_id`,
-- `sharing_effective_date`, `monthly_contribution` or `sharing_status`. So every
-- new health-share enrollment re-introduces canonical drift and the strict CI
-- audit (`scripts/db-audit-crm-integrity-strict.sql`) fails again on the next
-- run, which is exactly the 20-consecutive-failure pattern on main.
--
-- WHAT
--   1. `_crm_carrier_norm` / `_crm_carrier_is_insurance` — single SQL source of
--      truth for insurer-vs-ministry, mirroring `coverage-carriers.ts`. Replaces
--      the hardcoded 13-name list copy-pasted into three SQL sites.
--   2. `crm_healthshare_canonical_patch` — THE projector. Pure, blank-only,
--      never overwrites. Mirrors `bridgeLegacyHealthSharingReadPaths` +
--      `bridgeLegacyCarrierToSharingEntity`.
--   3. `crm_2_healthshare_canonical_trg` — BEFORE INSERT/UPDATE on crm_records
--      applies the patch, so no write path can persist drift again.
--   4. `backfill_healthshare_canonical_keys()` — repeatable, batched, snapshot
--      independent. Replaces the un-rerunnable 2026-08-11 DO block.
--   5. `crm_healthshare_canonical_drift()` — the audit reads the SAME patch
--      function, so the assertion and the projector can never disagree.
--
-- Additive and reversible: no column/row is dropped, every fill is blank-only,
-- and pre-change values are snapshotted into
-- `crm_records_hs_canonical_backfill_log` for rollback. See "ROLLBACK" at the
-- bottom of this file.
-- ============================================================================

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Carrier classification — mirrors apps/crm/src/lib/crm/coverage-carriers.ts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._crm_carrier_norm(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT regexp_replace(lower(btrim(coalesce(v, ''))), '[^a-z0-9]+', '', 'g');
$$;

COMMENT ON FUNCTION public._crm_carrier_norm(text) IS
  'Collapse case/whitespace/punctuation so free-text carrier variants match canonical lists. Mirrors normalizeCarrierMatchKey in coverage-carriers.ts.';

CREATE OR REPLACE FUNCTION public._crm_carrier_is_insurance(v text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  -- Normalized mirrors of KNOWN_INSURANCE_CARRIERS / KNOWN_SHARING_ENTITIES /
  -- INSURANCE_STEMS in coverage-carriers.ts. Keep the two in sync.
  v_exact_insurance text[] := ARRAY[
    'anthem','cigna','kaiser','unitedhealthcare','aetna','humana','bluecross',
    'oscar','molina','centeneambetter','floridablue','selecthealth','rmhp',
    'brighthealth','brighthealthcare'
  ];
  v_exact_sharing text[] := ARRAY[
    'sedera','zionhealth','mpb','knewhealth','altrua','impact','oneshare','solidarity'
  ];
  v_stems text[] := ARRAY[
    'bcbs','bluecross','blueshield','anthem','cigna','aetna','humana','kaiser',
    'unitedhealth','molina','ambetter','centene','coventry','oscar',
    'brighthealth','floridablue','selecthealth','rmhp','healthop'
  ];
  v_norm text := public._crm_carrier_norm(v);
  v_stem text;
BEGIN
  IF v_norm = '' THEN
    RETURN false;
  END IF;
  IF v_norm = ANY (v_exact_insurance) THEN
    RETURN true;
  END IF;
  -- Never claim a value the ministry list owns exactly.
  IF v_norm = ANY (v_exact_sharing) THEN
    RETURN false;
  END IF;
  FOREACH v_stem IN ARRAY v_stems LOOP
    IF position(v_stem IN v_norm) > 0 THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public._crm_carrier_is_insurance(text) IS
  'True when a legacy `carrier` value is a major-medical insurer (belongs on health_insurance_carrier, never sharing_entity). Mirrors isKnownInsuranceCarrier in coverage-carriers.ts.';

-- ---------------------------------------------------------------------------
-- 2. Small jsonb helper: first non-blank of an ordered alias list
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._crm_jsonb_first_non_blank(VARIADIC vals jsonb[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v jsonb;
BEGIN
  IF vals IS NULL THEN
    RETURN NULL;
  END IF;
  FOREACH v IN ARRAY vals LOOP
    IF NOT public._crm_jsonb_value_is_blank(v) THEN
      RETURN v;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. THE projector — legacy Zoho / E123 keys → canonical Health Share keys
-- ---------------------------------------------------------------------------
-- Returns ONLY the keys that are currently blank and recoverable, so it is
-- idempotent: applying the result then re-running yields '{}'.
--
-- Market gating mirrors shouldProjectHealthSharingLegacyFields — traditional
-- insurance rows are never given a health-share shape.

CREATE OR REPLACE FUNCTION public.crm_healthshare_canonical_patch(
  p_data                jsonb,
  p_market_type         text,
  p_module_key          text,
  p_original_start_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_patch jsonb := '{}'::jsonb;
  v_val   jsonb;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;
  IF p_module_key IS NULL OR p_module_key NOT IN ('contacts', 'members') THEN
    RETURN '{}'::jsonb;
  END IF;
  IF coalesce(p_market_type, '') IN ('traditional_insurance', 'health_insurance', 'insurance') THEN
    RETURN '{}'::jsonb;
  END IF;
  -- Unknown / blank market: only project when clear health-share signals exist.
  IF coalesce(p_market_type, '') <> 'healthshare'
     AND public._crm_jsonb_value_is_blank(p_data -> 'iua_amount')
     AND public._crm_jsonb_value_is_blank(p_data -> 'sharing_entity')
     AND public._crm_jsonb_value_is_blank(p_data -> 'member_tier')
     AND public._crm_jsonb_value_is_blank(p_data -> 'sharing_member_id')
  THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Member id: Zoho `e123_member_id`, E123 `member_number`.
  IF public._crm_jsonb_value_is_blank(p_data -> 'sharing_member_id') THEN
    v_val := public._crm_jsonb_first_non_blank(
      p_data -> 'e123_member_id',
      p_data -> 'member_number'
    );
    IF v_val IS NOT NULL THEN
      v_patch := v_patch || jsonb_build_object('sharing_member_id', v_val);
    END IF;
  END IF;

  -- Effective date: Zoho `start_date`, then the indexed original_start_date.
  IF public._crm_jsonb_value_is_blank(p_data -> 'sharing_effective_date') THEN
    v_val := public._crm_jsonb_first_non_blank(
      p_data -> 'start_date',
      p_data -> 'original_start_date',
      CASE WHEN p_original_start_date IS NULL THEN NULL ELSE to_jsonb(p_original_start_date::text) END
    );
    IF v_val IS NOT NULL THEN
      v_patch := v_patch || jsonb_build_object('sharing_effective_date', v_val);
    END IF;
  END IF;

  -- Contribution: dedicated share keys first. Overloaded `monthly_premium`
  -- only counts on a health-share row with no dedicated insurance premium
  -- sibling (those rows are dual-coverage and keep premium separate).
  IF public._crm_jsonb_value_is_blank(p_data -> 'monthly_contribution') THEN
    v_val := public._crm_jsonb_first_non_blank(
      p_data -> 'monthly_share',
      p_data -> 'share_amount'
    );
    IF v_val IS NULL
       AND coalesce(p_market_type, '') = 'healthshare'
       AND NOT public._crm_jsonb_value_is_blank(p_data -> 'monthly_premium')
       AND public._crm_jsonb_value_is_blank(p_data -> 'health_insurance_premium')
       AND public._crm_jsonb_value_is_blank(p_data -> 'insurance_premium')
    THEN
      v_val := p_data -> 'monthly_premium';
    END IF;
    IF v_val IS NOT NULL THEN
      v_patch := v_patch || jsonb_build_object('monthly_contribution', v_val);
    END IF;
  END IF;

  -- Status: Health Share form field vs Zoho `contact_status`.
  IF public._crm_jsonb_value_is_blank(p_data -> 'sharing_status')
     AND NOT public._crm_jsonb_value_is_blank(p_data -> 'contact_status')
  THEN
    v_patch := v_patch || jsonb_build_object('sharing_status', p_data -> 'contact_status');
  END IF;

  -- Carrier routing: a recognized insurer belongs on health_insurance_carrier,
  -- anything else (ministry or hand-typed) falls through to sharing_entity.
  IF NOT public._crm_jsonb_value_is_blank(p_data -> 'carrier') THEN
    IF public._crm_carrier_is_insurance(p_data ->> 'carrier') THEN
      IF public._crm_jsonb_value_is_blank(p_data -> 'health_insurance_carrier') THEN
        v_patch := v_patch || jsonb_build_object('health_insurance_carrier', p_data -> 'carrier');
      END IF;
    ELSIF public._crm_jsonb_value_is_blank(p_data -> 'sharing_entity') THEN
      v_patch := v_patch || jsonb_build_object('sharing_entity', p_data -> 'carrier');
    END IF;
  END IF;

  RETURN v_patch;
END;
$$;

COMMENT ON FUNCTION public.crm_healthshare_canonical_patch(jsonb, text, text, date) IS
  'Single source of truth for legacy->canonical Health Share projection. Blank-only, never overwrites, idempotent. Used by the crm_records write trigger, backfill_healthshare_canonical_keys() and crm_healthshare_canonical_drift().';

-- ---------------------------------------------------------------------------
-- 4. Write-path guard — closes the enrollment-sync leak permanently
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crm_records_project_healthshare_canonical()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_module_key text;
  v_patch      jsonb;
BEGIN
  IF NEW.data IS NULL OR jsonb_typeof(NEW.data) <> 'object' THEN
    RETURN NEW;
  END IF;

  SELECT key INTO v_module_key FROM public.crm_modules WHERE id = NEW.module_id;
  IF v_module_key IS NULL OR v_module_key NOT IN ('contacts', 'members') THEN
    RETURN NEW;
  END IF;

  v_patch := public.crm_healthshare_canonical_patch(
    NEW.data, NEW.market_type, v_module_key, NEW.original_start_date
  );

  IF v_patch <> '{}'::jsonb THEN
    NEW.data := NEW.data || v_patch;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a member/contact write on a projection problem; the strict
  -- audit still catches anything this misses.
  RAISE WARNING 'crm_records_project_healthshare_canonical skipped for record %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_records_project_healthshare_canonical() FROM PUBLIC;

-- Fires after crm_0_status_guard_trg (which canonicalizes contact_status, the
-- source for sharing_status) and before the title / origin / stage triggers.
--
-- No pg_trigger_depth() guard: the enrollment sync writes crm_records from a
-- trigger on `members`, so this MUST fire at nested depth — that is the leak.
DROP TRIGGER IF EXISTS crm_2_healthshare_canonical_trg ON public.crm_records;
CREATE TRIGGER crm_2_healthshare_canonical_trg
  BEFORE INSERT OR UPDATE ON public.crm_records
  FOR EACH ROW
  WHEN (
    NEW.deleted_at IS NULL
    AND coalesce(NEW.market_type, '') NOT IN ('traditional_insurance', 'health_insurance', 'insurance')
  )
  EXECUTE FUNCTION public.crm_records_project_healthshare_canonical();

-- ---------------------------------------------------------------------------
-- 5. Repeatable backfill (replaces the un-rerunnable 2026-08-11 DO block)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.crm_records_hs_canonical_backfill_log (
  id              bigserial PRIMARY KEY,
  record_id       uuid NOT NULL,
  organization_id uuid,
  module_key      text,
  market_type     text,
  data_before     jsonb NOT NULL,
  data_patch      jsonb NOT NULL,
  run_id          uuid NOT NULL,
  applied_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_records_hs_canonical_backfill_log_record_idx
  ON public.crm_records_hs_canonical_backfill_log (record_id);
CREATE INDEX IF NOT EXISTS crm_records_hs_canonical_backfill_log_run_idx
  ON public.crm_records_hs_canonical_backfill_log (run_id);

ALTER TABLE public.crm_records_hs_canonical_backfill_log ENABLE ROW LEVEL SECURITY;
-- Ops/rollback artifact only: no policies, so anon/authenticated get nothing
-- and only service_role / definer functions can read it.
REVOKE ALL ON TABLE public.crm_records_hs_canonical_backfill_log FROM anon, authenticated;

COMMENT ON TABLE public.crm_records_hs_canonical_backfill_log IS
  'Rollback trail for backfill_healthshare_canonical_keys(): pre-change data plus the applied patch, one row per record per run.';

-- `crm_healthshare_canonical_drift()` (below) is the dry run: it reports exactly
-- what this function would fill, without writing. So this takes no dry-run flag.
CREATE OR REPLACE FUNCTION public.backfill_healthshare_canonical_keys(
  p_batch_size integer DEFAULT 500,
  p_max_rows   integer DEFAULT NULL
)
RETURNS TABLE (
  run_id                  uuid,
  records_changed         bigint,
  member_id_fills         bigint,
  effective_fills         bigint,
  contribution_fills      bigint,
  status_fills            bigint,
  sharing_entity_fills    bigint,
  insurance_carrier_fills bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_run_id uuid := gen_random_uuid();
  v_batch  bigint;
  v_total  bigint := 0;
  v_limit  integer;
BEGIN
  LOOP
    v_limit := greatest(coalesce(p_batch_size, 500), 1);
    IF p_max_rows IS NOT NULL THEN
      v_limit := least(v_limit, greatest(p_max_rows - v_total, 0))::integer;
      EXIT WHEN v_limit = 0;
    END IF;

    -- Re-evaluated each batch: an updated row no longer yields a patch, so the
    -- loop converges without a cursor or checkpoint column. Kill switch is
    -- p_max_rows; the whole call is one transaction per batch statement.
    WITH targets AS (
      SELECT
        c.id,
        c.organization_id,
        m.key AS module_key,
        c.market_type,
        c.data AS data_before,
        public.crm_healthshare_canonical_patch(c.data, c.market_type, m.key, c.original_start_date) AS patch
      FROM public.crm_records c
      JOIN public.crm_modules m ON m.id = c.module_id
      WHERE m.key IN ('contacts', 'members')
        AND c.deleted_at IS NULL
        AND public.crm_healthshare_canonical_patch(c.data, c.market_type, m.key, c.original_start_date) <> '{}'::jsonb
      ORDER BY c.id
      LIMIT v_limit
    ),
    logged AS (
      INSERT INTO public.crm_records_hs_canonical_backfill_log (
        record_id, organization_id, module_key, market_type, data_before, data_patch, run_id
      )
      SELECT t.id, t.organization_id, t.module_key, t.market_type, t.data_before, t.patch, v_run_id
      FROM targets t
      RETURNING record_id
    )
    UPDATE public.crm_records c
    SET data = c.data || t.patch
    FROM targets t
    WHERE c.id = t.id;

    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_total := v_total + coalesce(v_batch, 0);
    EXIT WHEN coalesce(v_batch, 0) = 0;
  END LOOP;

  RAISE NOTICE 'backfill_healthshare_canonical_keys: run % changed % record(s)', v_run_id, v_total;

  RETURN QUERY
  SELECT
    v_run_id,
    v_total,
    count(*) FILTER (WHERE l.data_patch ? 'sharing_member_id'),
    count(*) FILTER (WHERE l.data_patch ? 'sharing_effective_date'),
    count(*) FILTER (WHERE l.data_patch ? 'monthly_contribution'),
    count(*) FILTER (WHERE l.data_patch ? 'sharing_status'),
    count(*) FILTER (WHERE l.data_patch ? 'sharing_entity'),
    count(*) FILTER (WHERE l.data_patch ? 'health_insurance_carrier')
  FROM public.crm_records_hs_canonical_backfill_log l
  WHERE l.run_id = v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_healthshare_canonical_keys(integer, integer) FROM PUBLIC;

COMMENT ON FUNCTION public.backfill_healthshare_canonical_keys(integer, integer) IS
  'Idempotent, batched, re-runnable backfill of canonical Health Share keys on contacts/members. Snapshots pre-change data into crm_records_hs_canonical_backfill_log. Safe to re-run: converges to zero rows changed. p_max_rows is the kill switch.';

-- ---------------------------------------------------------------------------
-- 6. Drift reporter — the audit and the projector share one definition
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crm_healthshare_canonical_drift()
RETURNS TABLE (
  module_key              text,
  member_id_drift         bigint,
  effective_drift         bigint,
  contribution_drift      bigint,
  status_drift            bigint,
  sharing_entity_drift    bigint,
  insurance_carrier_drift bigint,
  rows_needing_patch      bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  WITH scoped AS (
    SELECT
      m.key AS module_key,
      public.crm_healthshare_canonical_patch(c.data, c.market_type, m.key, c.original_start_date) AS patch
    FROM public.crm_records c
    JOIN public.crm_modules m ON m.id = c.module_id
    WHERE m.key IN ('contacts', 'members')
      AND c.deleted_at IS NULL
  )
  SELECT
    module_key,
    count(*) FILTER (WHERE patch ? 'sharing_member_id'),
    count(*) FILTER (WHERE patch ? 'sharing_effective_date'),
    count(*) FILTER (WHERE patch ? 'monthly_contribution'),
    count(*) FILTER (WHERE patch ? 'sharing_status'),
    count(*) FILTER (WHERE patch ? 'sharing_entity'),
    count(*) FILTER (WHERE patch ? 'health_insurance_carrier'),
    count(*) FILTER (WHERE patch <> '{}'::jsonb)
  FROM scoped
  GROUP BY module_key
  ORDER BY module_key;
$$;

COMMENT ON FUNCTION public.crm_healthshare_canonical_drift() IS
  'Per-module count of rows the canonical Health Share projector would still fill. Expected all-zero: the write trigger prevents drift and backfill_healthshare_canonical_keys() clears history. Read by scripts/db-audit-crm-integrity-strict.sql.';

GRANT EXECUTE ON FUNCTION public.crm_healthshare_canonical_drift() TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Clear the accumulated drift
-- ---------------------------------------------------------------------------

-- Blast-radius guard: every fill lands on a blank key, but a widened predicate
-- would still be a mass rewrite of person records. On PIF-ECO-V2 this run
-- changes 5 rows (verified against live data). p_max_rows caps the run at the
-- ceiling; reaching it means the projector matched far more than expected, so
-- abort and roll the whole migration back rather than rewrite the table.
DO $$
DECLARE
  r record;
  v_ceiling constant integer := 200;
BEGIN
  SELECT * INTO r FROM public.backfill_healthshare_canonical_keys(500, v_ceiling);

  IF r.records_changed >= v_ceiling THEN
    RAISE EXCEPTION
      'healthshare canonical backfill hit the %-row safety ceiling — aborting. Inspect with SELECT * FROM public.crm_healthshare_canonical_drift(); raise the ceiling only once the scope is understood.',
      v_ceiling;
  END IF;

  RAISE NOTICE 'healthshare canonical backfill: run=% changed=% member_id=% effective=% contribution=% status=% sharing_entity=% insurance_carrier=%',
    r.run_id, r.records_changed, r.member_id_fills, r.effective_fills,
    r.contribution_fills, r.status_fills, r.sharing_entity_fills, r.insurance_carrier_fills;
END $$;

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- Undo the data changes of one run (keys are restored to their pre-run value,
-- which for a blank-only fill means removing the key):
--
--   UPDATE public.crm_records c
--   SET data = c.data || (l.data_before - (SELECT array_agg(k) FROM jsonb_object_keys(l.data_patch) k)::text[])
--   FROM public.crm_records_hs_canonical_backfill_log l
--   WHERE c.id = l.record_id AND l.run_id = '<run_id>';
--
-- Simpler and exact, since the backfill only ever ADDED keys:
--
--   UPDATE public.crm_records c
--   SET data = c.data - (SELECT array_agg(k)::text[] FROM jsonb_object_keys(l.data_patch) k)
--   FROM public.crm_records_hs_canonical_backfill_log l
--   WHERE c.id = l.record_id AND l.run_id = '<run_id>';
--
-- Disable the write-path guard without dropping anything:
--   ALTER TABLE public.crm_records DISABLE TRIGGER crm_2_healthshare_canonical_trg;
--
-- Full teardown:
--   DROP TRIGGER IF EXISTS crm_2_healthshare_canonical_trg ON public.crm_records;
--   DROP FUNCTION IF EXISTS public.crm_records_project_healthshare_canonical();
--   DROP FUNCTION IF EXISTS public.crm_healthshare_canonical_drift();
--   DROP FUNCTION IF EXISTS public.backfill_healthshare_canonical_keys(integer, integer);
--   DROP FUNCTION IF EXISTS public.crm_healthshare_canonical_patch(jsonb, text, text, date);
--   DROP FUNCTION IF EXISTS public._crm_jsonb_first_non_blank(jsonb[]);
--   DROP FUNCTION IF EXISTS public._crm_carrier_is_insurance(text);
--   DROP FUNCTION IF EXISTS public._crm_carrier_norm(text);
-- (`crm_records_hs_canonical_backfill_log` is intentionally kept as the trail.)
-- ============================================================================
