-- ============================================================================
-- Advisor Carriers + Layout v3 — fix-up
--
-- The original 202604160001 migration created the `crm_advisor_carriers` table
-- and the `crm_fields.metadata` column successfully, but the per-module field
-- inserts + layout updates ran against the *first* organization returned by
-- `SELECT id FROM organizations LIMIT 1`, which is the seed "Default
-- Organization" — the actual contacts/leads/members modules live under a
-- different org. As a result no `other_coverage` / `life_coverage` fields were
-- inserted and the default layouts were not updated.
--
-- This migration re-runs that logic for **every** organization that owns at
-- least one of the three modules. It is fully idempotent:
--   - Field INSERTs use ON CONFLICT DO NOTHING.
--   - The metadata.carrier_type tagging is a jsonb merge (re-applying is a no-op).
--   - The default-layout config update is set-by-key, not appended.
-- ============================================================================

-- The table + metadata column already exist (created by 202604160001), but we
-- defensively guard them here so this migration is safe to apply on a cold DB.
ALTER TABLE crm_fields ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN crm_fields.metadata IS
  'Free-form per-field metadata. Recognised keys: carrier_type (drives advisor carrier dropdown).';

DO $$
DECLARE
  v_org_id              uuid;
  v_module_id           uuid;
  v_module_key          text;
  v_contacts_module_id  uuid;
  v_leads_module_id     uuid;
  v_members_module_id   uuid;
BEGIN
  ----------------------------------------------------------------------------
  -- Iterate every org that owns at least one of contacts / leads / members.
  ----------------------------------------------------------------------------
  FOR v_org_id IN
    SELECT DISTINCT org_id
      FROM crm_modules
     WHERE key IN ('contacts', 'leads', 'members')
  LOOP
    SELECT id INTO v_contacts_module_id FROM crm_modules
      WHERE org_id = v_org_id AND key = 'contacts';
    SELECT id INTO v_leads_module_id    FROM crm_modules
      WHERE org_id = v_org_id AND key = 'leads';
    SELECT id INTO v_members_module_id  FROM crm_modules
      WHERE org_id = v_org_id AND key = 'members';

    --------------------------------------------------------------------------
    -- A. Backfill insurance / sharing / vision / dental on Leads
    --------------------------------------------------------------------------
    IF v_leads_module_id IS NOT NULL THEN
      INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
      VALUES
        -- Insurance products
        (v_org_id, v_leads_module_id, 'insurance_carrier',        'Insurance Carrier',         'select',   false, false, 300, 'insurance_coverage', 'half', 'Insurance company name'),
        (v_org_id, v_leads_module_id, 'insurance_plan_name',      'Insurance Plan',            'text',     false, false, 301, 'insurance_coverage', 'half', 'Plan name'),
        (v_org_id, v_leads_module_id, 'insurance_full_cost',      'Full Premium Cost',         'currency', false, false, 302, 'insurance_coverage', 'half', NULL),
        (v_org_id, v_leads_module_id, 'insurance_subsidy_amount', 'Subsidy Amount',            'currency', false, false, 303, 'insurance_coverage', 'half', NULL),
        (v_org_id, v_leads_module_id, 'insurance_client_pays',    'Client Pays',               'currency', false, false, 304, 'insurance_coverage', 'half', NULL),
        (v_org_id, v_leads_module_id, 'insurance_effective_date', 'Effective Date',            'date',     false, false, 305, 'insurance_coverage', 'half', NULL),
        (v_org_id, v_leads_module_id, 'insurance_status',         'Insurance Status',          'select',   false, false, 306, 'insurance_coverage', 'half', NULL),
        -- Health sharing
        (v_org_id, v_leads_module_id, 'sharing_entity',           'Sharing Entity',            'select',   false, false, 320, 'health_sharing',     'half', 'Health sharing organization'),
        (v_org_id, v_leads_module_id, 'member_tier',              'Member Tier',               'text',     false, false, 321, 'health_sharing',     'half', NULL),
        (v_org_id, v_leads_module_id, 'monthly_contribution',     'Monthly Contribution',      'currency', false, false, 322, 'health_sharing',     'half', NULL),
        (v_org_id, v_leads_module_id, 'iua_amount',               'Initial Unshareable Amount','currency', false, false, 323, 'health_sharing',     'half', NULL),
        (v_org_id, v_leads_module_id, 'sharing_effective_date',   'Effective Date',            'date',     false, false, 324, 'health_sharing',     'half', NULL),
        (v_org_id, v_leads_module_id, 'sharing_status',           'Sharing Status',            'select',   false, false, 325, 'health_sharing',     'half', NULL),
        (v_org_id, v_leads_module_id, 'sharing_member_id',        'Sharing Member ID',         'text',     false, false, 326, 'health_sharing',     'half', NULL),
        -- Vision
        (v_org_id, v_leads_module_id, 'vision_provider',          'Vision Provider',           'select',   false, false, 350, 'vision_coverage',    'half', NULL),
        (v_org_id, v_leads_module_id, 'vision_plan_name',         'Vision Plan',               'text',     false, false, 351, 'vision_coverage',    'half', NULL),
        (v_org_id, v_leads_module_id, 'vision_start_date',        'Vision Start Date',         'date',     false, false, 352, 'vision_coverage',    'half', NULL),
        (v_org_id, v_leads_module_id, 'vision_price',             'Vision Monthly Cost',       'currency', false, false, 353, 'vision_coverage',    'half', NULL),
        -- Dental
        (v_org_id, v_leads_module_id, 'dental_provider',          'Dental Provider',           'select',   false, false, 370, 'dental_coverage',    'half', NULL),
        (v_org_id, v_leads_module_id, 'dental_plan_name',         'Dental Plan',               'text',     false, false, 371, 'dental_coverage',    'half', NULL),
        (v_org_id, v_leads_module_id, 'dental_start_date',        'Dental Start Date',         'date',     false, false, 372, 'dental_coverage',    'half', NULL),
        (v_org_id, v_leads_module_id, 'dental_price',             'Dental Monthly Cost',       'currency', false, false, 373, 'dental_coverage',    'half', NULL)
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

    --------------------------------------------------------------------------
    -- B. Other Coverage + Life Insurance fields for all 3 modules
    --------------------------------------------------------------------------
    FOREACH v_module_key IN ARRAY ARRAY['contacts', 'leads', 'members'] LOOP
      SELECT id INTO v_module_id FROM crm_modules
        WHERE org_id = v_org_id AND key = v_module_key;
      IF v_module_id IS NULL THEN CONTINUE; END IF;

      -- Other coverage
      INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
      VALUES
        (v_org_id, v_module_id, 'other_coverage_type',   'Coverage Type',   'select',   false, false, 400, 'other_coverage', 'half', 'Type of supplemental coverage'),
        (v_org_id, v_module_id, 'other_carrier',         'Carrier',         'select',   false, false, 401, 'other_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'other_plan_name',       'Plan Name',       'text',     false, false, 402, 'other_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'other_start_date',      'Start Date',      'date',     false, false, 403, 'other_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'other_end_date',        'End Date',        'date',     false, false, 404, 'other_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'other_monthly_cost',    'Monthly Cost',    'currency', false, false, 405, 'other_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'other_covered_members', 'Covered Members', 'text',     false, false, 406, 'other_coverage', 'full', 'Primary, Spouse, Dependents covered')
      ON CONFLICT (module_id, key) DO NOTHING;

      UPDATE crm_fields
         SET options = '["Health Access","Indemnity","Short-Term Medical","Disability","Accident","Critical Illness","Hospital Indemnity","Other"]'::jsonb
       WHERE module_id = v_module_id AND key = 'other_coverage_type';

      -- Life insurance
      INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
      VALUES
        (v_org_id, v_module_id, 'life_carrier',      'Carrier',         'select',   false, false, 420, 'life_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'life_product_type', 'Product Type',    'select',   false, false, 421, 'life_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'life_plan_name',    'Plan Name',       'text',     false, false, 422, 'life_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'life_face_amount',  'Face Amount',     'currency', false, false, 423, 'life_coverage', 'half', 'Death benefit / coverage amount'),
        (v_org_id, v_module_id, 'life_premium',      'Monthly Premium', 'currency', false, false, 424, 'life_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'life_start_date',   'Start Date',      'date',     false, false, 425, 'life_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'life_beneficiary',  'Beneficiary',     'text',     false, false, 426, 'life_coverage', 'half', NULL),
        (v_org_id, v_module_id, 'life_status',       'Status',          'select',   false, false, 427, 'life_coverage', 'half', NULL)
      ON CONFLICT (module_id, key) DO NOTHING;

      UPDATE crm_fields
         SET options = '["Term","Whole Life","Universal Life","IUL","Final Expense","Other"]'::jsonb
       WHERE module_id = v_module_id AND key = 'life_product_type';
      UPDATE crm_fields
         SET options = '["Active","Inactive","Pending","Cancelled","Lapsed"]'::jsonb
       WHERE module_id = v_module_id AND key = 'life_status';

      ------------------------------------------------------------------------
      -- Tag carrier-typed fields with metadata.carrier_type so the renderer
      -- knows which advisor list to load. Idempotent jsonb merge.
      ------------------------------------------------------------------------
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

    --------------------------------------------------------------------------
    -- C. Default-layout config rewrite (per org)
    --------------------------------------------------------------------------

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

  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
