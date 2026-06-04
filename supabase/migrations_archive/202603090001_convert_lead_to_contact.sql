-- ============================================================================
-- Lead-to-Contact Conversion RPC
-- Converts a CRM lead record into a CRM contact record within the same org.
-- Maps fields, creates a record link, marks the lead as converted, and audits.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(
  p_lead_record_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_record     crm_records%ROWTYPE;
  v_org_id          uuid;
  v_leads_module_id uuid;
  v_contacts_module_id uuid;
  v_lead_data       jsonb;
  v_contact_data    jsonb;
  v_contact_title   text;
  v_new_contact_id  uuid;
  v_existing_contact_id uuid;
BEGIN
  -- 1. Fetch the lead record
  SELECT * INTO v_lead_record
  FROM crm_records
  WHERE id = p_lead_record_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead record not found');
  END IF;

  v_org_id    := v_lead_record.org_id;
  v_lead_data := COALESCE(v_lead_record.data, '{}'::jsonb);

  -- 2. Verify the record belongs to a leads module
  SELECT m.id INTO v_leads_module_id
  FROM crm_modules m
  WHERE m.id = v_lead_record.module_id
    AND m.key = 'leads';

  IF v_leads_module_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record does not belong to a Leads module');
  END IF;

  -- 3. Guard: already converted
  IF v_lead_record.status = 'Converted'
     OR v_lead_data->>'is_converted' = 'true' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This lead has already been converted',
      'converted_contact_id', v_lead_data->>'converted_contact_id'
    );
  END IF;

  -- 4. Look up the contacts module for the same org
  SELECT m.id INTO v_contacts_module_id
  FROM crm_modules m
  WHERE m.org_id = v_org_id
    AND m.key = 'contacts'
    AND m.is_enabled = true
  LIMIT 1;

  IF v_contacts_module_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contacts module not found or is disabled');
  END IF;

  -- 5. Check for duplicate contact by email
  IF v_lead_record.email IS NOT NULL AND v_lead_record.email != '' THEN
    SELECT id INTO v_existing_contact_id
    FROM crm_records
    WHERE org_id = v_org_id
      AND module_id = v_contacts_module_id
      AND LOWER(email) = LOWER(v_lead_record.email)
    LIMIT 1;

    IF v_existing_contact_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'A contact with email ' || v_lead_record.email || ' already exists',
        'existing_contact_id', v_existing_contact_id
      );
    END IF;
  END IF;

  -- 6. Build contact data JSONB with field mapping
  v_contact_data := jsonb_build_object(
    -- Direct copy (same keys in both modules)
    'salutation',       v_lead_data->>'salutation',
    'first_name',       v_lead_data->>'first_name',
    'last_name',        v_lead_data->>'last_name',
    'email',            v_lead_data->>'email',
    'phone',            v_lead_data->>'phone',
    'mobile',           v_lead_data->>'mobile',
    'date_of_birth',    v_lead_data->>'date_of_birth',
    'lead_source',      v_lead_data->>'lead_source',
    'owner_id',         v_lead_data->>'owner_id',
    'coverage_option',  v_lead_data->>'coverage_option',
    'spouse',           v_lead_data->>'spouse',
    'spouse_dob',       v_lead_data->>'spouse_dob',
    'child_1',          v_lead_data->>'child_1',
    'child_1_dob',      v_lead_data->>'child_1_dob',
    'child_2',          v_lead_data->>'child_2',
    'child_2_dob',      v_lead_data->>'child_2_dob',
    'child_3',          v_lead_data->>'child_3',
    'child_3_dob',      v_lead_data->>'child_3_dob',
    'child_4',          v_lead_data->>'child_4',
    'child_4_dob',      v_lead_data->>'child_4_dob',
    'child_5',          v_lead_data->>'child_5',
    'child_5_dob',      v_lead_data->>'child_5_dob',
    'referring_member',  v_lead_data->>'referring_member',
    'email_opt_out',    v_lead_data->>'email_opt_out',
    'tag',              v_lead_data->>'tag',
    -- Key-mapped fields (lead key → contact key)
    'company_association', v_lead_data->>'company',
    'mailing_street',     v_lead_data->>'street',
    'mailing_city',       v_lead_data->>'city',
    'mailing_state',      v_lead_data->>'state',
    'mailing_zip',        v_lead_data->>'zip_code',
    'product',            v_lead_data->>'product_type',
    -- Derived fields
    'contact_status',          'Active',
    'converted_from_lead_id',  p_lead_record_id::text
  );

  -- Strip null / empty values to keep JSONB clean
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
  INTO v_contact_data
  FROM jsonb_each(v_contact_data) AS x(k, v)
  WHERE v IS DISTINCT FROM 'null'::jsonb
    AND v::text != '""';

  -- 7. Build contact title
  v_contact_title := TRIM(
    COALESCE(v_lead_data->>'first_name', '') || ' ' || COALESCE(v_lead_data->>'last_name', '')
  );
  IF v_contact_title = '' THEN
    v_contact_title := 'Converted Lead';
  END IF;

  -- 8. Insert new contact record
  INSERT INTO crm_records (
    org_id, module_id, owner_id,
    title, status, email, phone,
    data, created_by, created_at, updated_at
  ) VALUES (
    v_org_id,
    v_contacts_module_id,
    v_lead_record.owner_id,
    v_contact_title,
    'Active',
    v_lead_record.email,
    v_lead_record.phone,
    v_contact_data,
    p_user_id,
    now(),
    now()
  )
  RETURNING id INTO v_new_contact_id;

  -- 9. Create record link: lead → contact
  INSERT INTO crm_record_links (
    org_id, source_record_id, target_record_id,
    link_type, is_primary, created_by
  ) VALUES (
    v_org_id,
    p_lead_record_id,
    v_new_contact_id,
    'lead_to_contact',
    true,
    p_user_id
  );

  -- 10. Update the lead record: mark as converted
  UPDATE crm_records
  SET status = 'Converted',
      data = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(data, '{}'::jsonb),
              '{is_converted}', 'true'::jsonb
            ),
            '{converted_date}', to_jsonb(to_char(now(), 'YYYY-MM-DD'))
          ),
          '{converted_contact_id}', to_jsonb(v_new_contact_id::text)
        ),
        '{lead_status}', '"Converted"'::jsonb
      ),
      updated_at = now()
  WHERE id = p_lead_record_id;

  -- 11. Audit log
  INSERT INTO crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
  VALUES (
    v_org_id,
    p_user_id,
    'lead',
    p_lead_record_id,
    'update',
    jsonb_build_object(
      'action', 'convert_to_contact',
      'converted_contact_id', v_new_contact_id,
      'contact_title', v_contact_title,
      'converted_at', now()
    )
  );

  -- 12. Return success
  RETURN jsonb_build_object(
    'success', true,
    'contact_id', v_new_contact_id,
    'contact_title', v_contact_title,
    'lead_id', p_lead_record_id,
    'message', 'Lead converted to contact successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute to authenticated users (RLS bypass via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.convert_lead_to_contact(uuid, uuid) TO authenticated;
