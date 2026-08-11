-- Strict assert: healthshare contacts must not look blank in canonical HS keys
-- while legacy Zoho keys still hold the values.
--
-- Known major-medical carriers on market_type=healthshare are excluded from the
-- sharing_entity check (they map to health_insurance_carrier, not ministry).
--
-- Expected after backfill_healthshare_canonical_keys: all zero.

DO $$
DECLARE
  e123_drift bigint;
  start_drift bigint;
  contrib_drift bigint;
  ministry_entity_drift bigint;
BEGIN
  SELECT
    count(*) FILTER (
      WHERE public._crm_jsonb_value_is_blank(c.data -> 'sharing_member_id')
        AND NOT public._crm_jsonb_value_is_blank(
          COALESCE(c.data -> 'e123_member_id', c.data -> 'member_number')
        )
    ),
    count(*) FILTER (
      WHERE public._crm_jsonb_value_is_blank(c.data -> 'sharing_effective_date')
        AND NOT public._crm_jsonb_value_is_blank(c.data -> 'start_date')
    ),
    count(*) FILTER (
      WHERE public._crm_jsonb_value_is_blank(c.data -> 'monthly_contribution')
        AND public._crm_jsonb_value_is_blank(c.data -> 'monthly_share')
        AND public._crm_jsonb_value_is_blank(c.data -> 'share_amount')
        AND NOT public._crm_jsonb_value_is_blank(c.data -> 'monthly_premium')
        AND public._crm_jsonb_value_is_blank(c.data -> 'health_insurance_premium')
        AND public._crm_jsonb_value_is_blank(c.data -> 'insurance_premium')
    ),
    count(*) FILTER (
      WHERE public._crm_jsonb_value_is_blank(c.data -> 'sharing_entity')
        AND NOT public._crm_jsonb_value_is_blank(c.data -> 'carrier')
        AND lower(trim(c.data->>'carrier')) NOT IN (
          'anthem','cigna','kaiser','unitedhealthcare','united healthcare','aetna','humana',
          'blue cross','oscar','molina','centene/ambetter','florida blue','select health','rmhp'
        )
    )
  INTO e123_drift, start_drift, contrib_drift, ministry_entity_drift
  FROM public.crm_records c
  JOIN public.crm_modules m ON m.id = c.module_id
  WHERE m.key = 'contacts'
    AND c.deleted_at IS NULL
    AND c.market_type = 'healthshare';

  RAISE NOTICE 'hs_canonical_drift: member_id=% effective=% contribution=% ministry_entity=%',
    e123_drift, start_drift, contrib_drift, ministry_entity_drift;

  IF e123_drift > 0 OR start_drift > 0 OR contrib_drift > 0 OR ministry_entity_drift > 0 THEN
    RAISE EXCEPTION
      'hs_canonical_drift: non-zero drift (member_id=%, effective=%, contribution=%, ministry_entity=%)',
      e123_drift, start_drift, contrib_drift, ministry_entity_drift;
  END IF;
END $$;
