-- Phase 2/3: snapshot projector + commission SoT helpers + no-arg refresh wrapper.
-- Additive. No seed of commission_rates. No backfill of historical enrollments.
-- Rollback: DROP FUNCTION project_analytics_snapshot / project_daily_analytics_snapshots;
--           DROP INDEX idx_commissions_enrollment_type_advisor.

BEGIN;

SET lock_timeout = '5s';

CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_enrollment_type_advisor
  ON public.commissions (COALESCE(organization_id, org_id), enrollment_id, commission_type, advisor_id)
  WHERE enrollment_id IS NOT NULL;

-- Make calculate_enrollment_commission also match selected_plan_id (live enrollments).
CREATE OR REPLACE FUNCTION public.calculate_enrollment_commission(
  p_enrollment_id uuid,
  p_commission_type text DEFAULT 'signup'
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_enrollment enrollments%ROWTYPE;
  v_advisor advisors%ROWTYPE;
  v_rate commission_rates%ROWTYPE;
  v_vendor_cost numeric;
  v_net_amount numeric;
  v_commission numeric;
  v_product uuid;
BEGIN
  SELECT * INTO v_enrollment FROM enrollments WHERE id = p_enrollment_id;
  IF v_enrollment IS NULL THEN RETURN 0; END IF;

  SELECT * INTO v_advisor FROM advisors WHERE id = v_enrollment.advisor_id;
  IF v_advisor IS NULL OR NOT v_advisor.commission_eligible THEN RETURN 0; END IF;

  v_product := COALESCE(v_enrollment.selected_plan_id, v_enrollment.product_id);

  SELECT * INTO v_rate
  FROM commission_rates
  WHERE organization_id = v_enrollment.organization_id
    AND (product_id IS NULL OR product_id = v_product)
    AND is_active = true
    AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
    AND (end_date IS NULL OR end_date > CURRENT_DATE)
  ORDER BY
    CASE WHEN product_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_rate IS NULL THEN RETURN 0; END IF;

  v_vendor_cost := 0;
  v_net_amount := COALESCE(v_enrollment.total_monthly_cost, v_enrollment.base_monthly_cost, 0) - v_vendor_cost;

  CASE p_commission_type
    WHEN 'signup' THEN
      IF COALESCE(v_rate.signup_commission_percent, 0) > 0 THEN
        v_commission := v_net_amount * (v_rate.signup_commission_percent / 100);
      ELSE
        v_commission := COALESCE(v_rate.signup_commission, 0);
      END IF;
    WHEN 'monthly' THEN
      IF COALESCE(v_rate.monthly_commission_percent, 0) > 0 THEN
        v_commission := v_net_amount * (v_rate.monthly_commission_percent / 100);
      ELSE
        v_commission := COALESCE(v_rate.monthly_commission, 0);
      END IF;
    ELSE
      v_commission := 0;
  END CASE;

  RETURN COALESCE(v_commission, 0);
END;
$function$;

-- Live refresh_advisor_commission_summary(uuid, date) already has defaults, so
-- nightly cron `SELECT refresh_advisor_commission_summary()` works. Do NOT add
-- a 0-arg overload — it would make that call ambiguous.

CREATE OR REPLACE FUNCTION public.project_analytics_snapshot(
  p_org_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_id uuid;
  v_total_members integer;
  v_active_members integer;
  v_new_members integer;
  v_churned_members integer;
  v_total_enrollments integer;
  v_pending_enrollments integer;
  v_approved_enrollments integer;
  v_total_advisors integer;
  v_active_advisors integer;
  v_total_mrr numeric;
  v_commissions_earned numeric;
  v_commissions_paid numeric;
BEGIN
  SELECT COUNT(*) INTO v_total_members
  FROM members WHERE organization_id = p_org_id;

  SELECT COUNT(*) INTO v_active_members
  FROM members WHERE organization_id = p_org_id AND status = 'active';

  SELECT COUNT(*) INTO v_new_members
  FROM members
  WHERE organization_id = p_org_id
    AND created_at::date = p_date;

  SELECT COUNT(*) INTO v_churned_members
  FROM members
  WHERE organization_id = p_org_id
    AND status IN ('cancelled', 'inactive', 'terminated')
    AND COALESCE(termination_date, created_at::date) = p_date;

  SELECT COUNT(*) INTO v_total_enrollments
  FROM enrollments WHERE organization_id = p_org_id;

  SELECT COUNT(*) INTO v_pending_enrollments
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status IN ('submitted', 'pending_review', 'more_info');

  SELECT COUNT(*) INTO v_approved_enrollments
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status IN ('approved', 'active');

  SELECT COUNT(*) INTO v_total_advisors
  FROM advisors WHERE organization_id = p_org_id;

  SELECT COUNT(*) INTO v_active_advisors
  FROM advisors WHERE organization_id = p_org_id AND status = 'active';

  SELECT COALESCE(SUM(amount), 0) INTO v_total_mrr
  FROM billing_schedules
  WHERE organization_id = p_org_id AND status = 'active';

  SELECT COALESCE(SUM(COALESCE(commission_amount, amount)), 0) INTO v_commissions_earned
  FROM commissions
  WHERE COALESCE(organization_id, org_id) = p_org_id;

  SELECT COALESCE(SUM(COALESCE(commission_amount, amount)), 0) INTO v_commissions_paid
  FROM commissions
  WHERE COALESCE(organization_id, org_id) = p_org_id
    AND status = 'paid';

  INSERT INTO public.analytics_snapshots (
    organization_id,
    snapshot_date,
    metric_type,
    total_members,
    active_members,
    new_members,
    churned_members,
    total_enrollments,
    pending_enrollments,
    approved_enrollments,
    total_mrr,
    total_advisors,
    active_advisors,
    commissions_earned,
    commissions_paid,
    metrics_data
  ) VALUES (
    p_org_id,
    p_date,
    'daily',
    v_total_members,
    v_active_members,
    v_new_members,
    v_churned_members,
    v_total_enrollments,
    v_pending_enrollments,
    v_approved_enrollments,
    v_total_mrr,
    v_total_advisors,
    v_active_advisors,
    v_commissions_earned,
    v_commissions_paid,
    jsonb_build_object(
      'pending_review_statuses', jsonb_build_array('submitted', 'pending_review', 'more_info'),
      'approved_or_active_statuses', jsonb_build_array('approved', 'active')
    )
  )
  ON CONFLICT (organization_id, snapshot_date, metric_type)
  DO UPDATE SET
    total_members = EXCLUDED.total_members,
    active_members = EXCLUDED.active_members,
    new_members = EXCLUDED.new_members,
    churned_members = EXCLUDED.churned_members,
    total_enrollments = EXCLUDED.total_enrollments,
    pending_enrollments = EXCLUDED.pending_enrollments,
    approved_enrollments = EXCLUDED.approved_enrollments,
    total_mrr = EXCLUDED.total_mrr,
    total_advisors = EXCLUDED.total_advisors,
    active_advisors = EXCLUDED.active_advisors,
    commissions_earned = EXCLUDED.commissions_earned,
    commissions_paid = EXCLUDED.commissions_paid,
    metrics_data = EXCLUDED.metrics_data
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.project_daily_analytics_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_org uuid;
  v_count integer := 0;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    PERFORM public.project_analytics_snapshot(v_org, CURRENT_DATE);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.project_analytics_snapshot(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_daily_analytics_snapshots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_analytics_snapshot(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_daily_analytics_snapshots() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly_project_analytics_snapshots') THEN
      PERFORM cron.schedule(
        'nightly_project_analytics_snapshots',
        '30 1 * * *',
        'SELECT public.project_daily_analytics_snapshots()'
      );
    END IF;
  END IF;
END;
$cron$;

COMMIT;
