-- Extend create_enrollment_tx to accept optional DRAFT fields, so the portal
-- self-serve + CRM intake "create draft" paths can use the one canonical,
-- idempotent enrollment-create primitive instead of their own direct inserts.
--
-- Backward compatible: every new column is COALESCE'd to its existing table
-- default, so callers that DON'T pass these (submit/public/admin-manual) behave
-- exactly as before:
--   enrollment_mode   -> 'advisor_assisted' (table default; CHECK-valid)
--   enrollment_number -> NULL (was unset)
--   snapshot          -> '{}'  (table default)
--   rx_medications    -> '[]'  (table default)
-- Draft callers pass enrollment_mode='member_self_serve'/'internal_ops',
-- a snapshot, and an enrollment_number. selected_plan_id/effective_date stay
-- optional (nullable) so an empty draft is valid.

CREATE OR REPLACE FUNCTION public.create_enrollment_tx(p_org_id uuid, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_enrollment_id uuid;
  v_idem text := NULLIF(p_payload->>'idempotency_key', '');
  v_dep record;
BEGIN
  -- Fast path: a prior submit with this key already created the enrollment.
  IF v_idem IS NOT NULL THEN
    SELECT id INTO v_enrollment_id
      FROM enrollments
     WHERE organization_id = p_org_id AND idempotency_key = v_idem;
    IF FOUND THEN
      RETURN jsonb_build_object('enrollment_id', v_enrollment_id, 'idempotent_replay', true);
    END IF;
  END IF;

  BEGIN
    INSERT INTO enrollments (
      organization_id,
      primary_member_id,
      advisor_id,
      selected_plan_id,
      effective_date,
      household_size,
      base_monthly_cost,
      permanent_bill_day,
      enrollment_source,
      channel,
      custom_fields,
      idempotency_key,
      status,
      enrollment_mode,
      enrollment_number,
      snapshot,
      rx_medications
    ) VALUES (
      p_org_id,
      (p_payload->>'primary_member_id')::uuid,
      (p_payload->>'advisor_id')::uuid,
      (p_payload->>'selected_plan_id')::uuid,
      (p_payload->>'effective_date')::date,
      COALESCE((p_payload->>'household_size')::int, 1),
      COALESCE((p_payload->>'base_monthly_cost')::numeric, 0),
      COALESCE((p_payload->>'permanent_bill_day')::int, 20),
      COALESCE(p_payload->>'enrollment_source', 'admin'),
      COALESCE(p_payload->>'channel', 'direct'),
      COALESCE(p_payload->'custom_fields', '{}'::jsonb),
      v_idem,
      'draft',
      COALESCE(NULLIF(p_payload->>'enrollment_mode', ''), 'advisor_assisted'),
      NULLIF(p_payload->>'enrollment_number', ''),
      COALESCE(p_payload->'snapshot', '{}'::jsonb),
      COALESCE(p_payload->'rx_medications', '[]'::jsonb)
    )
    RETURNING id INTO v_enrollment_id;
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent submit with the same key won the race; return the surviving row.
    SELECT id INTO v_enrollment_id
      FROM enrollments
     WHERE organization_id = p_org_id AND idempotency_key = v_idem;
    RETURN jsonb_build_object('enrollment_id', v_enrollment_id, 'idempotent_replay', true);
  END;

  FOR v_dep IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'dependents', '[]'::jsonb))
  LOOP
    INSERT INTO enrollment_dependents (
      organization_id,
      enrollment_id,
      dependent_id,
      relationship,
      additional_cost,
      status
    ) VALUES (
      p_org_id,
      v_enrollment_id,
      (v_dep.value->>'dependentId')::uuid,
      v_dep.value->>'relationship',
      COALESCE((v_dep.value->>'additionalCost')::numeric, 0),
      'active'
    );
  END LOOP;

  RETURN jsonb_build_object('enrollment_id', v_enrollment_id);
END;
$$;
