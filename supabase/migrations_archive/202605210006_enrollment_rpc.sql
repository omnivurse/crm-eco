-- ============================================================================
-- Migration: 202605210006_enrollment_rpc
-- Purpose:   Transactional RPC for creating enrollments with dependents atomically.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION create_enrollment_tx(
  p_org_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_enrollment_id uuid;
  v_dep record;
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
    status
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
    'draft'
  )
  RETURNING id INTO v_enrollment_id;

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

NOTIFY pgrst, 'reload schema';

COMMIT;
