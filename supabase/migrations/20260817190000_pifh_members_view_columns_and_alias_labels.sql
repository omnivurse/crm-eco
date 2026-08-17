-- PIFH configuration-only (crm_views / crm_fields rows; NO record data touched).
-- NOT pushed by the authoring agent — apply via `supabase db push` after review.
--
-- Goal: the Members list shows plan / effective date / city / referral at a
-- glance, and "who enrolled" wears ONE label everywhere.
--
-- (a) Members default view "All Members" (crm_views fdf7ae2b-031e-4236-ae55-3c969a1cb993,
--     is_default, is_shared, created_by NULL) columns
--       first_name,last_name,member_number,email,phone,contact_status,advisor_name
--     -> first_name,last_name,member_number,contact_status,plan_name,effective_date,
--        city,referral,advisor_name,phone   (10 columns)
--     plan_name / effective_date are members crm_fields keys (coverage section,
--     ids 64ba9a0a-78e5-46d9-8873-13a673a13715 / 70546c36-f5f0-41cf-86a6-5220943037fb);
--     their VALUES come read-time from the Contacts twin (product /
--     sharing_effective_date) via getRecords' batched twin overlay — nothing is
--     written into member rows.
--
-- (b) Contacts module (f9869598-18f2-4277-94a0-255ba9044cb9): the two normalized
--     name fields duplicated the labels of the human-entered fields
--     (normalized_advisor_name "Advisor" == advisor "Advisor";
--      normalized_agent_name "Agent" == agent "Agent"), so the record page showed
--     "Advisor" / "Agent" twice with different values. Labels only:
--       82b4010b-dc80-4c99-bfac-fc2b80d2e812 normalized_advisor_name  'Advisor' -> 'Advisor (system)'
--       749ee133-02a1-4a8a-99a2-6c88d076001a normalized_agent_name    'Agent'   -> 'Agent (system)'
--     Keys, types, values, sections untouched.
--
-- (c) Contacts module: move alias / normalization bookkeeping fields out of the
--     open "Ownership & Management" card into the collapsed "System" card
--     (display grouping only — crm_fields.section; the record page still renders
--     them, DynamicRecordForm groups by section and buildEffectiveSections adds
--     any section the layout does not list). Verified live: each key below is
--     currently section='management' on contacts. canonical_advisor_id has no
--     crm_fields row on contacts (skipped); normalization_notes and
--     zoho_contact_owner_id are already in 'system' (no-op).
--       9b400b6a-d186-40fc-8269-7561d866dfe3 producer_id
--       8ff5692f-0041-4670-87eb-260d049869f7 advisor_code
--       029663be-5b18-49be-bbaf-f90530f25316 advisor_id
--       7496d782-28a8-440b-9fb2-2b09b40648f7 agent_role
--       82b4010b-dc80-4c99-bfac-fc2b80d2e812 normalized_advisor_name
--       749ee133-02a1-4a8a-99a2-6c88d076001a normalized_agent_name
--       def77306-a673-4a56-9714-f0fd5b685d5c normalization_status
--     Human "who enrolled" fields (producer_name, producer, advisor_name, advisor,
--     agent, lead_owner, contact_owner) stay in management.
--
-- Rollback (all three are plain UPDATEs on config rows):
--   UPDATE public.crm_views SET columns = '["first_name","last_name","member_number","email","phone","contact_status","advisor_name"]'::jsonb, updated_at = now()
--    WHERE id = 'fdf7ae2b-031e-4236-ae55-3c969a1cb993';
--   UPDATE public.crm_fields SET label = 'Advisor', updated_at = now() WHERE id = '82b4010b-dc80-4c99-bfac-fc2b80d2e812' AND key = 'normalized_advisor_name';
--   UPDATE public.crm_fields SET label = 'Agent',   updated_at = now() WHERE id = '749ee133-02a1-4a8a-99a2-6c88d076001a' AND key = 'normalized_agent_name';
--   UPDATE public.crm_fields SET section = 'management', updated_at = now()
--    WHERE module_id = 'f9869598-18f2-4277-94a0-255ba9044cb9' AND section = 'system'
--      AND key IN ('producer_id','advisor_code','advisor_id','agent_role','normalized_advisor_name','normalized_agent_name','normalization_status');

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org      uuid := '00000000-0000-0000-0000-000000000001';
  v_members  uuid;
  v_contacts uuid;
  v_n        int;
BEGIN
  SELECT id INTO v_members  FROM public.crm_modules WHERE org_id = v_org AND key = 'members'  LIMIT 1;
  SELECT id INTO v_contacts FROM public.crm_modules WHERE org_id = v_org AND key = 'contacts' LIMIT 1;

  -- (a) Members default view columns (idempotent: only when different).
  IF v_members IS NOT NULL THEN
    UPDATE public.crm_views
       SET columns = '["first_name","last_name","member_number","contact_status","plan_name","effective_date","city","referral","advisor_name","phone"]'::jsonb,
           updated_at = now()
     WHERE module_id = v_members
       AND is_default = true
       AND created_by IS NULL
       AND columns IS DISTINCT FROM '["first_name","last_name","member_number","contact_status","plan_name","effective_date","city","referral","advisor_name","phone"]'::jsonb;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'members default view: % row(s) updated', v_n;
  ELSE
    RAISE NOTICE 'members module not found — (a) skipped';
  END IF;

  IF v_contacts IS NOT NULL THEN
    -- (b) Duplicate labels — labels only, matched by key AND current label so a
    --     later rename is never clobbered.
    UPDATE public.crm_fields SET label = 'Advisor (system)', updated_at = now()
     WHERE module_id = v_contacts AND key = 'normalized_advisor_name' AND label = 'Advisor';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'normalized_advisor_name label: % row(s) updated', v_n;

    UPDATE public.crm_fields SET label = 'Agent (system)', updated_at = now()
     WHERE module_id = v_contacts AND key = 'normalized_agent_name' AND label = 'Agent';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'normalized_agent_name label: % row(s) updated', v_n;

    -- (c) Alias / normalization bookkeeping -> collapsed System card.
    UPDATE public.crm_fields SET section = 'system', updated_at = now()
     WHERE module_id = v_contacts
       AND section = 'management'
       AND key IN ('producer_id','advisor_code','advisor_id','agent_role',
                   'normalized_advisor_name','normalized_agent_name','normalization_status');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'contacts management -> system: % field(s) moved', v_n;
  ELSE
    RAISE NOTICE 'contacts module not found — (b)/(c) skipped';
  END IF;
END $$;
