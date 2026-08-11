-- ============================================================================
-- Make stored-but-invisible CRM data visible: add missing crm_fields rows.
-- ----------------------------------------------------------------------------
-- The CRM renders exactly the keys that have a crm_fields definition for the
-- record's module (DynamicRecordForm `visibleFields`). List columns, in-record
-- search and CSV export are bound the same way. A Zoho-era value stored under a
-- key with no definition is therefore invisible everywhere — present in the
-- database, but with no slot on screen.
--
-- Verified on prod 2026-08-11: 31,866 real business values were unreachable
-- this way (a further 58,650 are Zoho audit metadata and stay hidden on purpose).
--
-- Two remedies, split by meaning:
--   * Same-concept keys (city vs mailing_city, primary_member_gender vs gender)
--     are handled in code by `legacy-key-projection.ts` — no schema change.
--   * Distinct-concept keys get their OWN definition here, because projecting
--     them into a similarly-named field would corrupt meaning (a birth MONTH is
--     not a date of birth; phone2 is not necessarily a mobile).
--
-- Also seeds the `advisors` module, which had ZERO field definitions and was
-- therefore 100% blank for all 18 of its records.
--
-- MOST URGENT ITEM: `do_not_call` is stored on 2,019 records and was invisible
-- to reps — a live compliance exposure, since a rep could not see that a
-- contact must not be called.
--
-- Additive and idempotent: ON CONFLICT (module_id, key) DO NOTHING.
-- Rollback: DELETE FROM crm_fields WHERE key = ANY(...) AND metadata->>'source'
--           = 'legacy_visibility_restore';
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
      -- module_key, field_key, label, type, section, display_order, width
      ('contacts', 'do_not_call',              'Do Not Call',             'boolean', 'compliance',  901, 'half'),
      ('contacts', 'advisor_code',             'Advisor Code',            'text',    'management',  902, 'half'),
      ('contacts', 'advisor_name',             'Advisor Name',            'text',    'management',  903, 'half'),
      ('contacts', 'producer_id',              'Producer ID',             'text',    'management',  904, 'half'),
      ('contacts', 'member_number',            'Member Number',           'text',    'identifiers', 905, 'half'),
      ('contacts', 'internal_id',              'Internal ID',             'text',    'identifiers', 906, 'half'),
      ('contacts', 'cancellation_reason',      'Cancellation Reason',     'text',    'fulfillment', 907, 'full'),
      ('contacts', 'scheduled_cancel_end_date','Scheduled Cancel End Date','date',   'fulfillment', 908, 'half'),
      ('contacts', 'address_line2',            'Address Line 2',          'text',    'address',     909, 'full'),
      ('contacts', 'birth_month',              'Birth Month',             'text',    'personal',    910, 'half'),
      ('contacts', 'middle_initial',           'Middle Initial',          'text',    'personal',    911, 'half'),
      ('contacts', 'phone2',                   'Phone 2',                 'phone',   'core',        912, 'half'),

      ('members',  'do_not_call',              'Do Not Call',             'boolean', 'core',        901, 'half'),
      ('members',  'referral',                 'Referral',                'text',    'core',        902, 'half'),
      ('members',  'source',                   'Source',                  'text',    'core',        903, 'half'),
      ('members',  'company_name',             'Company Name',            'text',    'core',        904, 'half'),
      ('members',  'phone2',                   'Phone 2',                 'phone',   'core',        905, 'half'),
      ('members',  'email2',                   'Secondary Email',         'email',   'core',        906, 'half'),
      ('members',  'internal_id',              'Internal ID',             'text',    'core',        907, 'half'),
      ('members',  'advisor_id',               'Advisor ID',              'text',    'advisor',     908, 'half'),

      ('leads',    'producer_name',            'Producer Name',           'text',    'management',  901, 'half'),
      ('leads',    'producer_id',              'Producer ID',             'text',    'management',  902, 'half'),
      ('leads',    'mailing_street',           'Mailing Street',          'text',    'address',     903, 'full'),

      -- advisors module had NO definitions at all -> every record read blank.
      ('advisors', 'first_name',               'First Name',              'text',    'core',        901, 'half'),
      ('advisors', 'last_name',                'Last Name',               'text',    'core',        902, 'half'),
      ('advisors', 'advisor_code',             'Advisor Code',            'text',    'core',        903, 'half'),
      ('advisors', 'agent_role',               'Agent Role',              'text',    'core',        904, 'half'),
      ('advisors', 'enrollment_code',          'Enrollment Code',         'text',    'core',        905, 'half'),
      ('advisors', 'agency_name',              'Agency Name',             'text',    'core',        906, 'half'),
      ('advisors', 'license_number',           'License Number',          'text',    'core',        907, 'half'),
      ('advisors', 'commission_tier',          'Commission Tier',         'text',    'core',        908, 'half')
    ) AS t(module_key, field_key, label, field_type, section, display_order, width)
  LOOP
    SELECT id, org_id INTO v_module_id, v_org_id
    FROM crm_modules
    WHERE key = r.module_key
    ORDER BY created_at NULLS LAST
    LIMIT 1;

    IF v_module_id IS NULL THEN
      RAISE NOTICE 'module % not found, skipping %', r.module_key, r.field_key;
      CONTINUE;
    END IF;

    INSERT INTO crm_fields (
      org_id, organization_id, module_id, key, label, type,
      required, is_system, display_order, section, options, width, metadata
    )
    VALUES (
      v_org_id, v_org_id, v_module_id, r.field_key, r.label, r.field_type,
      false, false, r.display_order, r.section, '[]'::jsonb, r.width,
      jsonb_build_object('source', 'legacy_visibility_restore')
    )
    ON CONFLICT (module_id, key) DO NOTHING;

    IF FOUND THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'legacy field definitions added: %', v_added;
END $$;
