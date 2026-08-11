-- ============================================================================
-- Backfill: Zoho legacy coverage keys → canonical Health Share form keys
-- ----------------------------------------------------------------------------
-- Read-path bridges already project these for the CRM UI. This migration makes
-- the DB permanently match so reports, saves, and list filters stay correct.
--
-- Rules (idempotent, never overwrite non-blank canonical):
--   * contacts + members only
--   * market_type = 'healthshare' OR (unknown/blank market + HS signals)
--   * traditional_insurance / health_insurance rows are NEVER touched for HS keys
--   * sharing_entity filled from ministry `carrier` only (not known insurers)
--
-- Rollback: restore from crm_records_hs_canonical_backfill_20260811 backup table
-- (created below) or re-run is a no-op once canonical keys are populated.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_records_hs_canonical_backfill_20260811 (
  record_id uuid PRIMARY KEY,
  organization_id uuid,
  market_type text,
  data_before jsonb NOT NULL,
  data_patch jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_insurance_carriers text[] := ARRAY[
    'anthem','cigna','kaiser','unitedhealthcare','united healthcare','aetna','humana',
    'blue cross','oscar','molina','centene/ambetter','florida blue','select health','rmhp'
  ];
  v_count integer;
BEGIN
  -- Snapshot rows we are about to change (once).
  INSERT INTO public.crm_records_hs_canonical_backfill_20260811 (
    record_id, organization_id, market_type, data_before, data_patch
  )
  SELECT
    c.id,
    c.organization_id,
    c.market_type,
    c.data,
    jsonb_strip_nulls(jsonb_build_object(
      'sharing_member_id', CASE
        WHEN public._crm_jsonb_value_is_blank(c.data -> 'sharing_member_id')
          AND NOT public._crm_jsonb_value_is_blank(
            COALESCE(c.data -> 'e123_member_id', c.data -> 'member_number')
          )
        THEN to_jsonb(COALESCE(c.data->>'e123_member_id', c.data->>'member_number'))
        ELSE NULL
      END,
      'sharing_effective_date', CASE
        WHEN public._crm_jsonb_value_is_blank(c.data -> 'sharing_effective_date')
          AND NOT public._crm_jsonb_value_is_blank(
            COALESCE(c.data -> 'start_date', to_jsonb(c.original_start_date::text))
          )
        THEN to_jsonb(COALESCE(c.data->>'start_date', c.original_start_date::text))
        ELSE NULL
      END,
      'monthly_contribution', CASE
        WHEN public._crm_jsonb_value_is_blank(c.data -> 'monthly_contribution')
          AND public._crm_jsonb_value_is_blank(c.data -> 'monthly_share')
          AND public._crm_jsonb_value_is_blank(c.data -> 'share_amount')
          AND public._crm_jsonb_value_is_blank(c.data -> 'health_insurance_premium')
          AND public._crm_jsonb_value_is_blank(c.data -> 'insurance_premium')
          AND NOT public._crm_jsonb_value_is_blank(c.data -> 'monthly_premium')
        THEN c.data -> 'monthly_premium'
        WHEN public._crm_jsonb_value_is_blank(c.data -> 'monthly_contribution')
          AND NOT public._crm_jsonb_value_is_blank(c.data -> 'monthly_share')
        THEN c.data -> 'monthly_share'
        WHEN public._crm_jsonb_value_is_blank(c.data -> 'monthly_contribution')
          AND NOT public._crm_jsonb_value_is_blank(c.data -> 'share_amount')
        THEN c.data -> 'share_amount'
        ELSE NULL
      END,
      'sharing_status', CASE
        WHEN public._crm_jsonb_value_is_blank(c.data -> 'sharing_status')
          AND NOT public._crm_jsonb_value_is_blank(c.data -> 'contact_status')
        THEN c.data -> 'contact_status'
        ELSE NULL
      END,
      'sharing_entity', CASE
        WHEN public._crm_jsonb_value_is_blank(c.data -> 'sharing_entity')
          AND NOT public._crm_jsonb_value_is_blank(c.data -> 'carrier')
          AND lower(trim(c.data->>'carrier')) <> ALL (v_insurance_carriers)
        THEN c.data -> 'carrier'
        ELSE NULL
      END
    )) AS data_patch
  FROM public.crm_records c
  JOIN public.crm_modules m ON m.id = c.module_id
  WHERE m.key IN ('contacts', 'members')
    AND c.deleted_at IS NULL
    AND (
      c.market_type = 'healthshare'
      OR (
        (c.market_type IS NULL OR c.market_type IN ('unknown', ''))
        AND (
          NOT public._crm_jsonb_value_is_blank(c.data -> 'iua_amount')
          OR NOT public._crm_jsonb_value_is_blank(c.data -> 'sharing_entity')
          OR NOT public._crm_jsonb_value_is_blank(c.data -> 'member_tier')
        )
      )
    )
    AND c.market_type IS DISTINCT FROM 'traditional_insurance'
    AND c.market_type IS DISTINCT FROM 'health_insurance'
    AND c.market_type IS DISTINCT FROM 'insurance'
  ON CONFLICT (record_id) DO NOTHING;

  UPDATE public.crm_records c
  SET
    data = c.data || b.data_patch,
    updated_at = now()
  FROM public.crm_records_hs_canonical_backfill_20260811 b
  WHERE c.id = b.record_id
    AND b.data_patch <> '{}'::jsonb
    AND (
      -- Only apply keys still blank (safe if partially applied)
      (b.data_patch ? 'sharing_member_id' AND public._crm_jsonb_value_is_blank(c.data -> 'sharing_member_id'))
      OR (b.data_patch ? 'sharing_effective_date' AND public._crm_jsonb_value_is_blank(c.data -> 'sharing_effective_date'))
      OR (b.data_patch ? 'monthly_contribution' AND public._crm_jsonb_value_is_blank(c.data -> 'monthly_contribution'))
      OR (b.data_patch ? 'sharing_status' AND public._crm_jsonb_value_is_blank(c.data -> 'sharing_status'))
      OR (b.data_patch ? 'sharing_entity' AND public._crm_jsonb_value_is_blank(c.data -> 'sharing_entity'))
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'backfill_healthshare_canonical_keys: updated % record(s)', v_count;

  -- Known insurers left on market_type=healthshare must surface on the insurance
  -- carrier field (never as Sharing Entity). Idempotent fill when blank.
  UPDATE public.crm_records c
  SET
    data = c.data || jsonb_build_object('health_insurance_carrier', c.data->>'carrier'),
    updated_at = now()
  FROM public.crm_modules m
  WHERE m.id = c.module_id
    AND m.key IN ('contacts', 'members')
    AND c.deleted_at IS NULL
    AND c.market_type = 'healthshare'
    AND public._crm_jsonb_value_is_blank(c.data -> 'health_insurance_carrier')
    AND NOT public._crm_jsonb_value_is_blank(c.data -> 'carrier')
    AND lower(trim(c.data->>'carrier')) = ANY (v_insurance_carriers);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'backfill_healthshare_canonical_keys: health_insurance_carrier filled on % record(s)', v_count;
END $$;
