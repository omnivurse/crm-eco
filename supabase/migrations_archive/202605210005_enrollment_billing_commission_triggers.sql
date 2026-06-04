-- ============================================================================
-- Migration: 202605210005_enrollment_billing_commission_triggers
-- Purpose:   Trigger functions for billing schedule auto-generation, cost sync,
--            cancellation cascade, signup commission, and tier recalculation.
-- Guardrail: 100% additive — no DROP, no destructive ALTER
-- ============================================================================

BEGIN;

-- ── Helper: compute_first_billing_date(effective_date) ──────────────────────
-- Returns the 20th of the month PRIOR to the effective date.
-- Example: effective_date = 2026-07-01 → first_billing_date = 2026-06-20

CREATE OR REPLACE FUNCTION compute_first_billing_date(p_effective_date date)
RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN (p_effective_date - interval '1 month')::date
         - (EXTRACT(day FROM (p_effective_date - interval '1 month')::date)::int - 20);
END;
$$;

-- ── 1. generate_billing_schedule_on_enrollment_active() ─────────────────────
-- Fires when an enrollment transitions to 'approved' status.
-- Inserts a billing_schedules row with next_billing_date based on the 
-- permanent_bill_day or effective_date.

CREATE OR REPLACE FUNCTION generate_billing_schedule_on_enrollment_active()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_billing_day int;
  v_first_billing date;
  v_idem_key text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    v_billing_day := COALESCE(NEW.permanent_bill_day, 20);

    v_first_billing := compute_first_billing_date(
      COALESCE(NEW.effective_date, CURRENT_DATE)
    );

    v_idem_key := 'enrollment_activate_' || NEW.id::text || '_' || v_first_billing::text;

    INSERT INTO billing_schedules (
      organization_id,
      enrollment_id,
      member_id,
      amount,
      frequency,
      billing_day,
      start_date,
      next_billing_date,
      status,
      idempotency_key
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      NEW.primary_member_id,
      COALESCE(NEW.base_monthly_cost, 0),
      'monthly',
      v_billing_day,
      v_first_billing,
      v_first_billing,
      'active',
      v_idem_key
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_generate_billing ON enrollments;
CREATE TRIGGER trg_enrollment_generate_billing
  AFTER INSERT OR UPDATE OF status ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION generate_billing_schedule_on_enrollment_active();

-- ── 2. sync_billing_schedule_on_enrollment_update() ─────────────────────────
-- Syncs billing_schedules.amount when enrollments.base_monthly_cost changes.

CREATE OR REPLACE FUNCTION sync_billing_schedule_on_enrollment_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.base_monthly_cost IS DISTINCT FROM OLD.base_monthly_cost THEN
    UPDATE billing_schedules
    SET amount = NEW.base_monthly_cost,
        updated_at = now()
    WHERE enrollment_id = NEW.id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_sync_billing_cost ON enrollments;
CREATE TRIGGER trg_enrollment_sync_billing_cost
  AFTER UPDATE OF base_monthly_cost ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION sync_billing_schedule_on_enrollment_update();

-- ── 3. cancel_future_billing_on_enrollment_cancelled() ──────────────────────
-- Cancels active billing_schedules and pending commissions when enrollment is cancelled.

CREATE OR REPLACE FUNCTION cancel_future_billing_on_enrollment_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE billing_schedules
    SET status = 'cancelled',
        cancelled_at = now(),
        cancelled_reason = COALESCE(NEW.inactive_reason, 'enrollment_cancelled'),
        end_date = COALESCE(NEW.end_date, CURRENT_DATE),
        updated_at = now()
    WHERE enrollment_id = NEW.id
      AND status IN ('active', 'paused');

    UPDATE commissions
    SET status = 'cancelled',
        status_reason = 'enrollment_cancelled',
        updated_at = now()
    WHERE enrollment_id = NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_cancel_billing ON enrollments;
CREATE TRIGGER trg_enrollment_cancel_billing
  AFTER UPDATE OF status ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION cancel_future_billing_on_enrollment_cancelled();

-- ── 4. create_signup_commission_on_enrollment() ─────────────────────────────
-- Creates a 'new_business' / 'signup' commission when enrollment is approved.

CREATE OR REPLACE FUNCTION create_signup_commission_on_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_advisor advisors%ROWTYPE;
  v_commission_amount numeric;
  v_idem_key text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    IF NEW.advisor_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_advisor FROM advisors WHERE id = NEW.advisor_id;
    IF v_advisor IS NULL OR v_advisor.status <> 'active' THEN
      RETURN NEW;
    END IF;

    v_commission_amount := calculate_enrollment_commission(NEW.id, 'signup');
    IF v_commission_amount <= 0 THEN
      RETURN NEW;
    END IF;

    v_idem_key := 'signup_' || NEW.id::text || '_' || CURRENT_DATE::text;

    INSERT INTO commissions (
      organization_id,
      advisor_id,
      enrollment_id,
      member_id,
      commission_type,
      base_amount,
      commission_amount,
      commission_period,
      status,
      metadata
    ) VALUES (
      NEW.organization_id,
      NEW.advisor_id,
      NEW.id,
      NEW.primary_member_id,
      'signup',
      COALESCE(NEW.base_monthly_cost, 0),
      v_commission_amount,
      date_trunc('month', CURRENT_DATE)::date,
      'pending',
      jsonb_build_object('idempotency_key', v_idem_key, 'trigger', 'enrollment_approval')
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_signup_commission ON enrollments;
CREATE TRIGGER trg_enrollment_signup_commission
  AFTER INSERT OR UPDATE OF status ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION create_signup_commission_on_enrollment();

-- ── 5. recompute_advisor_tier_on_membership_change() ────────────────────────
-- When enrollment count changes for an advisor, recalculate their agent_level_id.

CREATE OR REPLACE FUNCTION recompute_advisor_tier_on_membership_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_advisor_id uuid;
  v_org_id uuid;
  v_active_count int;
  v_new_level_id uuid;
BEGIN
  v_advisor_id := COALESCE(NEW.advisor_id, OLD.advisor_id);
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

  IF v_advisor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM enrollments
  WHERE advisor_id = v_advisor_id
    AND status = 'approved';

  SELECT id INTO v_new_level_id
  FROM agent_levels
  WHERE organization_id = v_org_id
    AND is_active = true
    AND min_active_members <= v_active_count
    AND (max_active_members IS NULL OR max_active_members >= v_active_count)
  ORDER BY level_rank DESC
  LIMIT 1;

  IF v_new_level_id IS NOT NULL THEN
    UPDATE advisors
    SET agent_level_id = v_new_level_id,
        updated_at = now()
    WHERE id = v_advisor_id
      AND (agent_level_id IS DISTINCT FROM v_new_level_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_tier_recalc ON enrollments;
CREATE TRIGGER trg_enrollment_tier_recalc
  AFTER INSERT OR UPDATE OF status ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION recompute_advisor_tier_on_membership_change();

-- ── 6. updated_at auto-update for new tables ────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legal_documents_updated_at ON legal_documents;
CREATE TRIGGER trg_legal_documents_updated_at
  BEFORE UPDATE ON legal_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_price_change_schedules_updated_at ON price_change_schedules;
CREATE TRIGGER trg_price_change_schedules_updated_at
  BEFORE UPDATE ON price_change_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

NOTIFY pgrst, 'reload schema';

COMMIT;
