-- ============================================================================
-- Advisor Carriers + Record Layout v3
--
-- Two coordinated changes:
--
-- 1) Per-Advisor carrier picker
--    - Extends `insurance_carriers.carrier_type` to include
--      `dental | vision | life | other` so the same shared directory can hold
--      every kind of carrier an advisor may want to track.
--    - Creates `crm_advisor_carriers` so each advisor maintains a personal,
--      ordered subset of the org carrier directory (RLS scoped to user_id).
--
-- 2) Record-layout refresh for Leads / Contacts / Members
--    - Adds a `metadata` jsonb column on `crm_fields` so individual fields can
--      declare their `carrier_type`. The DynamicRecordForm reads this at render
--      time to load the matching advisor-carrier list.
--    - Inserts `other_coverage` and `life_coverage` sections (Health Access,
--      Indemnity, Short-Term Medical, Disability, Life Insurance, ...) for all
--      three modules.
--    - Backfills `insurance_coverage`, `health_sharing`, `vision_coverage`,
--      and `dental_coverage` fields onto Leads (Phase 2 only ran on contacts +
--      members).
--    - Tags existing carrier-typed fields with `metadata.carrier_type`.
--    - Rewrites the default layout config so each module shows the new
--      canonical section order with `accent` colors, a `hero` Name card, a
--      collapsed Family section, and Commissions pinned to the bottom.
-- ============================================================================

DO $$
DECLARE
  v_org_id              uuid;
  v_contacts_module_id  uuid;
  v_leads_module_id     uuid;
  v_members_module_id   uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping advisor-carriers + layout migration';
    RETURN;
  END IF;

  SELECT id INTO v_contacts_module_id FROM crm_modules
    WHERE org_id = v_org_id AND key = 'contacts';
  SELECT id INTO v_leads_module_id    FROM crm_modules
    WHERE org_id = v_org_id AND key = 'leads';
  SELECT id INTO v_members_module_id  FROM crm_modules
    WHERE org_id = v_org_id AND key = 'members';

  -- ==========================================================================
  -- 1A. Extend carrier_type CHECK on insurance_carriers
  -- ==========================================================================
  ALTER TABLE insurance_carriers DROP CONSTRAINT IF EXISTS insurance_carriers_carrier_type_check;
  ALTER TABLE insurance_carriers
    ADD CONSTRAINT insurance_carriers_carrier_type_check
    CHECK (carrier_type IN (
      'insurance', 'healthshare', 'medicaid', 'short_term',
      'dental', 'vision', 'life', 'other'
    ));

  -- ==========================================================================
  -- 1B. Per-advisor carrier list (`crm_advisor_carriers`)
  -- ==========================================================================
  CREATE TABLE IF NOT EXISTS crm_advisor_carriers (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
    carrier_id      uuid        NOT NULL REFERENCES insurance_carriers(id) ON DELETE CASCADE,
    is_active       boolean     NOT NULL DEFAULT true,
    sort_order      integer     NOT NULL DEFAULT 0,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_advisor_carriers_user_carrier UNIQUE (organization_id, user_id, carrier_id)
  );

  COMMENT ON TABLE  crm_advisor_carriers IS 'Per-advisor selection of carriers from the shared insurance_carriers directory';
  COMMENT ON COLUMN crm_advisor_carriers.sort_order IS 'Manual ordering for the advisor''s personal list (lower = first)';
END $$;

CREATE INDEX IF NOT EXISTS idx_advisor_carriers_user
  ON crm_advisor_carriers (organization_id, user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_advisor_carriers_carrier
  ON crm_advisor_carriers (carrier_id);

-- updated_at trigger (re-uses the shared helper)
DROP TRIGGER IF EXISTS update_advisor_carriers_updated_at ON crm_advisor_carriers;
CREATE TRIGGER update_advisor_carriers_updated_at
  BEFORE UPDATE ON crm_advisor_carriers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- RLS: an advisor can manage only their own rows; service role full access.
-- ----------------------------------------------------------------------------
ALTER TABLE crm_advisor_carriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advisor_carriers_select_own" ON crm_advisor_carriers;
CREATE POLICY "advisor_carriers_select_own" ON crm_advisor_carriers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "advisor_carriers_insert_own" ON crm_advisor_carriers;
CREATE POLICY "advisor_carriers_insert_own" ON crm_advisor_carriers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_crm_member(organization_id)
  );

DROP POLICY IF EXISTS "advisor_carriers_update_own" ON crm_advisor_carriers;
CREATE POLICY "advisor_carriers_update_own" ON crm_advisor_carriers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "advisor_carriers_delete_own" ON crm_advisor_carriers;
CREATE POLICY "advisor_carriers_delete_own" ON crm_advisor_carriers
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "advisor_carriers_service" ON crm_advisor_carriers;
CREATE POLICY "advisor_carriers_service" ON crm_advisor_carriers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. CRM fields metadata column
-- ============================================================================
ALTER TABLE crm_fields ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN crm_fields.metadata IS
  'Free-form per-field metadata. Recognised keys: carrier_type (drives advisor carrier dropdown).';

-- ============================================================================
-- 3. Field + layout updates per module
-- ============================================================================
DO $$
DECLARE
  v_org_id              uuid;
  v_contacts_module_id  uuid;
  v_leads_module_id     uuid;
  v_members_module_id   uuid;
  v_module_id           uuid;
  v_module_keys         text[] := ARRAY['contacts', 'leads', 'members'];
  v_module_key          text;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_contacts_module_id FROM crm_modules
    WHERE org_id = v_org_id AND key = 'contacts';
  SELECT id INTO v_leads_module_id    FROM crm_modules
    WHERE org_id = v_org_id AND key = 'leads';
  SELECT id INTO v_members_module_id  FROM crm_modules
    WHERE org_id = v_org_id AND key = 'members';

  -- --------------------------------------------------------------------------
  -- 3A. Backfill insurance / sharing / vision / dental on the Leads module.
  --     Phase 2 only ran on contacts + members, leaving leads with the legacy
  --     "Insurance / Product" combined section.
  -- --------------------------------------------------------------------------
  IF v_leads_module_id IS NOT NULL THEN
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      -- Insurance products
      (v_org_id, v_leads_module_id, 'insurance_carrier',        'Insurance Carrier',        'select',   false, false, 300, 'insurance_coverage', 'half', 'Insurance company name'),
      (v_org_id, v_leads_module_id, 'insurance_plan_name',      'Insurance Plan',           'text',     false, false, 301, 'insurance_coverage', 'half', 'Plan name'),
      (v_org_id, v_leads_module_id, 'insurance_full_cost',      'Full Premium Cost',        'currency', false, false, 302, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_leads_module_id, 'insurance_subsidy_amount', 'Subsidy Amount',           'currency', false, false, 303, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_leads_module_id, 'insurance_client_pays',    'Client Pays',              'currency', false, false, 304, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_leads_module_id, 'insurance_effective_date', 'Effective Date',           'date',     false, false, 305, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_leads_module_id, 'insurance_status',         'Insurance Status',         'select',   false, false, 306, 'insurance_coverage', 'half', NULL),
      -- Health sharing
      (v_org_id, v_leads_module_id, 'sharing_entity',           'Sharing Entity',           'select',   false, false, 320, 'health_sharing',     'half', 'Health sharing organization'),
      (v_org_id, v_leads_module_id, 'member_tier',              'Member Tier',              'text',     false, false, 321, 'health_sharing',     'half', NULL),
      (v_org_id, v_leads_module_id, 'monthly_contribution',     'Monthly Contribution',     'currency', false, false, 322, 'health_sharing',     'half', NULL),
      (v_org_id, v_leads_module_id, 'iua_amount',               'Initial Unshareable Amount','currency',false, false, 323, 'health_sharing',     'half', NULL),
      (v_org_id, v_leads_module_id, 'sharing_effective_date',   'Effective Date',           'date',     false, false, 324, 'health_sharing',     'half', NULL),
      (v_org_id, v_leads_module_id, 'sharing_status',           'Sharing Status',           'select',   false, false, 325, 'health_sharing',     'half', NULL),
      (v_org_id, v_leads_module_id, 'sharing_member_id',        'Sharing Member ID',        'text',     false, false, 326, 'health_sharing',     'half', NULL),
      -- Vision
      (v_org_id, v_leads_module_id, 'vision_provider',          'Vision Provider',          'select',   false, false, 350, 'vision_coverage',    'half', NULL),
      (v_org_id, v_leads_module_id, 'vision_plan_name',         'Vision Plan',              'text',     false, false, 351, 'vision_coverage',    'half', NULL),
      (v_org_id, v_leads_module_id, 'vision_start_date',        'Vision Start Date',        'date',     false, false, 352, 'vision_coverage',    'half', NULL),
      (v_org_id, v_leads_module_id, 'vision_price',             'Vision Monthly Cost',      'currency', false, false, 353, 'vision_coverage',    'half', NULL),
      -- Dental
      (v_org_id, v_leads_module_id, 'dental_provider',          'Dental Provider',          'select',   false, false, 370, 'dental_coverage',    'half', NULL),
      (v_org_id, v_leads_module_id, 'dental_plan_name',         'Dental Plan',              'text',     false, false, 371, 'dental_coverage',    'half', NULL),
      (v_org_id, v_leads_module_id, 'dental_start_date',        'Dental Start Date',        'date',     false, false, 372, 'dental_coverage',    'half', NULL),
      (v_org_id, v_leads_module_id, 'dental_price',             'Dental Monthly Cost',      'currency', false, false, 373, 'dental_coverage',    'half', NULL)
    ON CONFLICT (module_id, key) DO NOTHING;

    UPDATE crm_fields
       SET options = '["Anthem","Cigna","Kaiser","RMHP","Select Health","UnitedHealthcare","Aetna","Humana","Blue Cross","Other"]'::jsonb
     WHERE module_id = v_leads_module_id AND key = 'insurance_carrier';
    UPDATE crm_fields
       SET options = '["Active","Inactive","Pending","Cancelled","Terminated"]'::jsonb
     WHERE module_id = v_leads_module_id AND key IN ('insurance_status', 'sharing_status');
    UPDATE crm_fields
       SET options = '["Sedera","Zion Health","MPB","Knew Health","Altrua","Impact","OneShare","Solidarity","Other"]'::jsonb
     WHERE module_id = v_leads_module_id AND key = 'sharing_entity';
  END IF;

  -- --------------------------------------------------------------------------
  -- 3B. Other Coverage + Life Insurance fields (all 3 modules)
  -- --------------------------------------------------------------------------
  FOREACH v_module_key IN ARRAY v_module_keys LOOP
    SELECT id INTO v_module_id FROM crm_modules
      WHERE org_id = v_org_id AND key = v_module_key;
    IF v_module_id IS NULL THEN CONTINUE; END IF;

    -- Other coverage
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_module_id, 'other_coverage_type',  'Coverage Type',     'select',   false, false, 400, 'other_coverage', 'half', 'Type of supplemental coverage'),
      (v_org_id, v_module_id, 'other_carrier',        'Carrier',           'select',   false, false, 401, 'other_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'other_plan_name',      'Plan Name',         'text',     false, false, 402, 'other_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'other_start_date',     'Start Date',        'date',     false, false, 403, 'other_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'other_end_date',       'End Date',          'date',     false, false, 404, 'other_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'other_monthly_cost',   'Monthly Cost',      'currency', false, false, 405, 'other_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'other_covered_members','Covered Members',   'text',     false, false, 406, 'other_coverage', 'full', 'Primary, Spouse, Dependents covered')
    ON CONFLICT (module_id, key) DO NOTHING;

    UPDATE crm_fields
       SET options = '["Health Access","Indemnity","Short-Term Medical","Disability","Accident","Critical Illness","Hospital Indemnity","Other"]'::jsonb
     WHERE module_id = v_module_id AND key = 'other_coverage_type';

    -- Life insurance
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_module_id, 'life_carrier',        'Carrier',         'select',   false, false, 420, 'life_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'life_product_type',   'Product Type',    'select',   false, false, 421, 'life_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'life_plan_name',      'Plan Name',       'text',     false, false, 422, 'life_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'life_face_amount',    'Face Amount',     'currency', false, false, 423, 'life_coverage', 'half', 'Death benefit / coverage amount'),
      (v_org_id, v_module_id, 'life_premium',        'Monthly Premium', 'currency', false, false, 424, 'life_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'life_start_date',     'Start Date',      'date',     false, false, 425, 'life_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'life_beneficiary',    'Beneficiary',     'text',     false, false, 426, 'life_coverage', 'half', NULL),
      (v_org_id, v_module_id, 'life_status',         'Status',          'select',   false, false, 427, 'life_coverage', 'half', NULL)
    ON CONFLICT (module_id, key) DO NOTHING;

    UPDATE crm_fields
       SET options = '["Term","Whole Life","Universal Life","IUL","Final Expense","Other"]'::jsonb
     WHERE module_id = v_module_id AND key = 'life_product_type';
    UPDATE crm_fields
       SET options = '["Active","Inactive","Pending","Cancelled","Lapsed"]'::jsonb
     WHERE module_id = v_module_id AND key = 'life_status';

    -- Tag carrier-typed fields with metadata.carrier_type so the renderer knows
    -- which advisor list to load. Idempotent jsonb merge.
    UPDATE crm_fields
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('carrier_type', 'insurance')
     WHERE module_id = v_module_id AND key = 'insurance_carrier';

    UPDATE crm_fields
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('carrier_type', 'healthshare')
     WHERE module_id = v_module_id AND key = 'sharing_entity';

    UPDATE crm_fields
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('carrier_type', 'dental')
     WHERE module_id = v_module_id AND key = 'dental_provider';

    UPDATE crm_fields
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('carrier_type', 'vision')
     WHERE module_id = v_module_id AND key = 'vision_provider';

    UPDATE crm_fields
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('carrier_type', 'other')
     WHERE module_id = v_module_id AND key = 'other_carrier';

    UPDATE crm_fields
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('carrier_type', 'life')
     WHERE module_id = v_module_id AND key = 'life_carrier';
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 3C. Update default layouts for contacts / leads / members
  --     Section order, labels, accent colors, hero variant, collapsed flags.
  -- --------------------------------------------------------------------------

  -- Contacts
  IF v_contacts_module_id IS NOT NULL THEN
    UPDATE crm_layouts
       SET config = jsonb_build_object(
         'sections', '[
           {"key":"core",                 "label":"Name",                       "columns":2, "accent":"slate",   "variant":"hero"},
           {"key":"notes_history",        "label":"Notes History",              "columns":1, "accent":"slate",   "collapsed":true},
           {"key":"start_date",           "label":"Start Date",                 "columns":2, "accent":"indigo"},
           {"key":"health_sharing",       "label":"Health Share Membership",    "columns":2, "accent":"emerald"},
           {"key":"insurance_coverage",   "label":"Insurance Products",         "columns":2, "accent":"blue"},
           {"key":"dental_coverage",      "label":"Dental",                     "columns":2, "accent":"cyan",   "collapsed":true},
           {"key":"vision_coverage",      "label":"Vision",                     "columns":2, "accent":"purple", "collapsed":true},
           {"key":"other_coverage",       "label":"Other Coverage",             "columns":2, "accent":"amber",  "collapsed":true},
           {"key":"life_coverage",        "label":"Life Insurance",             "columns":2, "accent":"rose",   "collapsed":true},
           {"key":"family",               "label":"Family",                     "columns":2, "accent":"pink",   "collapsed":true},
           {"key":"address",              "label":"Address",                    "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"management",           "label":"Ownership & Management",     "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"payment",              "label":"Payment",                    "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"identifiers",          "label":"Codes & Identifiers",        "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"portal",               "label":"Portal Access",              "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"compliance",           "label":"Compliance",                 "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"fulfillment",          "label":"Fulfillment",                "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"business",             "label":"Business Information",       "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"preferences",          "label":"Communication Preferences",  "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"additional",           "label":"Additional Information",     "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"activity",             "label":"Activity & Analytics",       "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"commissions",          "label":"Commissions",                "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"zoho_system",          "label":"System",                     "columns":2, "accent":"slate",  "collapsed":true}
         ]'::jsonb
       ),
         updated_at = now()
     WHERE module_id = v_contacts_module_id AND is_default = true;
  END IF;

  -- Leads
  IF v_leads_module_id IS NOT NULL THEN
    UPDATE crm_layouts
       SET config = jsonb_build_object(
         'sections', '[
           {"key":"core",                 "label":"Name",                       "columns":2, "accent":"slate",   "variant":"hero"},
           {"key":"notes_history",        "label":"Notes History",              "columns":1, "accent":"slate",   "collapsed":true},
           {"key":"start_date",           "label":"Start Date",                 "columns":2, "accent":"indigo"},
           {"key":"health_sharing",       "label":"Health Share Membership",    "columns":2, "accent":"emerald"},
           {"key":"insurance_coverage",   "label":"Insurance Products",         "columns":2, "accent":"blue"},
           {"key":"dental_coverage",      "label":"Dental",                     "columns":2, "accent":"cyan",   "collapsed":true},
           {"key":"vision_coverage",      "label":"Vision",                     "columns":2, "accent":"purple", "collapsed":true},
           {"key":"other_coverage",       "label":"Other Coverage",             "columns":2, "accent":"amber",  "collapsed":true},
           {"key":"life_coverage",        "label":"Life Insurance",             "columns":2, "accent":"rose",   "collapsed":true},
           {"key":"family",               "label":"Family",                     "columns":2, "accent":"pink",   "collapsed":true},
           {"key":"address",              "label":"Address",                    "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"management",           "label":"Lead Management",            "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"product",              "label":"Product Interest",           "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"conversion",           "label":"Conversion",                 "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"preferences",          "label":"Preferences",                "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"commissions",          "label":"Commissions",                "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"system",               "label":"System Information",         "columns":2, "accent":"slate",  "collapsed":true}
         ]'::jsonb
       ),
         updated_at = now()
     WHERE module_id = v_leads_module_id AND is_default = true;
  END IF;

  -- Members
  IF v_members_module_id IS NOT NULL THEN
    UPDATE crm_layouts
       SET config = jsonb_build_object(
         'sections', '[
           {"key":"core",                 "label":"Name",                       "columns":2, "accent":"slate",   "variant":"hero"},
           {"key":"main",                 "label":"Member Information",         "columns":2, "accent":"slate"},
           {"key":"notes_history",        "label":"Notes History",              "columns":1, "accent":"slate",   "collapsed":true},
           {"key":"start_date",           "label":"Start Date",                 "columns":2, "accent":"indigo"},
           {"key":"health_sharing",       "label":"Health Share Membership",    "columns":2, "accent":"emerald"},
           {"key":"insurance_coverage",   "label":"Insurance Products",         "columns":2, "accent":"blue"},
           {"key":"dental_coverage",      "label":"Dental",                     "columns":2, "accent":"cyan",   "collapsed":true},
           {"key":"vision_coverage",      "label":"Vision",                     "columns":2, "accent":"purple", "collapsed":true},
           {"key":"other_coverage",       "label":"Other Coverage",             "columns":2, "accent":"amber",  "collapsed":true},
           {"key":"life_coverage",        "label":"Life Insurance",             "columns":2, "accent":"rose",   "collapsed":true},
           {"key":"family",               "label":"Family",                     "columns":2, "accent":"pink",   "collapsed":true},
           {"key":"address",              "label":"Address",                    "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"management",           "label":"Ownership & Management",     "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"payment",              "label":"Payment",                    "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"compliance",           "label":"Compliance",                 "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"preferences",          "label":"Communication Preferences",  "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"activity",             "label":"Activity & Analytics",       "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"commissions",          "label":"Commissions",                "columns":2, "accent":"slate",  "collapsed":true},
           {"key":"system",               "label":"System Information",         "columns":2, "accent":"slate",  "collapsed":true}
         ]'::jsonb
       ),
         updated_at = now()
     WHERE module_id = v_members_module_id AND is_default = true;
  END IF;

END $$;

NOTIFY pgrst, 'reload schema';
