-- Fix convert_lead_to_contact: jsonb_build_object exceeded Postgres 100-arg limit.
-- Root cause: ~58 key/value pairs in one jsonb_build_object call → RPC always failed.
-- Fix: copy lead data with renames/overlays instead of a giant static jsonb_build_object.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(
  p_lead_record_id uuid,
  p_user_id uuid,
  p_merge_into_contact_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_record           crm_records%ROWTYPE;
  v_org_id                uuid;
  v_leads_module_id       uuid;
  v_contacts_module_id    uuid;
  v_lead_data             jsonb;
  v_contact_data          jsonb;
  v_contact_title         text;
  v_new_contact_id        uuid;
  v_existing_contact_id   uuid;
  v_existing_data         jsonb;
  v_start_date            date;
  v_contact_status        text;
  v_sharing_carrier_id    uuid;
  v_market_type           text;
  v_insurance_keys        text[] := ARRAY[
    'carrier', 'sharing_entity', 'group_name', 'tobacco_user',
    'iua_amount', 'monthly_contribution', 'member_tier',
    'sharing_status', 'sharing_member_id', 'previous_membership',
    'previous_product', 'add_on_product', 'vision', 'dental',
    'health_insurance_carrier', 'insurance_carrier', 'carrier_name',
    'health_insurance_end_date', 'health_insurance_plan_name',
    'health_insurance_premium', 'health_insurance_status', 'health_insurance_deductible'
  ];
BEGIN
  SELECT * INTO v_lead_record FROM crm_records WHERE id = p_lead_record_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead record not found');
  END IF;

  v_org_id    := v_lead_record.organization_id;
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
  WHERE m.organization_id = v_org_id AND m.key = 'contacts' AND m.is_enabled = true
  LIMIT 1;

  IF v_contacts_module_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contacts module not found or is disabled');
  END IF;

  v_start_date := COALESCE(
    public._parse_import_date(v_lead_data->>'current_year_start_date'),
    public._parse_import_date(v_lead_data->>'original_start_date'),
    public._parse_import_date(v_lead_data->>'health_insurance_start_date'),
    public._parse_import_date(v_lead_data->>'start_date'),
    public._parse_import_date(v_lead_data->>'sharing_effective_date'),
    public._parse_import_date(v_lead_data->>'insurance_effective_date'),
    public._parse_import_date(v_lead_data->>'effective_date'),
    v_lead_record.current_year_start_date,
    v_lead_record.original_start_date
  );

  v_contact_status := CASE
    WHEN v_start_date IS NOT NULL AND v_start_date > CURRENT_DATE THEN 'Pending'
    ELSE 'Active'
  END;

  IF (v_lead_data->>'sharing_entity') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_sharing_carrier_id := (v_lead_data->>'sharing_entity')::uuid;
  END IF;

  v_market_type := COALESCE(
    v_lead_record.market_type,
    CASE
      WHEN NULLIF(btrim(v_lead_data->>'sharing_entity'), '') IS NOT NULL
        OR NULLIF(btrim(v_lead_data->>'carrier'), '') IS NOT NULL THEN 'healthshare'
      ELSE NULL
    END
  );

  -- Copy lead JSONB, drop lead-only keys, apply contact field renames.
  -- Avoids jsonb_build_object's 100-argument limit while preserving custom fields.
  v_contact_data := v_lead_data - ARRAY[
    'company', 'street', 'city', 'state', 'zip_code', 'product_type',
    'is_converted', 'converted_contact_id', 'converted_date', 'lead_status',
    'converted_member_id'
  ];

  v_contact_data := v_contact_data
    || jsonb_strip_nulls(jsonb_build_object(
      'company_association', v_lead_data->>'company',
      'mailing_street', v_lead_data->>'street',
      'mailing_city', v_lead_data->>'city',
      'mailing_state', v_lead_data->>'state',
      'mailing_zip', v_lead_data->>'zip_code',
      'product', v_lead_data->>'product_type'
    ))
    || jsonb_build_object(
      'start_date', COALESCE(v_lead_data->>'start_date', to_char(v_start_date, 'YYYY-MM-DD')),
      'contact_status', v_contact_status,
      'converted_from_lead_id', p_lead_record_id::text
    );

  v_contact_data := v_contact_data || COALESCE((
    SELECT jsonb_object_agg(k, v)
    FROM jsonb_each(v_lead_data) e(k, v)
    WHERE k = ANY(v_insurance_keys)
      AND NOT public._crm_jsonb_value_is_blank(v)
      AND public._crm_jsonb_value_is_blank(v_contact_data -> k)
  ), '{}'::jsonb);

  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
    INTO v_contact_data
    FROM jsonb_each(v_contact_data) AS x(k, v)
   WHERE NOT public._crm_jsonb_value_is_blank(v);

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
      AND organization_id = v_org_id
      AND module_id = v_contacts_module_id;

    IF v_new_contact_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target contact not found');
    END IF;

    UPDATE crm_records
    SET data = (
      SELECT COALESCE(jsonb_object_agg(
        COALESCE(ek.key, nk.key),
        CASE
          WHEN ek.key IS NULL THEN nk.value
          WHEN public._crm_jsonb_value_is_blank(ek.value) THEN nk.value
          ELSE ek.value
        END
      ), '{}'::jsonb)
      FROM jsonb_each(v_existing_data) ek
      FULL OUTER JOIN jsonb_each(v_contact_data) nk ON ek.key = nk.key
      WHERE NOT public._crm_jsonb_value_is_blank(
        CASE
          WHEN ek.key IS NULL THEN nk.value
          WHEN public._crm_jsonb_value_is_blank(ek.value) THEN nk.value
          ELSE ek.value
        END
      )
    ),
    email = COALESCE(NULLIF(email, ''), v_lead_record.email),
    phone = COALESCE(NULLIF(phone, ''), v_lead_record.phone),
    original_start_date = COALESCE(original_start_date, v_start_date),
    current_year_start_date = COALESCE(current_year_start_date, v_start_date),
    market_type = COALESCE(market_type, v_market_type),
    carrier_id = COALESCE(carrier_id, v_lead_record.carrier_id, v_sharing_carrier_id),
    tobacco_user = COALESCE(
      tobacco_user,
      CASE
        WHEN lower(btrim(v_lead_data->>'tobacco_user')) IN ('true', 't', 'yes', '1') THEN true
        WHEN lower(btrim(v_lead_data->>'tobacco_user')) IN ('false', 'f', 'no', '0') THEN false
        ELSE NULL
      END
    ),
    group_name = COALESCE(group_name, v_lead_data->>'group_name'),
    updated_at = now()
    WHERE id = p_merge_into_contact_id;

  ELSE
    IF v_lead_record.email IS NOT NULL AND v_lead_record.email != '' THEN
      SELECT id INTO v_existing_contact_id
      FROM crm_records
      WHERE organization_id = v_org_id
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
      organization_id, module_id, owner_id,
      title, status, email, phone,
      data, created_by, created_at, updated_at,
      original_start_date, current_year_start_date,
      market_type, carrier_id,
      tobacco_user, group_name
    ) VALUES (
      v_org_id,
      v_contacts_module_id,
      v_lead_record.owner_id,
      v_contact_title,
      v_contact_status,
      v_lead_record.email,
      v_lead_record.phone,
      v_contact_data,
      p_user_id,
      now(),
      now(),
      v_start_date,
      v_start_date,
      v_market_type,
      COALESCE(v_lead_record.carrier_id, v_sharing_carrier_id),
      CASE
        WHEN lower(btrim(v_lead_data->>'tobacco_user')) IN ('true', 't', 'yes', '1') THEN true
        WHEN lower(btrim(v_lead_data->>'tobacco_user')) IN ('false', 'f', 'no', '0') THEN false
        ELSE NULL
      END,
      v_lead_data->>'group_name'
    )
    RETURNING id INTO v_new_contact_id;
  END IF;

  UPDATE crm_notes
     SET record_id = v_new_contact_id
   WHERE record_id = p_lead_record_id;

  BEGIN
    UPDATE notes
       SET record_id = v_new_contact_id
     WHERE record_id = p_lead_record_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  INSERT INTO crm_record_links (
    organization_id, source_record_id, target_record_id,
    link_type, is_primary, created_by
  ) VALUES (
    v_org_id, p_lead_record_id, v_new_contact_id,
    'lead_to_contact', true, p_user_id
  );

  UPDATE crm_records
  SET status = 'Converted',
      stage = 'Converted',
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

  INSERT INTO crm_audit_log (organization_id, actor_id, entity, entity_id, action, diff)
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
      'contact_status', v_contact_status,
      'effective_start_date', v_start_date,
      'merged', p_merge_into_contact_id IS NOT NULL,
      'converted_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'contact_id', v_new_contact_id,
    'contact_title', v_contact_title,
    'contact_status', v_contact_status,
    'effective_start_date', v_start_date,
    'lead_id', p_lead_record_id,
    'message', CASE
      WHEN p_merge_into_contact_id IS NOT NULL THEN 'Lead merged into existing contact successfully'
      WHEN v_contact_status = 'Pending' THEN
        'Lead converted to a Pending contact — status will auto-activate on ' || to_char(v_start_date, 'Mon FMDD, YYYY')
      ELSE 'Lead converted to contact successfully'
    END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.convert_lead_to_contact(uuid, uuid, uuid) TO authenticated;
