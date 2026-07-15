-- =============================================================================
-- Fix: "Conversion Failed — new row for relation members violates check
--       constraint members_status_check"
-- =============================================================================
--
-- convert_lead_to_member() hardcoded members.status = 'Active' (capitalised).
-- The members_status_check constraint only permits LOWERCASE values
-- (prospect | pending | active | paused | terminated | inactive), so EVERY
-- lead→member conversion failed the insert and surfaced the check-constraint
-- error to the rep.
--
-- This rewrite:
--   * inserts a VALID lowercase status,
--   * sets it to 'pending' when the coverage effective/start date is still in
--     the future (e.g. a plan beginning Aug 1) and 'active' otherwise — so a
--     future-dated plan lands as pending, matching the activate-due-memberships
--     cron that flips pending → active once effective_date arrives,
--   * carries the resolved effective_date and market_type onto the member row.
--
-- Effective-date resolution mirrors resolveEffectiveStartDate() in the app:
-- indexed columns first, then the common JSONB date keys. The regex guard makes
-- the ::date cast safe against malformed values. Everything else in the function
-- is preserved verbatim.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.convert_lead_to_member(p_lead_record_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_record     crm_records%ROWTYPE;
  v_org_id          uuid;
  v_leads_module_id uuid;
  v_lead_data       jsonb;
  v_new_member_id   uuid;
  v_effective_date  date;
  v_market_type     text;
  v_member_status   text;
BEGIN
  SELECT * INTO v_lead_record FROM crm_records WHERE id = p_lead_record_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead record not found');
  END IF;

  v_org_id := v_lead_record.organization_id;
  v_lead_data := COALESCE(v_lead_record.data, '{}'::jsonb);

  SELECT m.id INTO v_leads_module_id
  FROM crm_modules m
  WHERE m.id = v_lead_record.module_id AND m.key = 'leads';

  IF v_leads_module_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record does not belong to a Leads module');
  END IF;

  IF v_lead_record.status = 'Converted'
     OR v_lead_data->>'is_converted' = 'true'
     OR NULLIF(btrim(v_lead_data->>'converted_member_id'), '') IS NOT NULL
     OR NULLIF(btrim(v_lead_data->>'converted_contact_id'), '') IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This lead has already been converted',
      'converted_member_id', v_lead_data->>'converted_member_id',
      'converted_contact_id', v_lead_data->>'converted_contact_id'
    );
  END IF;

  -- Resolve the coverage effective/start date: indexed columns first, then the
  -- common JSONB date keys (priority order preserved via WITH ORDINALITY). The
  -- regex guard means the ::date cast never throws on a malformed value.
  v_effective_date := COALESCE(
    v_lead_record.current_year_start_date,
    v_lead_record.original_start_date,
    (
      SELECT (v_lead_data->>k)::date
      FROM unnest(ARRAY[
        'current_year_start_date','original_start_date','start_date',
        'sharing_effective_date','insurance_effective_date',
        'health_insurance_start_date','effective_date'
      ]) WITH ORDINALITY AS t(k, ord)
      WHERE v_lead_data->>k ~ '^\d{4}-\d{2}-\d{2}'
      ORDER BY ord
      LIMIT 1
    )
  );

  v_market_type := NULLIF(btrim(COALESCE(v_lead_record.market_type, v_lead_data->>'market_type')), '');

  -- members_status_check allows only lowercase values. A plan that has not
  -- started yet is 'pending'; anything already effective (or undated) is 'active'.
  v_member_status := CASE
    WHEN v_effective_date IS NOT NULL AND v_effective_date > CURRENT_DATE THEN 'pending'
    ELSE 'active'
  END;

  IF v_lead_record.email IS NOT NULL AND v_lead_record.email != '' THEN
    SELECT id INTO v_new_member_id
    FROM members
    WHERE email = v_lead_record.email
      AND organization_id = v_org_id
    LIMIT 1;
  END IF;

  IF v_new_member_id IS NULL THEN
    INSERT INTO members (
      organization_id, first_name, last_name, email, phone,
      status, market_type, effective_date, created_at, updated_at
    ) VALUES (
      v_org_id,
      v_lead_data->>'first_name',
      v_lead_data->>'last_name',
      v_lead_record.email,
      v_lead_record.phone,
      v_member_status, v_market_type, v_effective_date, now(), now()
    )
    RETURNING id INTO v_new_member_id;
  END IF;

  UPDATE crm_records
  SET status = 'Converted',
      stage = 'Converted',
      data = jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(data, '{}'::jsonb),
            '{is_converted}', 'true'::jsonb
          ),
          '{lead_status}', '"Converted"'::jsonb
        ),
        '{converted_member_id}', to_jsonb(v_new_member_id::text)
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
      'converted_to_member_id', v_new_member_id,
      'converted_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_new_member_id,
    'lead_id', p_lead_record_id,
    'message', 'Lead converted to member successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
