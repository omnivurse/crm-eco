-- =============================================================================
-- Fix: convert_lead_to_contact RPC fails with `operator does not exist:
-- uuid = text` so every lead conversion attempt errors out.
--
-- Diagnosis:
--   The body of `convert_lead_to_contact` (last edited in
--   `202604100002_fix_convert_lead_merge.sql`) has:
--
--       UPDATE notes
--       SET record_id = v_new_contact_id::text
--       WHERE record_id = p_lead_record_id::text;
--
--   When that migration was written, `public.notes.record_id` was a `text`
--   column and the explicit `::text` casts were correct. The column has
--   since been changed to `uuid` (confirmed live), so:
--     • `record_id = p_lead_record_id::text` is now `uuid = text` → ERROR
--     • `SET record_id = v_new_contact_id::text` would also have errored,
--       but it never gets that far because the WHERE blew up first.
--
--   The function is `EXCEPTION WHEN OTHERS` wrapped, so the route gets back
--   `{success: false, error: 'operator does not exist: uuid = text'}` and
--   the user sees "I can't convert leads."
--
-- Fix: drop the `::text` casts. uuid-to-uuid assignment + comparison works
-- natively. Function logic otherwise byte-identical.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(
  p_lead_record_id uuid,
  p_user_id uuid,
  p_merge_into_contact_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_record        crm_records%ROWTYPE;
  v_org_id             uuid;
  v_leads_module_id    uuid;
  v_contacts_module_id uuid;
  v_lead_data          jsonb;
  v_contact_data       jsonb;
  v_contact_title      text;
  v_new_contact_id     uuid;
  v_existing_contact_id uuid;
  v_existing_data      jsonb;
BEGIN
  SELECT * INTO v_lead_record FROM crm_records WHERE id = p_lead_record_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead record not found');
  END IF;

  v_org_id    := v_lead_record.org_id;
  v_lead_data := COALESCE(v_lead_record.data, '{}'::jsonb);

  SELECT m.id INTO v_leads_module_id
  FROM crm_modules m
  WHERE m.id = v_lead_record.module_id AND m.key = 'leads';

  IF v_leads_module_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record does not belong to a Leads module');
  END IF;

  IF v_lead_record.status = 'Converted'
     OR v_lead_data->>'is_converted' = 'true' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This lead has already been converted',
      'converted_contact_id', v_lead_data->>'converted_contact_id'
    );
  END IF;

  SELECT m.id INTO v_contacts_module_id
  FROM crm_modules m
  WHERE m.org_id = v_org_id AND m.key = 'contacts' AND m.is_enabled = true
  LIMIT 1;

  IF v_contacts_module_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contacts module not found or is disabled');
  END IF;

  v_contact_data := jsonb_build_object(
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
    'referring_member', v_lead_data->>'referring_member',
    'email_opt_out',    v_lead_data->>'email_opt_out',
    'tag',              v_lead_data->>'tag',
    'company_association', v_lead_data->>'company',
    'mailing_street',   v_lead_data->>'street',
    'mailing_city',     v_lead_data->>'city',
    'mailing_state',    v_lead_data->>'state',
    'mailing_zip',      v_lead_data->>'zip_code',
    'product',          v_lead_data->>'product_type',
    'contact_status',   'Active',
    'converted_from_lead_id',  p_lead_record_id::text
  );

  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
    INTO v_contact_data
    FROM jsonb_each(v_contact_data) AS x(k, v)
   WHERE v IS DISTINCT FROM 'null'::jsonb
     AND v::text != '""';

  v_contact_title := TRIM(
    COALESCE(v_lead_data->>'first_name', '') || ' ' || COALESCE(v_lead_data->>'last_name', '')
  );
  IF v_contact_title = '' THEN
    v_contact_title := 'Converted Lead';
  END IF;

  IF p_merge_into_contact_id IS NOT NULL THEN
    SELECT id, COALESCE(data, '{}'::jsonb) INTO v_new_contact_id, v_existing_data
    FROM crm_records
    WHERE id = p_merge_into_contact_id
      AND org_id = v_org_id
      AND module_id = v_contacts_module_id;

    IF v_new_contact_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target contact not found');
    END IF;

    UPDATE crm_records
    SET data = (
      SELECT COALESCE(jsonb_object_agg(
        COALESCE(ek.key, nk.key),
        COALESCE(ek.value, nk.value)
      ), '{}'::jsonb)
      FROM jsonb_each(v_existing_data) ek
      FULL OUTER JOIN jsonb_each(v_contact_data) nk ON ek.key = nk.key
      WHERE COALESCE(ek.value, nk.value) IS DISTINCT FROM 'null'::jsonb
    ),
    email = COALESCE(NULLIF(email, ''), v_lead_record.email),
    phone = COALESCE(NULLIF(phone, ''), v_lead_record.phone),
    updated_at = now()
    WHERE id = p_merge_into_contact_id;

  ELSE
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
  END IF;

  -- Move CRM notes onto the new/merged contact.
  UPDATE crm_notes
     SET record_id = v_new_contact_id
   WHERE record_id = p_lead_record_id;

  -- ── THE FIX ────────────────────────────────────────────────────────────
  -- public.notes.record_id was changed from text → uuid; the previous
  -- `::text` casts now compare uuid against text and Postgres rejects it
  -- (`42883: operator does not exist: uuid = text`). Drop the casts.
  -- ──────────────────────────────────────────────────────────────────────
  BEGIN
    UPDATE notes
       SET record_id = v_new_contact_id
     WHERE record_id = p_lead_record_id;
  EXCEPTION WHEN undefined_table THEN
    -- Legacy `notes` table not present in this DB — skip silently.
    NULL;
  END;

  INSERT INTO crm_record_links (
    org_id, source_record_id, target_record_id,
    link_type, is_primary, created_by
  ) VALUES (
    v_org_id, p_lead_record_id, v_new_contact_id,
    'lead_to_contact', true, p_user_id
  );

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

  INSERT INTO crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
  VALUES (
    v_org_id,
    p_user_id,
    'lead',
    p_lead_record_id,
    'update',
    jsonb_build_object(
      'action', CASE WHEN p_merge_into_contact_id IS NOT NULL THEN 'merge_into_contact' ELSE 'convert_to_contact' END,
      'converted_contact_id', v_new_contact_id,
      'contact_title', v_contact_title,
      'merged', p_merge_into_contact_id IS NOT NULL,
      'converted_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'contact_id', v_new_contact_id,
    'contact_title', v_contact_title,
    'lead_id', p_lead_record_id,
    'message', CASE
      WHEN p_merge_into_contact_id IS NOT NULL THEN 'Lead merged into existing contact successfully'
      ELSE 'Lead converted to contact successfully'
    END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_lead_to_contact(uuid, uuid, uuid) TO authenticated;
