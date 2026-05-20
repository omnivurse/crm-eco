-- ============================================================================
-- Carrier Schema Alignment
--
-- Fixes data-model gaps discovered during a front-end / DB audit:
--
--  1. `insurance_plans.plan_type` CHECK constraint is out of sync with
--     `insurance_carriers.carrier_type` — missing dental/vision/life/other.
--
--  2. Contacts & Members modules are missing dental_coverage, vision_coverage,
--     and health_sharing section fields that Leads already has. This means the
--     record detail view renders empty sections for those modules.
--
--  3. The legacy `carrier` field on Contacts (section=insurance) is missing
--     its `carrier_type` metadata tag.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Expand insurance_plans.plan_type CHECK to match insurance_carriers
-- --------------------------------------------------------------------------
ALTER TABLE insurance_plans DROP CONSTRAINT IF EXISTS insurance_plans_plan_type_check;
ALTER TABLE insurance_plans
  ADD CONSTRAINT insurance_plans_plan_type_check
  CHECK (plan_type IN (
    'insurance', 'healthshare', 'medicaid', 'short_term',
    'dental', 'vision', 'life', 'other'
  ));

-- --------------------------------------------------------------------------
-- 2. Backfill dental / vision / health sharing fields on Contacts & Members
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id     uuid;
  v_module_id  uuid;
  v_module_key text;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping field backfill';
    RETURN;
  END IF;

  -- Loop over contacts and members (leads already has these fields)
  FOREACH v_module_key IN ARRAY ARRAY['contacts', 'members'] LOOP
    SELECT id INTO v_module_id FROM crm_modules
      WHERE org_id = v_org_id AND key = v_module_key;
    IF v_module_id IS NULL THEN CONTINUE; END IF;

    -- ---- Health Sharing fields ----
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip, metadata)
    VALUES
      (v_org_id, v_module_id, 'sharing_entity',         'Sharing Entity',            'select',   false, false, 320, 'health_sharing', 'half', 'Health sharing ministry',        '{"carrier_type":"healthshare"}'::jsonb),
      (v_org_id, v_module_id, 'member_tier',             'Member Tier',               'text',     false, false, 321, 'health_sharing', 'half', NULL, '{}'::jsonb),
      (v_org_id, v_module_id, 'monthly_contribution',    'Monthly Contribution',      'currency', false, false, 322, 'health_sharing', 'half', NULL, '{}'::jsonb),
      (v_org_id, v_module_id, 'iua_amount',              'Initial Unshareable Amount', 'currency', false, false, 323, 'health_sharing', 'half', NULL, '{}'::jsonb),
      (v_org_id, v_module_id, 'sharing_effective_date',  'Effective Date',            'date',     false, false, 324, 'health_sharing', 'half', NULL, '{}'::jsonb),
      (v_org_id, v_module_id, 'sharing_status',          'Sharing Status',            'select',   false, false, 325, 'health_sharing', 'half', NULL, '{}'::jsonb),
      (v_org_id, v_module_id, 'sharing_member_id',       'Sharing Member ID',         'text',     false, false, 326, 'health_sharing', 'half', NULL, '{}'::jsonb)
    ON CONFLICT (module_id, key) DO NOTHING;

    -- Set options for sharing fields
    UPDATE crm_fields
       SET options = '["Sedera","Zion Health","MPB","Knew Health","Altrua","Impact","OneShare","Solidarity","Other"]'::jsonb
     WHERE module_id = v_module_id AND key = 'sharing_entity'
       AND (options IS NULL OR options = '[]'::jsonb);

    UPDATE crm_fields
       SET options = '["Active","Inactive","Pending","Cancelled","Terminated"]'::jsonb
     WHERE module_id = v_module_id AND key = 'sharing_status'
       AND (options IS NULL OR options = '[]'::jsonb);

    -- ---- Dental Coverage fields ----
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip, metadata)
    VALUES
      (v_org_id, v_module_id, 'dental_provider',   'Dental Provider',     'select',   false, false, 370, 'dental_coverage', 'half', NULL, '{"carrier_type":"dental"}'::jsonb),
      (v_org_id, v_module_id, 'dental_plan_name',  'Dental Plan',         'text',     false, false, 371, 'dental_coverage', 'half', NULL, '{}'::jsonb),
      (v_org_id, v_module_id, 'dental_start_date', 'Dental Start Date',   'date',     false, false, 372, 'dental_coverage', 'half', NULL, '{}'::jsonb),
      (v_org_id, v_module_id, 'dental_price',      'Dental Monthly Cost', 'currency', false, false, 373, 'dental_coverage', 'half', NULL, '{}'::jsonb)
    ON CONFLICT (module_id, key) DO NOTHING;

    -- ---- Vision Coverage fields ----
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip, metadata)
    VALUES
      (v_org_id, v_module_id, 'vision_provider',   'Vision Provider',     'select',   false, false, 350, 'vision_coverage', 'half', NULL, '{"carrier_type":"vision"}'::jsonb),
      (v_org_id, v_module_id, 'vision_plan_name',  'Vision Plan',         'text',     false, false, 351, 'vision_coverage', 'half', NULL, '{}'::jsonb),
      (v_org_id, v_module_id, 'vision_start_date', 'Vision Start Date',   'date',     false, false, 352, 'vision_coverage', 'half', NULL, '{}'::jsonb),
      (v_org_id, v_module_id, 'vision_price',      'Vision Monthly Cost', 'currency', false, false, 353, 'vision_coverage', 'half', NULL, '{}'::jsonb)
    ON CONFLICT (module_id, key) DO NOTHING;

    -- Ensure carrier_type metadata is set on any fields that got inserted
    -- without it (defensive — the INSERTs above include it, but belt & suspenders)
    UPDATE crm_fields
       SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"carrier_type":"healthshare"}'::jsonb
     WHERE module_id = v_module_id AND key = 'sharing_entity'
       AND (metadata->>'carrier_type') IS NULL;

    UPDATE crm_fields
       SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"carrier_type":"dental"}'::jsonb
     WHERE module_id = v_module_id AND key = 'dental_provider'
       AND (metadata->>'carrier_type') IS NULL;

    UPDATE crm_fields
       SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"carrier_type":"vision"}'::jsonb
     WHERE module_id = v_module_id AND key = 'vision_provider'
       AND (metadata->>'carrier_type') IS NULL;

  END LOOP;

  -- --------------------------------------------------------------------------
  -- 3. Tag the legacy 'carrier' field on Contacts with carrier_type metadata
  -- --------------------------------------------------------------------------
  UPDATE crm_fields
     SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"carrier_type":"insurance"}'::jsonb
   WHERE key = 'carrier' AND section = 'insurance'
     AND (metadata->>'carrier_type') IS NULL;

END $$;

-- Notify PostgREST to pick up changes
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- END: Carrier Schema Alignment
-- ============================================================================
