-- ============================================================================
-- Phone ownership on Leads & Contacts
--
-- Adds gender-neutral "Whose number?" selects (+ optional owner name) next to
-- phone/mobile/phone2/work_phone/mobile_2 so reps stop stuffing initials into
-- dialable values. Fixes several phone-like fields that were typed as `text`.
--
-- Values live in crm_records.data JSONB. Primary Call/SMS still uses
-- crm_records.phone / data.phone — unchanged.
--
-- Owner options: Self | Spouse / Partner | Parent / Guardian | Child / Dependent | Other
--
-- Idempotent: INSERT ON CONFLICT DO NOTHING; UPDATEs are keyed and safe to re-run.
-- Loops every org's contacts/leads modules.
--
-- Rollback:
--   DELETE FROM crm_fields
--   WHERE key IN (
--     'phone_owner','phone_owner_name','mobile_owner','mobile_owner_name',
--     'work_phone_owner','phone2_owner','phone2_owner_name',
--     'mobile_2_owner','mobile_2_owner_name'
--   );
--   UPDATE crm_fields SET type = 'text'
--   WHERE key IN (
--     'mobile','work_phone','spouse_phone_number',
--     'child_1_phone_number','child_2_phone_number','child_3_phone_number',
--     'child_4_phone_number','child_5_phone_number','mobile_2'
--   )
--   AND type = 'phone';
-- ============================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_org_id uuid;
  v_contacts int := 0;
  v_leads int := 0;
  v_owner_opts jsonb :=
    '["Self","Spouse / Partner","Parent / Guardian","Child / Dependent","Other"]'::jsonb;
  v_owner_tip text :=
    'Who uses this number? Keep digits clean — put names in Owner Name.';
BEGIN
  -- ── Contacts ────────────────────────────────────────────────────────────
  FOR v_module_id, v_org_id IN
    SELECT id, org_id FROM crm_modules WHERE key = 'contacts'
  LOOP
    -- Pair phone lines with owner selects (half + half) and optional name.
    UPDATE crm_fields
    SET
      type = CASE key
        WHEN 'mobile' THEN 'phone'
        WHEN 'work_phone' THEN 'phone'
        WHEN 'spouse_phone_number' THEN 'phone'
        WHEN 'child_1_phone_number' THEN 'phone'
        WHEN 'child_2_phone_number' THEN 'phone'
        WHEN 'child_3_phone_number' THEN 'phone'
        WHEN 'child_4_phone_number' THEN 'phone'
        WHEN 'child_5_phone_number' THEN 'phone'
        WHEN 'mobile_2' THEN 'phone'
        ELSE type
      END,
      width = CASE key
        WHEN 'phone' THEN 'half'
        WHEN 'mobile' THEN 'half'
        WHEN 'work_phone' THEN 'half'
        WHEN 'fax' THEN 'half'
        WHEN 'phone2' THEN 'half'
        WHEN 'mobile_2' THEN 'half'
        ELSE width
      END,
      display_order = CASE key
        WHEN 'phone' THEN 10
        WHEN 'mobile' THEN 13
        WHEN 'work_phone' THEN 16
        WHEN 'fax' THEN 18
        WHEN 'mobile_2' THEN 26
        WHEN 'phone2' THEN 912
        ELSE display_order
      END,
      updated_at = now()
    WHERE module_id = v_module_id
      AND key IN (
        'phone','mobile','work_phone','fax','phone2','mobile_2',
        'spouse_phone_number',
        'child_1_phone_number','child_2_phone_number','child_3_phone_number',
        'child_4_phone_number','child_5_phone_number'
      );

    INSERT INTO crm_fields (
      org_id, organization_id, module_id, key, label, type,
      required, is_system, display_order, section, options, width, tooltip
    )
    VALUES
      (v_org_id, v_org_id, v_module_id, 'phone_owner', 'Phone Belongs To', 'select',
       false, false, 11, 'core', v_owner_opts, 'half', v_owner_tip),
      (v_org_id, v_org_id, v_module_id, 'phone_owner_name', 'Phone Owner Name', 'text',
       false, false, 12, 'core', '[]'::jsonb, 'full',
       'Optional short name when the number is not Self (e.g. Alex).'),
      (v_org_id, v_org_id, v_module_id, 'mobile_owner', 'Mobile Belongs To', 'select',
       false, false, 14, 'core', v_owner_opts, 'half', v_owner_tip),
      (v_org_id, v_org_id, v_module_id, 'mobile_owner_name', 'Mobile Owner Name', 'text',
       false, false, 15, 'core', '[]'::jsonb, 'full',
       'Optional short name when the number is not Self (e.g. Alex).'),
      (v_org_id, v_org_id, v_module_id, 'work_phone_owner', 'Work Phone Belongs To', 'select',
       false, false, 17, 'core', v_owner_opts, 'half', v_owner_tip),
      (v_org_id, v_org_id, v_module_id, 'phone2_owner', 'Phone 2 Belongs To', 'select',
       false, false, 913, 'core', v_owner_opts, 'half', v_owner_tip),
      (v_org_id, v_org_id, v_module_id, 'phone2_owner_name', 'Phone 2 Owner Name', 'text',
       false, false, 914, 'core', '[]'::jsonb, 'full',
       'Optional short name when the number is not Self (e.g. Alex).'),
      (v_org_id, v_org_id, v_module_id, 'mobile_2_owner', 'Mobile 2 Belongs To', 'select',
       false, false, 27, 'contact', v_owner_opts, 'half', v_owner_tip),
      (v_org_id, v_org_id, v_module_id, 'mobile_2_owner_name', 'Mobile 2 Owner Name', 'text',
       false, false, 28, 'contact', '[]'::jsonb, 'full',
       'Optional short name when the number is not Self (e.g. Alex).')
    ON CONFLICT (module_id, key) DO NOTHING;

    v_contacts := v_contacts + 1;
  END LOOP;

  -- ── Leads ───────────────────────────────────────────────────────────────
  FOR v_module_id, v_org_id IN
    SELECT id, org_id FROM crm_modules WHERE key = 'leads'
  LOOP
    UPDATE crm_fields
    SET
      type = CASE key
        WHEN 'mobile' THEN 'phone'
        WHEN 'mobile_2' THEN 'phone'
        ELSE type
      END,
      width = CASE key
        WHEN 'phone' THEN 'half'
        WHEN 'mobile' THEN 'half'
        WHEN 'mobile_2' THEN 'half'
        ELSE width
      END,
      display_order = CASE key
        WHEN 'phone' THEN 10
        WHEN 'mobile' THEN 13
        WHEN 'mobile_2' THEN 16
        ELSE display_order
      END,
      updated_at = now()
    WHERE module_id = v_module_id
      AND key IN ('phone', 'mobile', 'mobile_2');

    INSERT INTO crm_fields (
      org_id, organization_id, module_id, key, label, type,
      required, is_system, display_order, section, options, width, tooltip
    )
    VALUES
      (v_org_id, v_org_id, v_module_id, 'phone_owner', 'Phone Belongs To', 'select',
       false, false, 11, 'core', v_owner_opts, 'half', v_owner_tip),
      (v_org_id, v_org_id, v_module_id, 'phone_owner_name', 'Phone Owner Name', 'text',
       false, false, 12, 'core', '[]'::jsonb, 'full',
       'Optional short name when the number is not Self (e.g. Alex).'),
      (v_org_id, v_org_id, v_module_id, 'mobile_owner', 'Mobile Belongs To', 'select',
       false, false, 14, 'core', v_owner_opts, 'half', v_owner_tip),
      (v_org_id, v_org_id, v_module_id, 'mobile_owner_name', 'Mobile Owner Name', 'text',
       false, false, 15, 'core', '[]'::jsonb, 'full',
       'Optional short name when the number is not Self (e.g. Alex).'),
      (v_org_id, v_org_id, v_module_id, 'mobile_2_owner', 'Mobile 2 Belongs To', 'select',
       false, false, 17, 'core', v_owner_opts, 'half', v_owner_tip),
      (v_org_id, v_org_id, v_module_id, 'mobile_2_owner_name', 'Mobile 2 Owner Name', 'text',
       false, false, 18, 'core', '[]'::jsonb, 'full',
       'Optional short name when the number is not Self (e.g. Alex).')
    ON CONFLICT (module_id, key) DO NOTHING;

    v_leads := v_leads + 1;
  END LOOP;

  RAISE NOTICE
    'Phone owner fields applied to % contacts module(s) and % leads module(s).',
    v_contacts, v_leads;
END $$;
