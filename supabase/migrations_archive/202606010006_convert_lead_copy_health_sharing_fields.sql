-- Copy full Health Sharing / Sharing Information from Lead → Contact on conversion,
-- fix merge-into-existing so blank contact fields inherit lead values, and backfill
-- converted contacts that are missing sharing data their lead still has.
-- ADDITIVE / CREATE OR REPLACE only.

CREATE OR REPLACE FUNCTION public._crm_jsonb_value_is_blank(v jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL
    OR v = 'null'::jsonb
    OR v = '""'::jsonb
    OR (jsonb_typeof(v) = 'string' AND btrim(v #>> '{}') = '');
$$;

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
      WHEN NULLIF(btrim(v_lead_data->>'sharing_entity'), '') IS NOT NULL THEN 'healthshare'
      ELSE NULL
    END
  );

  v_contact_data := jsonb_build_object(
    'salutation', v_lead_data->>'salutation',
    'first_name', v_lead_data->>'first_name',
    'last_name', v_lead_data->>'last_name',
    'email', v_lead_data->>'email',
    'phone', v_lead_data->>'phone',
    'mobile', v_lead_data->>'mobile',
    'date_of_birth', v_lead_data->>'date_of_birth',
    'lead_source', v_lead_data->>'lead_source',
    'owner_id', v_lead_data->>'owner_id',
    'coverage_option', v_lead_data->>'coverage_option',
    'product', v_lead_data->>'product_type',
    'start_date', COALESCE(v_lead_data->>'start_date', to_char(v_start_date, 'YYYY-MM-DD')),
    'health_insurance_start_date', v_lead_data->>'health_insurance_start_date',
    'health_insurance_end_date', v_lead_data->>'health_insurance_end_date',
    'health_insurance_plan_name', v_lead_data->>'health_insurance_plan_name',
    'health_insurance_carrier', v_lead_data->>'health_insurance_carrier',
    'health_insurance_premium', v_lead_data->>'health_insurance_premium',
    'health_insurance_status', v_lead_data->>'health_insurance_status',
    'health_insurance_deductible', v_lead_data->>'health_insurance_deductible',
    'sharing_entity', v_lead_data->>'sharing_entity',
    'member_tier', v_lead_data->>'member_tier',
    'monthly_contribution', v_lead_data->>'monthly_contribution',
    'iua_amount', v_lead_data->>'iua_amount',
    'sharing_effective_date', v_lead_data->>'sharing_effective_date',
    'sharing_status', v_lead_data->>'sharing_status',
    'sharing_member_id', v_lead_data->>'sharing_member_id',
    'previous_membership', v_lead_data->>'previous_membership',
    'insurance_effective_date', v_lead_data->>'insurance_effective_date',
    'contact_status', v_contact_status,
    'converted_from_lead_id', p_lead_record_id::text
  );

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
      market_type, carrier_id
    ) VALUES (
      v_org_id, v_contacts_module_id, v_lead_record.owner_id,
      v_contact_title, v_contact_status,
      v_lead_record.email, v_lead_record.phone,
      v_contact_data, p_user_id, now(), now(),
      v_start_date, v_start_date,
      v_market_type,
      COALESCE(v_lead_record.carrier_id, v_sharing_carrier_id)
    )
    RETURNING id INTO v_new_contact_id;
  END IF;

  UPDATE crm_notes SET record_id = v_new_contact_id WHERE record_id = p_lead_record_id;

  BEGIN
    UPDATE notes SET record_id = v_new_contact_id WHERE record_id = p_lead_record_id;
  EXCEPTION WHEN undefined_table THEN NULL;
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
      data = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(COALESCE(data, '{}'::jsonb), '{is_converted}', 'true'::jsonb),
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
    v_org_id, p_user_id, 'lead', p_lead_record_id, 'update',
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

-- Backfill: contacts converted from a lead but missing sharing fields the lead still has.
WITH lead_contact_pairs AS (
  SELECT
    c.id AS contact_id,
    l.id AS lead_id,
    l.data AS lead_data,
    l.market_type AS lead_market_type,
    l.carrier_id AS lead_carrier_id
  FROM crm_records c
  INNER JOIN crm_modules mc ON mc.id = c.module_id AND mc.key = 'contacts'
  INNER JOIN crm_records l ON (
    l.id::text = c.data->>'converted_from_lead_id'
    OR EXISTS (
      SELECT 1
      FROM crm_record_links rl
      WHERE rl.link_type = 'lead_to_contact'
        AND rl.source_record_id = l.id
        AND rl.target_record_id = c.id
    )
  )
  INNER JOIN crm_modules ml ON ml.id = l.module_id AND ml.key = 'leads'
  WHERE c.organization_id = l.organization_id
),
sharing_patch AS (
  SELECT
    p.contact_id,
    p.lead_market_type,
    p.lead_carrier_id,
    COALESCE(
      (
        SELECT jsonb_object_agg(t.k, t.v)
        FROM jsonb_each(p.lead_data) AS t(k, v)
        INNER JOIN crm_records c ON c.id = p.contact_id
        WHERE t.k IN (
          'sharing_entity', 'member_tier', 'monthly_contribution', 'iua_amount',
          'sharing_effective_date', 'sharing_status', 'sharing_member_id', 'previous_membership'
        )
          AND NOT public._crm_jsonb_value_is_blank(t.v)
          AND public._crm_jsonb_value_is_blank(c.data -> t.k)
      ),
      '{}'::jsonb
    ) AS patch
  FROM lead_contact_pairs p
)
UPDATE crm_records c
SET
  data = c.data || sp.patch,
  market_type = COALESCE(c.market_type, sp.lead_market_type, 'healthshare'),
  carrier_id = COALESCE(
    c.carrier_id,
    sp.lead_carrier_id,
    CASE
      WHEN (sp.patch->>'sharing_entity') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (sp.patch->>'sharing_entity')::uuid
      ELSE NULL
    END
  ),
  original_start_date = COALESCE(
    c.original_start_date,
    public._parse_import_date(sp.patch->>'sharing_effective_date')
  ),
  current_year_start_date = COALESCE(
    c.current_year_start_date,
    public._parse_import_date(sp.patch->>'sharing_effective_date')
  ),
  updated_at = now()
FROM sharing_patch sp
WHERE c.id = sp.contact_id
  AND sp.patch <> '{}'::jsonb;
