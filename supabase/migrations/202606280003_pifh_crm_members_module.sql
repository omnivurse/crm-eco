-- Ensure the PIFH org has a CRM 'members' module so the member->CRM sync trigger
-- (sync_member_to_crm_records) actually writes member records into the CRM. The
-- trigger looks up crm_modules WHERE organization_id = org AND key = 'members'
-- and SILENTLY skips if absent — and the base seed only seeds contacts/leads/
-- deals/accounts. Idempotent: safe to re-run.
--
-- NOTE: both org_id and organization_id columns are set to the same value — the
-- sync trigger reads `organization_id`, while crm_fields/crm_modules unique
-- constraints + most code read `org_id`.

DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001';
  v_mod uuid;
BEGIN
  -- Only create if the org actually exists (defensive for non-prod envs).
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RAISE NOTICE 'org % not present; skipping members-module seed', v_org;
    RETURN;
  END IF;

  INSERT INTO public.crm_modules (
    org_id, organization_id, key, name, name_plural, icon, description,
    is_system, is_enabled, display_order
  ) VALUES (
    v_org, v_org, 'members', 'Member', 'Members', 'heart',
    'Health share members synced from enrollment', true, true, 2
  )
  ON CONFLICT (org_id, key) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_mod;

  INSERT INTO public.crm_fields (
    org_id, organization_id, module_id, key, label, type,
    required, is_system, is_indexed, is_pinned, section, display_order, options
  )
  SELECT v_org, v_org, v_mod, f.key, f.label, f.type,
         f.required, f.is_system, f.is_indexed, f.is_pinned, f.section, f.display_order, f.options::jsonb
  FROM (VALUES
    -- core
    ('member_number',  'Member #',       'text',     false, true,  true,  true,  'core',     0,   '[]'),
    ('first_name',     'First Name',     'text',     true,  true,  true,  false, 'core',     1,   '[]'),
    ('last_name',      'Last Name',      'text',     true,  true,  true,  false, 'core',     2,   '[]'),
    ('email',          'Email',          'email',    true,  true,  true,  false, 'core',     3,   '[]'),
    ('phone',          'Phone',          'phone',    false, true,  true,  false, 'core',     4,   '[]'),
    ('date_of_birth',  'Date of Birth',  'date',     false, true,  false, false, 'core',     5,   '[]'),
    ('gender',         'Gender',         'select',   false, true,  false, false, 'core',     6,   '["Male","Female","Other","Prefer not to say"]'),
    ('marital_status', 'Marital Status', 'select',   false, true,  false, false, 'core',     7,   '["Single","Married","Divorced","Widowed"]'),
    -- address
    ('address_line1',  'Address',        'text',     false, true,  false, false, 'address',  100, '[]'),
    ('address_line2',  'Address 2',      'text',     false, true,  false, false, 'address',  101, '[]'),
    ('city',           'City',           'text',     false, true,  false, false, 'address',  102, '[]'),
    ('state',          'State',          'text',     false, true,  false, false, 'address',  103, '[]'),
    ('zip_code',       'Zip',            'text',     false, true,  false, false, 'address',  104, '[]'),
    -- coverage
    ('plan_name',      'Plan',           'text',     false, true,  false, false, 'coverage', 200, '[]'),
    ('plan_type',      'Plan Type',      'text',     false, true,  false, false, 'coverage', 201, '[]'),
    ('coverage_type',  'Coverage Type',  'text',     false, true,  false, false, 'coverage', 202, '[]'),
    ('program_type',   'Program Type',   'text',     false, true,  false, false, 'coverage', 203, '[]'),
    ('effective_date', 'Effective Date', 'date',     false, true,  false, false, 'coverage', 204, '[]'),
    ('monthly_share',  'Monthly Share',  'currency', false, true,  false, false, 'coverage', 205, '[]'),
    -- advisor
    ('advisor_code',   'Advisor Code',   'text',     false, true,  true,  true,  'advisor',  300, '[]'),
    ('advisor_name',   'Advisor',        'text',     false, true,  false, false, 'advisor',  301, '[]'),
    ('enrollment_source','Source',       'text',     false, true,  false, false, 'advisor',  302, '[]')
  ) AS f(key, label, type, required, is_system, is_indexed, is_pinned, section, display_order, options)
  ON CONFLICT (module_id, key) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
