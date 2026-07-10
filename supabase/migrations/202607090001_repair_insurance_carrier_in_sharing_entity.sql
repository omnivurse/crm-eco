-- ============================================================================
-- Repair: insurance carriers mis-filed in the health-share `sharing_entity`
-- ----------------------------------------------------------------------------
-- A read-path bridge (bridgeLegacyCarrierToSharingEntity) used to copy the
-- generic `carrier` value into `sharing_entity` on contacts/members. For
-- health-INSURANCE members that shoved an insurer (e.g. "Cigna") into the
-- health-SHARE "Sharing Entity" field, so the Membership Snapshot showed
-- "SHARING ENTITY: Cigna". The bridge is now fixed to route recognized
-- insurers to `health_insurance_carrier`; this one-time migration repairs the
-- records that already persisted the mixed value.
--
-- Scope is deliberately narrow and safe:
--   * contacts / members only
--   * `sharing_entity` matches a KNOWN insurance carrier name (never a UUID,
--     never a ministry, never a hand-typed unknown)
--   * `health_insurance_carrier` is still blank (don't clobber real data)
--   * the record has NO other genuine health-sharing data — so we know it's an
--     insurance record, not a sharing member who also mistyped a carrier
--
-- For matches: move the value into `health_insurance_carrier`, drop it from
-- `sharing_entity`, and flip `market_type` healthshare -> health_insurance.
-- Idempotent: a second run matches nothing.
-- ============================================================================

DO $$
DECLARE
  -- Mirrors crm_fields.options for health_insurance_carrier (lowercased).
  v_insurance_carriers text[] := ARRAY[
    'anthem','cigna','kaiser','unitedhealthcare','aetna','humana','blue cross',
    'oscar','molina','centene/ambetter','florida blue','select health','rmhp'
  ];
  -- Every health-sharing key EXCEPT sharing_entity; any populated one means the
  -- record is a real sharing member and must be left untouched.
  v_other_sharing_keys text[] := ARRAY[
    'member_tier','monthly_contribution','iua_amount','sharing_effective_date',
    'sharing_end_date','sharing_status','sharing_member_id','previous_membership'
  ];
  v_count integer;
BEGIN
  WITH targets AS (
    SELECT c.id, c.data->>'sharing_entity' AS carrier_value
    FROM public.crm_records c
    JOIN public.crm_modules m ON m.id = c.module_id
    WHERE m.key IN ('contacts', 'members')
      AND lower(trim(c.data->>'sharing_entity')) = ANY (v_insurance_carriers)
      AND public._crm_jsonb_value_is_blank(c.data -> 'health_insurance_carrier')
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(v_other_sharing_keys) AS k
        WHERE NOT public._crm_jsonb_value_is_blank(c.data -> k)
      )
  )
  UPDATE public.crm_records c
  SET data = (c.data - 'sharing_entity')
             || jsonb_build_object('health_insurance_carrier', t.carrier_value),
      market_type = CASE
        WHEN c.market_type = 'healthshare' THEN 'health_insurance'
        ELSE c.market_type
      END,
      updated_at = now()
  FROM targets t
  WHERE c.id = t.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'repair_insurance_carrier_in_sharing_entity: moved % record(s) to health_insurance_carrier', v_count;
END $$;
