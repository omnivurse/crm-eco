-- =============================================================================
-- Tenant-authorize convert_lead_to_member.
--
-- The RPC is SECURITY DEFINER and executable by authenticated users, so every
-- target-derived write must be authorized inside the function. The API also
-- scopes its lookup to the active org, but this database check protects direct
-- PostgREST callers and any future server call site.
-- =============================================================================

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.convert_lead_to_member(p_lead_record_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_lead_record      crm_records%ROWTYPE;
  v_org_id           uuid;
  v_module_key       text;
  v_lead_data        jsonb;
  v_new_member_id    uuid;
  v_effective_date   date;
  v_market_type      text;
  v_member_status    text;
  v_is_service_role  boolean := COALESCE(auth.role(), '') = 'service_role';
BEGIN
  SELECT * INTO v_lead_record FROM crm_records WHERE id = p_lead_record_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record not found');
  END IF;

  v_org_id := v_lead_record.organization_id;
  v_lead_data := COALESCE(v_lead_record.data, '{}'::jsonb);

  -- SECURITY DEFINER bypasses table RLS. Re-establish tenant and role checks
  -- before any member, record, or audit-log write. Service-role callers remain
  -- available for trusted server jobs.
  IF NOT v_is_service_role THEN
    IF auth.uid() IS NULL
       OR NOT public.has_crm_role(v_org_id, ARRAY['crm_admin', 'crm_manager']) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;

    -- Do not let a direct RPC caller attribute the audit event to another user.
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_user_id
        AND p.user_id = auth.uid()
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;
  END IF;

  SELECT m.key INTO v_module_key
  FROM crm_modules m
  WHERE m.id = v_lead_record.module_id
    AND m.key IN ('leads', 'contacts');

  IF v_module_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Record must belong to a Leads or Contacts module'
    );
  END IF;

  -- Leads: block if already converted to contact or member.
  -- Contacts: only block if already linked to a member enrollment.
  IF v_module_key = 'leads' THEN
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
  ELSE
    IF NULLIF(btrim(v_lead_data->>'converted_member_id'), '') IS NOT NULL
       OR NULLIF(btrim(v_lead_data->>'linked_member_id'), '') IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This contact is already linked to a member enrollment',
        'converted_member_id', COALESCE(
          v_lead_data->>'converted_member_id',
          v_lead_data->>'linked_member_id'
        )
      );
    END IF;
  END IF;

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

  -- members_status_check allows only lowercase values.
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

  IF v_module_key = 'leads' THEN
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
  ELSE
    -- Contacts stay in Contacts; only link the enrollment member id.
    UPDATE crm_records
    SET data = jsonb_set(
          jsonb_set(
            COALESCE(data, '{}'::jsonb),
            '{converted_member_id}', to_jsonb(v_new_member_id::text)
          ),
          '{linked_member_id}', to_jsonb(v_new_member_id::text)
        ),
        updated_at = now()
    WHERE id = p_lead_record_id;
  END IF;

  INSERT INTO crm_audit_log (organization_id, actor_id, entity, entity_id, action, diff)
  VALUES (
    v_org_id,
    p_user_id,
    CASE WHEN v_module_key = 'leads' THEN 'lead' ELSE 'contact' END,
    p_lead_record_id,
    'update',
    jsonb_build_object(
      'converted_to_member_id', v_new_member_id,
      'converted_at', now(),
      'source_module', v_module_key,
      'member_status', v_member_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_new_member_id,
    'lead_id', p_lead_record_id,
    'member_status', v_member_status,
    'message', CASE
      WHEN v_module_key = 'contacts' THEN 'Contact linked to member enrollment successfully'
      ELSE 'Lead converted to member successfully'
    END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

REVOKE ALL ON FUNCTION public.convert_lead_to_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_member(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.convert_lead_to_member(uuid, uuid) IS
  'Converts a lead/contact to an enrollment member after enforcing target-org role and audit-actor identity.';

-- Rollback:
--   Recreate public.convert_lead_to_member(uuid, uuid) from
--   202607151001_convert_lead_to_member_accept_contacts.sql.
