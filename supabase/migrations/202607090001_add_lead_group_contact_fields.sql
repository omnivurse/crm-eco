-- ============================================================================
-- Add "Company & Contact" fields to the Leads module.
--
-- Small-group leads (e.g. an employer like "Anchor Construction") are entered
-- under a single point-of-contact who is often NOT the decision-maker — the
-- Office Manager, HR, an admin, etc. These fields let reps record the company,
-- the contact person's role, whether they are the decision-maker, and a direct
-- line for that contact, distinct from the lead's primary email/phone.
--
-- Fields live in `crm_records.data` JSONB; `group_name` is additionally an
-- indexed column (promoted on write by mergeCrmDataJsonIntoRowColumns and used
-- by reporting / grouping / lead conversion). The others render via their
-- crm_fields definitions. All are added to the existing `main` section so they
-- appear in the record detail, inline editor, and generic create form without
-- any layout change.
--
-- Idempotent: ON CONFLICT (module_id, key) DO NOTHING. Loops over every org so
-- multi-tenant deployments are covered, not just the primary org.
-- ============================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_org_id uuid;
  v_count int := 0;
BEGIN
  FOR v_module_id, v_org_id IN
    SELECT id, org_id FROM crm_modules WHERE key = 'leads'
  LOOP
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, options)
    VALUES
      (v_org_id, v_module_id, 'group_name', 'Company / Group', 'text', false, false, 19, 'main', '[]'::jsonb),
      (v_org_id, v_module_id, 'contact_role', 'Contact Role', 'select', false, false, 20, 'main',
       '["Owner", "Decision Maker", "Office Manager", "HR Manager", "Office Admin", "Benefits Coordinator", "Accountant / Bookkeeper", "Other"]'::jsonb),
      (v_org_id, v_module_id, 'is_decision_maker', 'Primary Decision-Maker?', 'select', false, false, 21, 'main', '["Yes", "No"]'::jsonb),
      (v_org_id, v_module_id, 'contact_phone', 'Direct Phone', 'phone', false, false, 22, 'main', '[]'::jsonb),
      (v_org_id, v_module_id, 'contact_email', 'Direct Email', 'email', false, false, 23, 'main', '[]'::jsonb)
    ON CONFLICT (module_id, key) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Added Company & Contact lead fields to % leads module(s).', v_count;
END $$;
