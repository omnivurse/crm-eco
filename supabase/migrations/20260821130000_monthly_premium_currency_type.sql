-- PIFH configuration-only (crm_fields rows; NO record data / JSONB touched).
--
-- contacts.monthly_premium is typed `number` while its health-sharing sibling
-- monthly_contribution is `currency`, so the same kind of amount renders two
-- different ways — "281.19" next to "$269.00". Both hold dollars.
--
-- Safe against the live values: of 1,000 sampled monthly_premium values, 998
-- parse as numbers and the other 2 are empty strings. Empty never reaches the
-- currency formatter — FieldRenderer returns an em dash for null/undefined/''
-- before the type switch — so blanks keep rendering as "—" rather than
-- becoming "$0.00".
--
-- `currency` is an accepted value of crm_fields_type_check and is handled by
-- FieldRenderer, DynamicRecordForm, InlineFieldCell and RecordTable.
--
-- Rollback:
--   UPDATE public.crm_fields SET type = 'number', updated_at = now()
--    WHERE module_id = (SELECT id FROM public.crm_modules
--                        WHERE org_id = '00000000-0000-0000-0000-000000000001'
--                          AND key = 'contacts' LIMIT 1)
--      AND key = 'monthly_premium' AND type = 'currency';

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
    RAISE EXCEPTION 'contacts module not found for org % — refusing to no-op silently', v_org;
  END IF;

  UPDATE public.crm_fields
     SET type = 'currency', updated_at = now()
   WHERE module_id = v_contacts
     AND key = 'monthly_premium'
     AND type IN ('number', 'currency');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'contacts.monthly_premium type -> currency: % row(s)', v_n;
END $$;
