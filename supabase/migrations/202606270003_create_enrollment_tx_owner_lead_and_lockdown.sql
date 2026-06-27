-- Two changes to create_enrollment_tx, both required to finish the enrollment
-- create-path consolidation (route the last two direct-insert holdouts — portal
-- self-serve draft start + CRM intake draft start — through this one RPC):
--
-- 1) ACCEPT two more optional fields the holdouts set:
--      created_by -> profiles.id ownership anchor (portal getOrCreateEnrollment
--                    resumes/authorizes a draft by created_by; must be preserved)
--      lead_id    -> crm_records.id (CRM intake links the draft to its lead)
--    Both are NULLIF/optional, so the 7 existing canonical callers (submit/public
--    routes, admin manual, durable workflow, EnrollmentService) are unchanged —
--    they never set these, and the RPC never inserted them before, so the result
--    is still NULL for them.
--
-- 2) LOCK DOWN EXECUTE. This SECURITY DEFINER function runs as postgres (bypasses
--    RLS) and TRUSTS p_org_id without checking the caller's org — safe ONLY when
--    invoked server-side by the service role after the caller is authorized. The
--    baseline granted ALL to anon + authenticated (Supabase's default-for-RPCs),
--    which would let any signed-in user — or anon — inject enrollments into ANY
--    organization. Verified every caller in the codebase uses a SERVICE-ROLE
--    client (both /api/enroll/public routes resolve org from the landing page and
--    use SUPABASE_SERVICE_ROLE_KEY); nothing calls this as anon/authenticated. So
--    revoking those grants closes a latent cross-tenant write hole with no caller
--    impact. Reversible: re-GRANT to restore.

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
      rx_medications,
      created_by,
      lead_id
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
      COALESCE(p_payload->'rx_medications', '[]'::jsonb),
      (NULLIF(p_payload->>'created_by', ''))::uuid,
      (NULLIF(p_payload->>'lead_id', ''))::uuid
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

-- (2) Lock down: service-role only. Revoke the default anon/authenticated/PUBLIC
-- EXECUTE so this RLS-bypassing, org-trusting function can't be called directly.
REVOKE ALL ON FUNCTION public.create_enrollment_tx(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_enrollment_tx(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_enrollment_tx(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_enrollment_tx(uuid, jsonb) TO service_role;
