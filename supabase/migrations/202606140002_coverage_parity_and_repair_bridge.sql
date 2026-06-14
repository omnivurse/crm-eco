-- Coverage field parity (all orgs) + repair RPC bridges carrier_id → sharing_entity.
-- Prevents converted contacts from losing editable insurance / HealthShare UI.

-- --------------------------------------------------------------------------
-- 1. Align Contacts + Members health_sharing fields with Leads (every org)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id        uuid;
  v_leads_id      uuid;
  v_target_id     uuid;
  v_target_key    text;
  v_lead_field    crm_fields%ROWTYPE;
BEGIN
  FOR v_org_id IN SELECT id FROM organizations ORDER BY id LOOP
    SELECT id INTO v_leads_id
    FROM crm_modules
    WHERE organization_id = v_org_id AND key = 'leads' AND is_enabled = true
    LIMIT 1;

    IF v_leads_id IS NULL THEN
      CONTINUE;
    END IF;

      -- Ensure previous_membership exists on Leads (source of truth for copy-down).
      INSERT INTO crm_fields (
        org_id, module_id, key, label, type, required, is_system,
        display_order, section, width, tooltip, metadata
      )
      VALUES (
        v_org_id, v_leads_id, 'previous_membership', 'Previous Membership', 'text',
        false, false, 327, 'health_sharing', 'half', 'Previous health sharing membership / product',
        '{}'::jsonb
      )
      ON CONFLICT (module_id, key) DO UPDATE
      SET section = EXCLUDED.section,
          display_order = EXCLUDED.display_order,
          updated_at = now()
      WHERE crm_fields.section IS DISTINCT FROM EXCLUDED.section;

      FOREACH v_target_key IN ARRAY ARRAY['contacts', 'members'] LOOP
      SELECT id INTO v_target_id
      FROM crm_modules
      WHERE organization_id = v_org_id AND key = v_target_key AND is_enabled = true
      LIMIT 1;

      IF v_target_id IS NULL THEN
        CONTINUE;
      END IF;

      -- Copy coverage field rows from Leads when missing on target module.
      FOR v_lead_field IN
        SELECT *
        FROM crm_fields
        WHERE module_id = v_leads_id
          AND section IN (
            'health_sharing', 'health_insurance', 'dental_coverage',
            'vision_coverage', 'other_coverage', 'life_coverage'
          )
      LOOP
        INSERT INTO crm_fields (
          org_id, module_id, key, label, type, required, is_system,
          display_order, section, width, tooltip, options, validation,
          default_value, metadata
        )
        VALUES (
          v_org_id,
          v_target_id,
          v_lead_field.key,
          v_lead_field.label,
          v_lead_field.type,
          v_lead_field.required,
          v_lead_field.is_system,
          v_lead_field.display_order,
          v_lead_field.section,
          v_lead_field.width,
          v_lead_field.tooltip,
          v_lead_field.options,
          v_lead_field.validation,
          v_lead_field.default_value,
          v_lead_field.metadata
        )
        ON CONFLICT (module_id, key) DO UPDATE
        SET section = EXCLUDED.section,
            label = EXCLUDED.label,
            type = EXCLUDED.type,
            display_order = EXCLUDED.display_order,
            width = EXCLUDED.width,
            tooltip = EXCLUDED.tooltip,
            options = COALESCE(EXCLUDED.options, crm_fields.options),
            metadata = COALESCE(crm_fields.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
            updated_at = now()
        WHERE crm_fields.section IS DISTINCT FROM EXCLUDED.section
           OR crm_fields.display_order IS DISTINCT FROM EXCLUDED.display_order;
      END LOOP;

      -- Legacy contacts may still have iua_amount under `insurance` — move to health_sharing.
      UPDATE crm_fields
      SET section = 'health_sharing',
          display_order = 323,
          updated_at = now()
      WHERE module_id = v_target_id
        AND key = 'iua_amount'
        AND section IS DISTINCT FROM 'health_sharing';
    END LOOP;
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 2. Repair RPC: bridge carrier_id → sharing_entity when JSONB is blank
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repair_converted_contact_insurance_data(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contact     crm_records%ROWTYPE;
  v_lead        crm_records%ROWTYPE;
  v_lead_id     uuid;
  v_lead_data   jsonb;
  v_contact_data jsonb;
  v_patch       jsonb;
  v_full_patch  jsonb;
  v_insurance_keys text[] := ARRAY[
    'carrier', 'sharing_entity', 'group_name', 'tobacco_user',
    'iua_amount', 'monthly_contribution', 'member_tier',
    'sharing_status', 'sharing_member_id', 'previous_membership',
    'previous_product', 'add_on_product', 'vision', 'dental',
    'health_insurance_carrier', 'insurance_carrier', 'carrier_name',
    'health_insurance_start_date', 'health_insurance_end_date',
    'health_insurance_plan_name', 'health_insurance_premium',
    'health_insurance_status', 'health_insurance_deductible',
    'sharing_effective_date', 'insurance_effective_date',
    'product', 'coverage_option', 'monthly_premium', 'start_date'
  ];
  v_lead_only_keys text[] := ARRAY[
    'is_converted', 'converted_date', 'converted_contact_id', 'lead_status'
  ];
  v_sharing_carrier_id uuid;
BEGIN
  SELECT * INTO v_contact FROM crm_records WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact not found');
  END IF;

  v_contact_data := COALESCE(v_contact.data, '{}'::jsonb);
  v_lead_id := NULLIF(v_contact_data->>'converted_from_lead_id', '')::uuid;

  IF v_lead_id IS NULL THEN
    SELECT rl.source_record_id INTO v_lead_id
    FROM crm_record_links rl
    WHERE rl.link_type = 'lead_to_contact'
      AND rl.target_record_id = p_contact_id
    ORDER BY rl.created_at DESC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'contact_id', p_contact_id, 'message', 'No linked lead found');
  END IF;

  SELECT * INTO v_lead FROM crm_records WHERE id = v_lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Linked lead not found');
  END IF;

  v_lead_data := COALESCE(v_lead.data, '{}'::jsonb);

  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO v_patch
  FROM jsonb_each(v_lead_data) e(k, v)
  WHERE k = ANY(v_insurance_keys)
    AND NOT public._crm_jsonb_value_is_blank(v)
    AND public._crm_jsonb_value_is_blank(v_contact_data -> k);

  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO v_full_patch
  FROM jsonb_each(v_lead_data) e(k, v)
  WHERE NOT (k = ANY(v_lead_only_keys))
    AND NOT public._crm_jsonb_value_is_blank(v)
    AND public._crm_jsonb_value_is_blank(v_contact_data -> k);

  IF public._crm_jsonb_value_is_blank(v_contact_data -> 'mailing_street')
     AND NOT public._crm_jsonb_value_is_blank(v_lead_data -> 'street') THEN
    v_full_patch := v_full_patch || jsonb_build_object('mailing_street', v_lead_data -> 'street');
  END IF;
  IF public._crm_jsonb_value_is_blank(v_contact_data -> 'mailing_city')
     AND NOT public._crm_jsonb_value_is_blank(v_lead_data -> 'city') THEN
    v_full_patch := v_full_patch || jsonb_build_object('mailing_city', v_lead_data -> 'city');
  END IF;
  IF public._crm_jsonb_value_is_blank(v_contact_data -> 'mailing_state')
     AND NOT public._crm_jsonb_value_is_blank(v_lead_data -> 'state') THEN
    v_full_patch := v_full_patch || jsonb_build_object('mailing_state', v_lead_data -> 'state');
  END IF;
  IF public._crm_jsonb_value_is_blank(v_contact_data -> 'mailing_zip')
     AND NOT public._crm_jsonb_value_is_blank(v_lead_data -> 'zip_code') THEN
    v_full_patch := v_full_patch || jsonb_build_object('mailing_zip', v_lead_data -> 'zip_code');
  END IF;
  IF public._crm_jsonb_value_is_blank(v_contact_data -> 'product')
     AND NOT public._crm_jsonb_value_is_blank(v_lead_data -> 'product_type') THEN
    v_full_patch := v_full_patch || jsonb_build_object('product', v_lead_data -> 'product_type');
  END IF;

  v_full_patch := v_full_patch || v_patch;

  -- Indexed carrier_id without JSONB sharing_entity breaks inline Health Share UI.
  IF public._crm_jsonb_value_is_blank(v_contact_data -> 'sharing_entity')
     AND public._crm_jsonb_value_is_blank(v_full_patch -> 'sharing_entity')
     AND v_contact.carrier_id IS NOT NULL THEN
    v_full_patch := v_full_patch || jsonb_build_object('sharing_entity', v_contact.carrier_id::text);
  END IF;

  IF (v_patch->>'sharing_entity') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_sharing_carrier_id := (v_patch->>'sharing_entity')::uuid;
  ELSIF (v_contact_data->>'sharing_entity') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_sharing_carrier_id := (v_contact_data->>'sharing_entity')::uuid;
  ELSIF v_contact.carrier_id IS NOT NULL THEN
    v_sharing_carrier_id := v_contact.carrier_id;
  END IF;

  IF v_full_patch = '{}'::jsonb
     AND v_contact.carrier_id IS NOT NULL
     AND v_contact.market_type IS NOT NULL
     AND v_contact.group_name IS NOT NULL
     AND NOT public._crm_jsonb_value_is_blank(v_contact_data -> 'sharing_entity') THEN
    RETURN jsonb_build_object(
      'success', true,
      'contact_id', p_contact_id,
      'lead_id', v_lead_id,
      'added_keys', v_full_patch,
      'message', 'Nothing to repair'
    );
  END IF;

  UPDATE crm_records c
  SET data = c.data || v_full_patch,
      market_type = COALESCE(
        c.market_type,
        v_lead.market_type,
        CASE
          WHEN NOT public._crm_jsonb_value_is_blank(COALESCE(v_patch -> 'sharing_entity', v_contact_data -> 'sharing_entity', v_full_patch -> 'sharing_entity'))
            OR NOT public._crm_jsonb_value_is_blank(COALESCE(v_patch -> 'carrier', v_contact_data -> 'carrier'))
          THEN 'healthshare'
          ELSE NULL
        END
      ),
      carrier_id = COALESCE(c.carrier_id, v_lead.carrier_id, v_sharing_carrier_id),
      tobacco_user = COALESCE(
        c.tobacco_user,
        CASE
          WHEN lower(btrim(v_lead_data->>'tobacco_user')) IN ('true', 't', 'yes', '1') THEN true
          WHEN lower(btrim(v_lead_data->>'tobacco_user')) IN ('false', 'f', 'no', '0') THEN false
          ELSE NULL
        END
      ),
      group_name = COALESCE(c.group_name, v_lead_data->>'group_name'),
      original_start_date = COALESCE(
        c.original_start_date,
        public._parse_import_date(COALESCE(v_patch->>'sharing_effective_date', v_lead_data->>'sharing_effective_date'))
      ),
      current_year_start_date = COALESCE(
        c.current_year_start_date,
        public._parse_import_date(COALESCE(v_patch->>'sharing_effective_date', v_lead_data->>'sharing_effective_date'))
      ),
      updated_at = now()
  WHERE c.id = p_contact_id;

  RETURN jsonb_build_object(
    'success', true,
    'contact_id', p_contact_id,
    'lead_id', v_lead_id,
    'added_keys', v_full_patch
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_converted_contact_insurance_data(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
