-- =============================================================================
-- CRM PROSPECTS MODULE + TERRITORIES
-- 1. crm_territories table with default geographic regions
-- 2. territory_id column on crm_records
-- 3. Prospects module with cloned Contacts fields
-- 4. Default views and layout for Prospects
-- =============================================================================

-- =============================================================================
-- 1. TERRITORIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES crm_territories(id) ON DELETE SET NULL,
  description text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_crm_territories_org ON crm_territories(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_territories_parent ON crm_territories(parent_id);

-- Grant RLS-friendly access
ALTER TABLE crm_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Territories visible to authenticated org members"
  ON crm_territories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Territories managed by authenticated users"
  ON crm_territories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 2. ADD territory_id TO crm_records
-- =============================================================================

ALTER TABLE crm_records
  ADD COLUMN IF NOT EXISTS territory_id uuid REFERENCES crm_territories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_territory ON crm_records(territory_id);

-- =============================================================================
-- 3. SEED DEFAULT TERRITORIES + PROSPECTS MODULE + FIELDS + VIEWS + LAYOUT
-- =============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_contacts_module_id uuid;
  v_prospects_module_id uuid;
BEGIN
  -- Get the first organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found. Skipping prospects/territories seed.';
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3a. Seed default geographic territories
  -- --------------------------------------------------------------------------
  INSERT INTO crm_territories (org_id, name, description, display_order)
  VALUES
    (v_org_id, 'Northeast',  'CT, ME, MA, NH, NJ, NY, PA, RI, VT',     1),
    (v_org_id, 'Southeast',  'AL, AR, FL, GA, KY, LA, MS, NC, SC, TN, VA, WV', 2),
    (v_org_id, 'Midwest',    'IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI', 3),
    (v_org_id, 'Southwest',  'AZ, NM, OK, TX',                         4),
    (v_org_id, 'West',       'CO, ID, MT, NV, UT, WY',                 5),
    (v_org_id, 'Northwest',  'OR, WA',                                  6),
    (v_org_id, 'Pacific',    'AK, CA, HI',                             7)
  ON CONFLICT (org_id, name) DO NOTHING;

  -- --------------------------------------------------------------------------
  -- 3b. Create Prospects module
  -- --------------------------------------------------------------------------
  INSERT INTO crm_modules (org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
  VALUES (
    v_org_id,
    'prospects',
    'Prospect',
    'Prospects',
    'target',
    'Manage potential customers and sales opportunities',
    true,
    true,
    5
  )
  ON CONFLICT (org_id, key) DO UPDATE SET
    name = EXCLUDED.name,
    name_plural = EXCLUDED.name_plural,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    updated_at = now()
  RETURNING id INTO v_prospects_module_id;

  -- --------------------------------------------------------------------------
  -- 3c. Clone ALL fields from Contacts module to Prospects module
  -- --------------------------------------------------------------------------
  SELECT id INTO v_contacts_module_id
  FROM crm_modules
  WHERE org_id = v_org_id AND key = 'contacts';

  IF v_contacts_module_id IS NOT NULL AND v_prospects_module_id IS NOT NULL THEN
    INSERT INTO crm_fields (
      org_id, module_id, key, label, type, required,
      is_system, is_indexed, is_title_field, options,
      validation, default_value, tooltip,
      display_order, section, width
    )
    SELECT
      v_org_id,
      v_prospects_module_id,
      key,
      label,
      type,
      required,
      is_system,
      is_indexed,
      is_title_field,
      options,
      validation,
      default_value,
      tooltip,
      display_order,
      section,
      width
    FROM crm_fields
    WHERE module_id = v_contacts_module_id
    ON CONFLICT (module_id, key) DO NOTHING;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3d. Add prospect-specific fields
  -- --------------------------------------------------------------------------
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order, options)
  VALUES
    (v_org_id, v_prospects_module_id, 'prospect_status', 'Prospect Status', 'select', false, true, true, 'core', 900,
     '["New", "In Process", "Qualified", "Closed Won", "Closed Lost"]'::jsonb),
    (v_org_id, v_prospects_module_id, 'territory_name', 'Territory', 'text', false, false, false, 'core', 901, '[]'::jsonb)
  ON CONFLICT (module_id, key) DO NOTHING;

  -- --------------------------------------------------------------------------
  -- 3e. Create 5 default views for Prospects
  -- --------------------------------------------------------------------------

  -- All Prospects (default view)
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
  VALUES (
    v_org_id,
    v_prospects_module_id,
    'All Prospects',
    true,
    true,
    '["first_name", "last_name", "email", "phone", "prospect_status", "carrier", "mailing_city", "mailing_state"]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- My Prospects
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, filters, sort)
  VALUES (
    v_org_id,
    v_prospects_module_id,
    'My Prospects',
    false,
    true,
    '["first_name", "last_name", "email", "phone", "prospect_status", "carrier"]'::jsonb,
    '[{"field": "__system", "operator": "equals", "value": "my_records", "category": "system", "systemPreset": "my_records"}]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Prospects in Process
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, filters, sort)
  VALUES (
    v_org_id,
    v_prospects_module_id,
    'Prospects in Process',
    false,
    true,
    '["first_name", "last_name", "email", "phone", "prospect_status", "carrier", "start_date"]'::jsonb,
    '[{"field": "prospect_status", "operator": "equals", "value": "In Process"}]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Closed Prospects
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, filters, sort)
  VALUES (
    v_org_id,
    v_prospects_module_id,
    'Closed Prospects',
    false,
    true,
    '["first_name", "last_name", "email", "phone", "prospect_status", "carrier", "product"]'::jsonb,
    '[{"field": "prospect_status", "operator": "in", "value": ["Closed Won", "Closed Lost"]}]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Closed HES/Liberty Prospects
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, filters, sort)
  VALUES (
    v_org_id,
    v_prospects_module_id,
    'Closed HES/Liberty Prospects',
    false,
    true,
    '["first_name", "last_name", "email", "phone", "prospect_status", "carrier", "product"]'::jsonb,
    '[{"field": "prospect_status", "operator": "in", "value": ["Closed Won", "Closed Lost"]}, {"field": "carrier", "operator": "in", "value": ["HES", "Liberty"]}]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- --------------------------------------------------------------------------
  -- 3f. Create default layout for Prospects (mirroring Contacts sections)
  -- --------------------------------------------------------------------------
  INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
  VALUES (
    v_org_id,
    v_prospects_module_id,
    'Default Layout',
    true,
    '{
      "sections": [
        {"key": "core", "label": "Core Information", "columns": 2, "collapsed": false},
        {"key": "management", "label": "Contact Management", "columns": 2, "collapsed": false},
        {"key": "address", "label": "Address", "columns": 2, "collapsed": false},
        {"key": "spouse", "label": "Family - Spouse", "columns": 2, "collapsed": true},
        {"key": "children", "label": "Family - Children", "columns": 2, "collapsed": true},
        {"key": "insurance", "label": "Insurance/Product", "columns": 2, "collapsed": false},
        {"key": "payment", "label": "Payment", "columns": 2, "collapsed": true},
        {"key": "commissions", "label": "Commissions", "columns": 2, "collapsed": true},
        {"key": "life_codes", "label": "Life Codes / Identifiers", "columns": 2, "collapsed": true},
        {"key": "portal", "label": "Portal Access", "columns": 2, "collapsed": true},
        {"key": "compliance", "label": "Compliance", "columns": 2, "collapsed": true},
        {"key": "welcome", "label": "Welcome/Fulfillment", "columns": 2, "collapsed": true},
        {"key": "activity", "label": "Activity Tracking", "columns": 2, "collapsed": true},
        {"key": "communication", "label": "Communication Preferences", "columns": 2, "collapsed": true},
        {"key": "business", "label": "Business Info", "columns": 2, "collapsed": true},
        {"key": "system", "label": "System/Audit", "columns": 2, "collapsed": true}
      ]
    }'::jsonb
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Prospects module and territories seeded for organization %', v_org_id;

END $$;
