-- ============================================================================
-- Visibility restore, round 2 — the remaining real business keys.
-- ----------------------------------------------------------------------------
-- Round 1 (20260811190000) covered the high-volume families and seeded the
-- `advisors` module. Re-running the prod audit surfaced a long tail of smaller
-- but still call-relevant keys with no crm_fields definition, plus a second
-- `Leads` module (a separate demo/test org) whose 2 records rendered blank
-- because it, too, had zero field definitions.
--
-- Deliberately NOT defined here (they are mirrors of indexed crm_records
-- columns or import provenance, already surfaced through their own column and
-- not useful as duplicate form rows): owner_id, status, stage, is_converted,
-- import_source, source_record_id, canonical_advisor_id.
--
-- Additive and idempotent. Rollback: DELETE FROM crm_fields
--   WHERE metadata->>'source' = 'legacy_visibility_restore_r2';
-- ============================================================================

DO $$
DECLARE
  r record;
  v_module_id uuid;
  v_org_id uuid;
  v_added int := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- contacts
      ('contacts', 'advisor_id',               'Advisor ID',              'text',     'management',     920, 'half'),
      ('contacts', 'advisor',                  'Advisor',                 'text',     'management',     921, 'half'),
      ('contacts', 'agent',                    'Agent',                   'text',     'management',     922, 'half'),
      ('contacts', 'producer',                 'Producer',                'text',     'management',     923, 'half'),
      ('contacts', 'agent_role',               'Agent Role',              'text',     'management',     924, 'half'),
      ('contacts', 'enrollment_code',          'Enrollment Code',         'text',     'management',     925, 'half'),
      ('contacts', 'normalization_notes',      'Normalization Notes',     'textarea', 'system',         926, 'full'),
      ('contacts', 'converted_date',           'Converted Date',          'date',     'conversion',     927, 'half'),
      ('contacts', 'converted_contact_id',     'Converted Contact ID',    'text',     'conversion',     928, 'half'),
      ('contacts', 'converted_from_lead_id',   'Converted From Lead ID',  'text',     'conversion',     929, 'half'),
      ('contacts', 'converted_member_id',      'Converted Member ID',     'text',     'conversion',     930, 'half'),
      ('contacts', 'product_type',             'Product Type',            'text',     'main',           931, 'half'),
      ('contacts', 'age',                      'Age',                     'number',   'personal',       932, 'half'),
      ('contacts', 'street',                   'Street',                  'text',     'address',        933, 'full'),
      ('contacts', 'insurance_client_pays',    'Insurance Client Pays',   'currency', 'insurance',      934, 'half'),
      ('contacts', 'insurance_effective_date', 'Insurance Effective Date','date',     'insurance',      935, 'half'),
      ('contacts', 'insurance_subsidy_amount', 'Insurance Subsidy Amount','currency', 'insurance',      936, 'half'),
      ('contacts', 'has_spouse',               'Has Spouse',              'boolean',  'family_spouse',  937, 'half'),
      ('contacts', 'has_kids',                 'Has Children',            'boolean',  'family_children',938, 'half'),

      -- members
      ('members',  'age',                      'Age',                     'number',   'core',           920, 'half'),
      ('members',  'fax',                      'Fax',                     'phone',    'core',           921, 'half'),
      ('members',  'mobile_2',                 'Mobile 2',                'phone',    'core',           922, 'half'),
      ('members',  'contact_category',         'Contact Category',        'text',     'core',           923, 'half'),
      ('members',  'converted_from_lead_id',   'Converted From Lead ID',  'text',     'core',           924, 'half'),
      ('members',  'converted_member_id',      'Converted Member ID',     'text',     'core',           925, 'half'),

      -- leads
      ('leads',    'advisor',                  'Advisor',                 'text',     'management',     920, 'half'),
      ('leads',    'agent',                    'Agent',                   'text',     'management',     921, 'half'),
      ('leads',    'converted_date',           'Converted Date',          'date',     'conversion',     922, 'half'),
      ('leads',    'converted_contact_id',     'Converted Contact ID',    'text',     'conversion',     923, 'half'),
      ('leads',    'converted_member_id',      'Converted Member ID',     'text',     'conversion',     924, 'half'),
      ('leads',    'insurance_effective_date', 'Insurance Effective Date','date',     'health_insurance',925,'half'),
      ('leads',    'insurance_subsidy_amount', 'Insurance Subsidy Amount','currency', 'health_insurance',926,'half'),
      ('leads',    'original_start_date',      'Original Start Date',     'date',     'system',         927, 'half'),
      ('leads',    'current_year_start_date',  'Current Year Start Date', 'date',     'system',         928, 'half'),
      ('leads',    'cancellation_date',        'Cancellation Date',       'date',     'system',         929, 'half')
    ) AS t(module_key, field_key, label, field_type, section, display_order, width)
  LOOP
    SELECT id, org_id INTO v_module_id, v_org_id
    FROM crm_modules WHERE key = r.module_key ORDER BY created_at NULLS LAST LIMIT 1;
    IF v_module_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO crm_fields (
      org_id, organization_id, module_id, key, label, type,
      required, is_system, display_order, section, options, width, metadata
    ) VALUES (
      v_org_id, v_org_id, v_module_id, r.field_key, r.label, r.field_type,
      false, false, r.display_order, r.section, '[]'::jsonb, r.width,
      jsonb_build_object('source', 'legacy_visibility_restore_r2')
    )
    ON CONFLICT (module_id, key) DO NOTHING;
    IF FOUND THEN v_added := v_added + 1; END IF;
  END LOOP;

  -- The second, capital-L "Leads" module belongs to a different (demo) org and
  -- had zero definitions, so both of its records rendered completely blank.
  SELECT id, org_id INTO v_module_id, v_org_id
  FROM crm_modules WHERE key = 'Leads' ORDER BY created_at NULLS LAST LIMIT 1;

  IF v_module_id IS NOT NULL THEN
    FOR r IN
      SELECT * FROM (VALUES
        ('first_name',       'First Name',       'text',     901),
        ('last_name',        'Last Name',        'text',     902),
        ('email',            'Email',            'email',    903),
        ('phone',            'Phone',            'phone',    904),
        ('company',          'Company',          'text',     905),
        ('product_interest', 'Product Interest', 'text',     906),
        ('notes',            'Notes',            'textarea', 907)
      ) AS t(field_key, label, field_type, display_order)
    LOOP
      INSERT INTO crm_fields (
        org_id, organization_id, module_id, key, label, type,
        required, is_system, display_order, section, options, width, metadata
      ) VALUES (
        v_org_id, v_org_id, v_module_id, r.field_key, r.label, r.field_type,
        false, false, r.display_order, 'core', '[]'::jsonb,
        CASE WHEN r.field_key = 'notes' THEN 'full' ELSE 'half' END,
        jsonb_build_object('source', 'legacy_visibility_restore_r2')
      )
      ON CONFLICT (module_id, key) DO NOTHING;
      IF FOUND THEN v_added := v_added + 1; END IF;
    END LOOP;
  END IF;

  RAISE NOTICE 'round-2 legacy field definitions added: %', v_added;
END $$;
