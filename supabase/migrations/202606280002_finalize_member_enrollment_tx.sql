-- finalize_member_enrollment_tx — provision a member's coverage once payment is
-- captured at enrollment completion. The PIFH gold-standard flow:
--
--   enrollment 'submitted'  --[payment captured]-->  finalize:
--     1. create the membership (status='pending', effective_date = the 1st of the
--        coverage month; it flips to 'active' on that date via the activation cron),
--     2. approve the enrollment (status='approved') so the existing billing +
--        signup-commission triggers fire, then
--     3. OVERRIDE the billing schedule to the correct subscription model:
--        billing_day = 1, the FIRST month is charged immediately by the caller, so
--        next_billing_date = the 1st of the FOLLOWING coverage month (never
--        double-charge month 1). The legacy "20th of the prior month" model
--        (compute_first_billing_date) is intentionally discarded for PIFH.
--
-- Charge-first contract: the CALLER (service-role completion handler) vaults the
-- payment method and charges month 1 BEFORE calling this, then passes the local
-- payment_profiles.id as p_payment_profile_id. This fn only provisions records.
--
-- Idempotent: safe to re-run for the same enrollment (reuses the membership,
-- only approves once, re-applies the schedule override). SECURITY DEFINER +
-- service_role-only, mirroring create_enrollment_tx.

CREATE OR REPLACE FUNCTION public.finalize_member_enrollment_tx(
  p_org_id uuid,
  p_enrollment_id uuid,
  p_payment_profile_id uuid DEFAULT NULL,
  p_effective_date date DEFAULT NULL,
  p_charged_first_month boolean DEFAULT true
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_enr            public.enrollments%ROWTYPE;
  v_effective      date;
  v_next_billing   date;
  v_membership_id  uuid;
  v_schedule_id    uuid;
  v_amount         numeric;
BEGIN
  SELECT * INTO v_enr
    FROM public.enrollments
   WHERE id = p_enrollment_id AND organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment % not found in organization %', p_enrollment_id, p_org_id;
  END IF;

  IF v_enr.primary_member_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment % has no primary member', p_enrollment_id;
  END IF;
  IF v_enr.selected_plan_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment % has no selected plan; cannot create a membership', p_enrollment_id;
  END IF;

  -- Coverage starts on the 1st. Default to the 1st of NEXT month; a passed date
  -- is normalized to the 1st of its month.
  v_effective := COALESCE(
    date_trunc('month', p_effective_date)::date,
    (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
  );
  -- Month 1 is charged immediately at completion, so the recurring schedule
  -- begins the FOLLOWING month. If the caller did NOT charge month 1, bill it on
  -- the coverage start date instead.
  v_next_billing := CASE
    WHEN p_charged_first_month THEN (v_effective + interval '1 month')::date
    ELSE v_effective
  END;
  v_amount := COALESCE(v_enr.base_monthly_cost, 0);

  -- (1) Membership — one per enrollment (guarded; no unique index in baseline).
  SELECT id INTO v_membership_id
    FROM public.memberships
   WHERE enrollment_id = p_enrollment_id AND organization_id = p_org_id
   LIMIT 1;

  IF v_membership_id IS NULL THEN
    INSERT INTO public.memberships (
      organization_id, member_id, plan_id, advisor_id, enrollment_id,
      status, effective_date, billing_amount, billing_frequency
    ) VALUES (
      p_org_id, v_enr.primary_member_id, v_enr.selected_plan_id, v_enr.advisor_id, p_enrollment_id,
      'pending', v_effective, v_amount, 'monthly'
    )
    RETURNING id INTO v_membership_id;
  ELSE
    UPDATE public.memberships
       SET plan_id        = v_enr.selected_plan_id,
           advisor_id     = COALESCE(advisor_id, v_enr.advisor_id),
           effective_date = v_effective,
           billing_amount = v_amount,
           updated_at     = now()
     WHERE id = v_membership_id;
  END IF;

  -- (2) Approve the enrollment (idempotent). This fires trg_enrollment_generate_billing
  -- (creates a billing_schedule) + the signup-commission trigger (attributes the
  -- signup commission to the enrollment's advisor / PIFH org agent). We set
  -- permanent_bill_day=1 and effective_date here so the trigger uses billing_day=1.
  IF v_enr.status IN ('draft', 'in_progress', 'submitted', 'on_hold') THEN
    UPDATE public.enrollments
       SET status            = 'approved',
           effective_date    = v_effective,
           permanent_bill_day = 1,
           updated_at        = now()
     WHERE id = p_enrollment_id;
  END IF;

  -- (3) Override the schedule the trigger created onto the correct "1st" model.
  -- (The trigger seeds it with the legacy 20th-of-prior-month dates; we replace
  -- those.) If somehow no row exists yet, create it directly.
  UPDATE public.billing_schedules
     SET billing_day        = 1,
         day_of_month       = 1,
         frequency          = 'monthly',
         start_date         = v_effective,
         next_billing_date  = v_next_billing,
         last_billed_date   = CASE WHEN p_charged_first_month THEN CURRENT_DATE ELSE last_billed_date END,
         amount             = v_amount,
         payment_profile_id = COALESCE(p_payment_profile_id, payment_profile_id),
         status             = 'active',
         updated_at         = now()
   WHERE enrollment_id = p_enrollment_id
     AND organization_id = p_org_id
   RETURNING id INTO v_schedule_id;

  IF v_schedule_id IS NULL THEN
    INSERT INTO public.billing_schedules (
      organization_id, enrollment_id, member_id, payment_profile_id,
      amount, frequency, billing_day, day_of_month, start_date, next_billing_date,
      last_billed_date, status, idempotency_key
    ) VALUES (
      p_org_id, p_enrollment_id, v_enr.primary_member_id, p_payment_profile_id,
      v_amount, 'monthly', 1, 1, v_effective, v_next_billing,
      CASE WHEN p_charged_first_month THEN CURRENT_DATE ELSE NULL END,
      'active', 'finalize_' || p_enrollment_id::text
    )
    ON CONFLICT (idempotency_key) DO UPDATE
      SET payment_profile_id = EXCLUDED.payment_profile_id,
          next_billing_date  = EXCLUDED.next_billing_date,
          amount             = EXCLUDED.amount,
          updated_at         = now()
    RETURNING id INTO v_schedule_id;
  END IF;

  RETURN jsonb_build_object(
    'enrollment_id', p_enrollment_id,
    'member_id', v_enr.primary_member_id,
    'membership_id', v_membership_id,
    'plan_id', v_enr.selected_plan_id,
    'effective_date', v_effective,
    'billing_schedule_id', v_schedule_id,
    'next_billing_date', v_next_billing,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_member_enrollment_tx(uuid, uuid, uuid, date, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_member_enrollment_tx(uuid, uuid, uuid, date, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_member_enrollment_tx(uuid, uuid, uuid, date, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_member_enrollment_tx(uuid, uuid, uuid, date, boolean) TO service_role;
