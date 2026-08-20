-- PIFH configuration-only (crm_fields rows; NO record data / JSONB keys touched).
-- NOT applied by the authoring agent — apply via `supabase db push` after review.
--
-- Goal:
--   (a) Leads: move normalized_advisor_name / normalized_agent_name out of the
--       open Ownership card into collapsed System, matching contacts
--       (20260817190000_pifh_members_view_columns_and_alias_labels.sql).
--       Live (org 00000000-0000-0000-0000-000000000001):
--         c513891d-ec91-4b32-b597-5a04ac8bff01  leads.normalized_advisor_name  management / 'Advisor'
--         3cd8d65e-f64b-4706-9cbc-17d7a81b0ef5  leads.normalized_agent_name    management / 'Agent'
--   (b) Labels only (keys unchanged):
--         health_insurance_plan_name  → 'Health Insurance Plan'  (contacts + leads)
--         contacts.product            → 'Health Sharing Membership'
--         leads.product_type          → 'Health Sharing Membership'
--
-- Rollback:
--   UPDATE public.crm_fields SET section = 'management', label = 'Advisor', updated_at = now()
--    WHERE module_id = (SELECT id FROM public.crm_modules WHERE org_id = '00000000-0000-0000-0000-000000000001' AND key = 'leads' LIMIT 1)
--      AND key = 'normalized_advisor_name';
--   UPDATE public.crm_fields SET section = 'management', label = 'Agent', updated_at = now()
--    WHERE module_id = (SELECT id FROM public.crm_modules WHERE org_id = '00000000-0000-0000-0000-000000000001' AND key = 'leads' LIMIT 1)
--      AND key = 'normalized_agent_name';
--   UPDATE public.crm_fields SET label = 'Plan name', updated_at = now()
--    WHERE module_id IN (SELECT id FROM public.crm_modules WHERE org_id = '00000000-0000-0000-0000-000000000001' AND key IN ('contacts', 'leads'))
--      AND key = 'health_insurance_plan_name' AND label = 'Health Insurance Plan';
--   UPDATE public.crm_fields SET label = 'Product', updated_at = now()
--    WHERE module_id = (SELECT id FROM public.crm_modules WHERE org_id = '00000000-0000-0000-0000-000000000001' AND key = 'contacts' LIMIT 1)
--      AND key = 'product' AND label = 'Health Sharing Membership';
--   UPDATE public.crm_fields SET label = 'Product Type', updated_at = now()
--    WHERE module_id = (SELECT id FROM public.crm_modules WHERE org_id = '00000000-0000-0000-0000-000000000001' AND key = 'leads' LIMIT 1)
--      AND key = 'product_type' AND label = 'Health Sharing Membership';

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org     uuid := '00000000-0000-0000-0000-000000000001';
  v_leads   uuid;
  v_contacts uuid;
  v_n       int;
BEGIN
  SELECT id INTO v_leads    FROM public.crm_modules WHERE org_id = v_org AND key = 'leads'    LIMIT 1;
  SELECT id INTO v_contacts FROM public.crm_modules WHERE org_id = v_org AND key = 'contacts' LIMIT 1;

  -- (a) Leads normalized names → System, labels disambiguated.
  IF v_leads IS NOT NULL THEN
    UPDATE public.crm_fields
       SET label = 'Advisor (system)', updated_at = now()
     WHERE module_id = v_leads
       AND key = 'normalized_advisor_name'
       AND label IN ('Advisor', 'Advisor (system)');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'leads.normalized_advisor_name label: % row(s)', v_n;

    UPDATE public.crm_fields
       SET label = 'Agent (system)', updated_at = now()
     WHERE module_id = v_leads
       AND key = 'normalized_agent_name'
       AND label IN ('Agent', 'Agent (system)');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'leads.normalized_agent_name label: % row(s)', v_n;

    UPDATE public.crm_fields
       SET section = 'system', updated_at = now()
     WHERE module_id = v_leads
       AND section = 'management'
       AND key IN ('normalized_advisor_name', 'normalized_agent_name');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'leads management → system: % field(s)', v_n;
  ELSE
    RAISE NOTICE 'leads module not found — (a) skipped';
  END IF;

  -- (b) Plan vs Membership labels (idempotent: only when still the old label).
  -- Scoped to THIS org's contacts + leads modules: crm_fields is only
  -- org-scoped through module_id, so an unscoped key+label predicate would
  -- relabel every tenant that happens to use the same field.
  UPDATE public.crm_fields
     SET label = 'Health Insurance Plan', updated_at = now()
   WHERE module_id IN (v_contacts, v_leads)
     AND key = 'health_insurance_plan_name'
     AND label IN ('Plan name', 'Plan Name');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'health_insurance_plan_name label: % row(s)', v_n;

  IF v_contacts IS NOT NULL THEN
    UPDATE public.crm_fields
       SET label = 'Health Sharing Membership', updated_at = now()
     WHERE module_id = v_contacts
       AND key = 'product'
       AND label IN ('Product', 'Plan');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'contacts.product label: % row(s)', v_n;
  END IF;

  IF v_leads IS NOT NULL THEN
    UPDATE public.crm_fields
       SET label = 'Health Sharing Membership', updated_at = now()
     WHERE module_id = v_leads
       AND key = 'product_type'
       AND label IN ('Product Type', 'Plan');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'leads.product_type label: % row(s)', v_n;
  END IF;
END $$;
