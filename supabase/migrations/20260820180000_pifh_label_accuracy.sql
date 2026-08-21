-- PIFH configuration-only (crm_fields rows; NO record data / JSONB touched).
--
-- Correcting 20260820120000. That migration relabelled contacts.product and
-- leads.product_type to 'Health Sharing Membership' on the assumption the
-- field names a membership. It does not — it holds a product CATEGORY, and a
-- large slice of that category is the opposite of the label. Counts over live
-- non-deleted records at the time of writing:
--
--     contacts.product      = 'Health Insurance'   →   848
--     contacts.product      = 'Health Sharing'     → 1,951
--     leads.product_type    = 'Health Insurance'   →    59
--     leads.product_type    = 'Health Sharing'     →   703
--     (plus 'Secure HSA', 'MPowering Direct', 'To Be Determined', …)
--
-- So 907 live records were rendering a row that read
--     "Health Sharing Membership: Health Insurance"
-- which is worse than the empty "Plan" it replaced: the original problem was
-- a field that looked blank, and this made a filled field look wrong. A label
-- has to be true for every value the field can hold, so it names the field
-- rather than one of its values.
--
-- Also brings the members module in line: 20260820120000 scoped the
-- health_insurance_plan_name relabel to contacts + leads, leaving members
-- showing 'Plan name' for the same key inside the same tenant.
--
-- Rollback:
--   UPDATE public.crm_fields SET label = 'Health Sharing Membership', updated_at = now()
--    WHERE module_id = (SELECT id FROM public.crm_modules WHERE org_id = '00000000-0000-0000-0000-000000000001' AND key = 'contacts' LIMIT 1)
--      AND key = 'product' AND label = 'Membership / Plan';
--   UPDATE public.crm_fields SET label = 'Health Sharing Membership', updated_at = now()
--    WHERE module_id = (SELECT id FROM public.crm_modules WHERE org_id = '00000000-0000-0000-0000-000000000001' AND key = 'leads' LIMIT 1)
--      AND key = 'product_type' AND label = 'Membership / Plan';
--   UPDATE public.crm_fields SET label = 'Plan name', updated_at = now()
--    WHERE module_id = (SELECT id FROM public.crm_modules WHERE org_id = '00000000-0000-0000-0000-000000000001' AND key = 'members' LIMIT 1)
--      AND key = 'health_insurance_plan_name' AND label = 'Health Insurance Plan';

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org      uuid := '00000000-0000-0000-0000-000000000001';
  v_leads    uuid;
  v_contacts uuid;
  v_members  uuid;
  v_n        int;
BEGIN
  SELECT id INTO v_leads    FROM public.crm_modules WHERE org_id = v_org AND key = 'leads'    LIMIT 1;
  SELECT id INTO v_contacts FROM public.crm_modules WHERE org_id = v_org AND key = 'contacts' LIMIT 1;
  SELECT id INTO v_members  FROM public.crm_modules WHERE org_id = v_org AND key = 'members'  LIMIT 1;

  -- Value-neutral label: true whether the record holds Health Sharing,
  -- Health Insurance, Secure HSA or To Be Determined.
  IF v_contacts IS NOT NULL THEN
    UPDATE public.crm_fields
       SET label = 'Membership / Plan', updated_at = now()
     WHERE module_id = v_contacts
       AND key = 'product'
       AND label IN ('Health Sharing Membership', 'Product', 'Plan');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'contacts.product label: % row(s)', v_n;
  END IF;

  IF v_leads IS NOT NULL THEN
    UPDATE public.crm_fields
       SET label = 'Membership / Plan', updated_at = now()
     WHERE module_id = v_leads
       AND key = 'product_type'
       AND label IN ('Health Sharing Membership', 'Product Type', 'Plan');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'leads.product_type label: % row(s)', v_n;
  END IF;

  -- Same key, same tenant, same label.
  IF v_members IS NOT NULL THEN
    UPDATE public.crm_fields
       SET label = 'Health Insurance Plan', updated_at = now()
     WHERE module_id = v_members
       AND key = 'health_insurance_plan_name'
       AND label IN ('Plan name', 'Plan Name');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'members.health_insurance_plan_name label: % row(s)', v_n;
  END IF;
END $$;
