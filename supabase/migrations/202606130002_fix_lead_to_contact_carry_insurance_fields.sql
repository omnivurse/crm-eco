-- Fix: Lead → Contact conversion was dropping insurance / health sharing fields.
-- ADDITIVE / CREATE OR REPLACE only. Includes one-time backfill for already-converted contacts.

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
    'start_date',       COALESCE(v_lead_data->>'start_date', to_char(v_start_date, 'YYYY-MM-DD')),
    'health_insurance_start_date', v_lead_data->>'health_insurance_start_date',
    'health_insurance_end_date', v_lead_data->>'health_insurance_end_date',
    'health_insurance_plan_name', v_lead_data->>'health_insurance_plan_name',
    'health_insurance_carrier', v_lead_data->>'health_insurance_carrier',
    'health_insurance_premium', v_lead_data->>'health_insurance_premium',
    'health_insurance_status', v_lead_data->>'health_insurance_status',
    'health_insurance_deductible', v_lead_data->>'health_insurance_deductible',
    'sharing_entity', v_lead_data->>'sharing_entity',
    'carrier', v_lead_data->>'carrier',
    'group_name', v_lead_data->>'group_name',
    'tobacco_user', v_lead_data->>'tobacco_user',
    'member_tier', v_lead_data->>'member_tier',
    'monthly_contribution', v_lead_data->>'monthly_contribution',
    'iua_amount', v_lead_data->>'iua_amount',
    'sharing_effective_date', v_lead_data->>'sharing_effective_date',
    'sharing_status', v_lead_data->>'sharing_status',
    'sharing_member_id', v_lead_data->>'sharing_member_id',
    'previous_membership', v_lead_data->>'previous_membership',
    'previous_product', v_lead_data->>'previous_product',
    'add_on_product', v_lead_data->>'add_on_product',
    'vision', v_lead_data->>'vision',
    'dental', v_lead_data->>'dental',
    'insurance_effective_date', v_lead_data->>'insurance_effective_date',
    'contact_status',   v_contact_status,
    'converted_from_lead_id', p_lead_record_id::text
  );

  -- Catch any additional insurance keys on the lead that were not explicitly listed above.
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

-- Repair a single converted contact by copying missing fields from its linked lead.
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
    'sharing_effective_date', 'insurance_effective_date'
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

  -- Insurance / health-sharing keys first (explicit list for indexed-column side effects below).
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO v_patch
  FROM jsonb_each(v_lead_data) e(k, v)
  WHERE k = ANY(v_insurance_keys)
    AND NOT public._crm_jsonb_value_is_blank(v)
    AND public._crm_jsonb_value_is_blank(v_contact_data -> k);

  -- Also backfill any other lead keys the old conversion whitelist dropped (address, family, etc.).
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO v_full_patch
  FROM jsonb_each(v_lead_data) e(k, v)
  WHERE NOT (k = ANY(v_lead_only_keys))
    AND NOT public._crm_jsonb_value_is_blank(v)
    AND public._crm_jsonb_value_is_blank(v_contact_data -> k);

  -- Normalize lead address keys to contact mailing_* when contact side is blank.
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

  IF (v_patch->>'sharing_entity') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_sharing_carrier_id := (v_patch->>'sharing_entity')::uuid;
  ELSIF (v_contact_data->>'sharing_entity') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_sharing_carrier_id := (v_contact_data->>'sharing_entity')::uuid;
  END IF;

  IF v_full_patch = '{}'::jsonb
     AND v_contact.carrier_id IS NOT NULL
     AND v_contact.market_type IS NOT NULL
     AND v_contact.group_name IS NOT NULL THEN
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
          WHEN NOT public._crm_jsonb_value_is_blank(COALESCE(v_patch -> 'sharing_entity', v_contact_data -> 'sharing_entity'))
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

-- Batch repair for all previously converted contacts (safe to re-run; only fills blanks).
CREATE OR REPLACE FUNCTION public.backfill_all_converted_contact_insurance_data(p_limit integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contact_id uuid;
  v_repaired     integer := 0;
  v_skipped      integer := 0;
  v_errors       jsonb := '[]'::jsonb;
  v_result       jsonb;
BEGIN
  FOR v_contact_id IN
    SELECT DISTINCT c.id
    FROM crm_records c
    INNER JOIN crm_modules mc ON mc.id = c.module_id AND mc.key = 'contacts'
    WHERE c.data->>'converted_from_lead_id' IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM crm_record_links rl
         WHERE rl.link_type = 'lead_to_contact'
           AND rl.target_record_id = c.id
       )
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT p_limit
  LOOP
    BEGIN
      v_result := public.repair_converted_contact_insurance_data(v_contact_id);
      IF COALESCE(v_result->>'success', 'false') = 'true'
         AND COALESCE(v_result->'added_keys', '{}'::jsonb) <> '{}'::jsonb THEN
        v_repaired := v_repaired + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('contact_id', v_contact_id, 'error', SQLERRM)
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'repaired', v_repaired,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_all_converted_contact_insurance_data(integer) TO authenticated;

-- One-time backfill at deploy time (non-destructive; only fills blank contact fields).
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
          'carrier', 'sharing_entity', 'group_name', 'tobacco_user',
          'member_tier', 'monthly_contribution', 'iua_amount',
          'sharing_effective_date', 'sharing_status', 'sharing_member_id',
          'previous_membership', 'previous_product', 'add_on_product',
          'vision', 'dental',
          'health_insurance_carrier', 'insurance_carrier', 'carrier_name',
          'health_insurance_start_date', 'health_insurance_end_date',
          'health_insurance_plan_name', 'health_insurance_premium',
          'health_insurance_status', 'health_insurance_deductible',
          'insurance_effective_date'
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
  market_type = COALESCE(
    c.market_type,
    sp.lead_market_type,
    CASE
      WHEN NOT public._crm_jsonb_value_is_blank(sp.patch -> 'sharing_entity')
        OR NOT public._crm_jsonb_value_is_blank(sp.patch -> 'carrier')
      THEN 'healthshare'
      ELSE NULL
    END
  ),
  carrier_id = COALESCE(
    c.carrier_id,
    sp.lead_carrier_id,
    CASE
      WHEN (sp.patch->>'sharing_entity') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (sp.patch->>'sharing_entity')::uuid
      ELSE NULL
    END
  ),
  tobacco_user = COALESCE(
    c.tobacco_user,
    CASE
      WHEN lower(btrim(sp.patch->>'tobacco_user')) IN ('true', 't', 'yes', '1') THEN true
      WHEN lower(btrim(sp.patch->>'tobacco_user')) IN ('false', 'f', 'no', '0') THEN false
      ELSE NULL
    END
  ),
  group_name = COALESCE(c.group_name, sp.patch->>'group_name'),
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
