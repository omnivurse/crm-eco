-- PIFH configuration-only (crm_fields rows; NO record data / JSONB touched).
--
-- contacts has TWO fields both labelled "Monthly Contribution":
--     monthly_contribution  currency  section health_sharing
--     monthly_premium       number    section insurance      <-- mislabelled
--
-- They are different things. Verified against live data:
--   traditional_insurance contacts → monthly_premium 684, monthly_contribution 1
--   healthshare contacts           → both populated on 9,719 records, and in a
--                                    800-record sample 799 held the IDENTICAL
--                                    value (monthly_premium is a redundant copy
--                                    left by the Zoho migration).
--
-- So premium belongs to insurance and contribution to health sharing, and the
-- duplicate label is what made a record appear to show one amount twice — the
-- "one contribution amount" item from the data-trust plan.
--
-- Label only. No record data is read or written, and monthly_premium keeps its
-- values on healthshare records (they are simply named correctly now).
--
-- Rollback:
--   UPDATE public.crm_fields SET label = 'Monthly Contribution', updated_at = now()
--    WHERE module_id = (SELECT id FROM public.crm_modules
--                        WHERE org_id = '00000000-0000-0000-0000-000000000001'
--                          AND key = 'contacts' LIMIT 1)
--      AND key = 'monthly_premium' AND label = 'Monthly Premium';

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org      uuid := '00000000-0000-0000-0000-000000000001';
  v_contacts uuid;
  v_n        int;
BEGIN
  SELECT id INTO v_contacts FROM public.crm_modules
   WHERE org_id = v_org AND key = 'contacts' LIMIT 1;

  IF v_contacts IS NULL THEN
    RAISE NOTICE 'contacts module not found — skipped';
    RETURN;
  END IF;

  UPDATE public.crm_fields
     SET label = 'Monthly Premium', updated_at = now()
   WHERE module_id = v_contacts
     AND key = 'monthly_premium'
     AND label IN ('Monthly Contribution', 'Monthly Premium');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'contacts.monthly_premium label: % row(s)', v_n;
END $$;
