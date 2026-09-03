-- Strict assert: no contacts/members row may still carry a Health Share value
-- under a legacy Zoho / E123 key while the canonical form key sits blank.
--
-- The counts come from public.crm_healthshare_canonical_drift(), which is built
-- on the same projector as the write-path trigger
-- (crm_2_healthshare_canonical_trg) and the backfill — so this assertion cannot
-- disagree with either. Insurer-vs-ministry classification lives only in
-- public._crm_carrier_is_insurance (mirrors coverage-carriers.ts); known
-- major-medical carriers route to health_insurance_carrier, never sharing_entity.
--
-- Expected: all zero. Repair with
--   SELECT * FROM public.backfill_healthshare_canonical_keys();

DO $$
DECLARE
  d record;
  total bigint := 0;
BEGIN
  FOR d IN SELECT * FROM public.crm_healthshare_canonical_drift() LOOP
    RAISE NOTICE 'hs_canonical_drift[%]: member_id=% effective=% contribution=% status=% sharing_entity=% insurance_carrier=% rows=%',
      d.module_key, d.member_id_drift, d.effective_drift, d.contribution_drift,
      d.status_drift, d.sharing_entity_drift, d.insurance_carrier_drift, d.rows_needing_patch;
    total := total + d.rows_needing_patch;
  END LOOP;

  IF total > 0 THEN
    RAISE EXCEPTION
      'hs_canonical_drift: % row(s) still need canonical projection — run SELECT * FROM public.backfill_healthshare_canonical_keys(); and verify crm_2_healthshare_canonical_trg is enabled',
      total;
  END IF;

  RAISE NOTICE 'hs_canonical_drift: clean';
END $$;
