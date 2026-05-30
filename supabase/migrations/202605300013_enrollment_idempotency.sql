-- Enrollment hardening C1: make enrollment creation idempotent so a double-submit
-- (network retry, double-click) cannot create duplicate enrollments.
--
-- Today enrollments has only a PK and create_enrollment_tx() blindly INSERTs, so two
-- identical submits produce two enrollments (+ duplicate billing/commission downstream).
--
-- This migration is additive + behavior-preserving for existing callers that do NOT
-- pass an idempotency_key (the partial index excludes NULLs, so nothing changes for
-- them). Callers that DO pass a key get exactly-once semantics.

-- 1) Nullable key column (all existing rows stay NULL -> excluded from the index).
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2) Per-org uniqueness for non-null keys. Index is empty initially (all NULL), so it
--    builds instantly and needs no CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_org_idempotency_key_uniq
  ON public.enrollments (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3) Idempotent create_enrollment_tx: if an idempotency_key is supplied and an
--    enrollment already exists for (org, key), return it instead of inserting again.
--    A concurrent race is caught via the unique_violation handler. No key -> old behavior.
CREATE OR REPLACE FUNCTION public.create_enrollment_tx(p_org_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
      v_idem,
      'draft'
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
$function$;
