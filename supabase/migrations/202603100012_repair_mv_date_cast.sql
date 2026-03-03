-- Repair migration: Fix commission_period text→date cast
-- =====================================================
-- Migration 004 may have failed on remote because commission_period
-- is text type (from report builder migration), not date.
-- This migration re-creates the MVs and functions with proper casts.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Re-create mv_advisor_monthly_performance with ::date cast
-- ═══════════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS mv_advisor_monthly_performance CASCADE;

CREATE MATERIALIZED VIEW mv_advisor_monthly_performance AS
SELECT
  a.id                                    AS advisor_id,
  a.organization_id,
  a.parent_advisor_id,
  a.commission_tier,
  a.agent_level_id,
  COALESCE(c.product_type, 'all')         AS product_type,
  date_trunc('month', c.commission_period::date) AS month,
  count(DISTINCT c.enrollment_id)         AS total_enrollments,
  count(c.id)                             AS commission_count,
  sum(CASE WHEN c.commission_type = 'signup'   THEN c.commission_amount ELSE 0 END) AS signup_commissions,
  sum(CASE WHEN c.commission_type = 'monthly'  THEN c.commission_amount ELSE 0 END) AS monthly_commissions,
  sum(CASE WHEN c.commission_type = 'override' THEN c.commission_amount ELSE 0 END) AS override_commissions,
  sum(CASE WHEN c.commission_type = 'bonus'    THEN c.commission_amount ELSE 0 END) AS bonus_commissions,
  sum(c.commission_amount)                AS total_commissions,
  sum(c.base_amount)                      AS total_base_amount,
  sum(CASE WHEN c.status = 'paid'     THEN c.commission_amount ELSE 0 END) AS paid_commissions,
  sum(CASE WHEN c.status = 'pending'  THEN c.commission_amount ELSE 0 END) AS pending_commissions,
  sum(CASE WHEN c.status = 'approved' THEN c.commission_amount ELSE 0 END) AS approved_commissions
FROM advisors a
JOIN commissions c ON c.advisor_id = a.id
GROUP BY
  a.id, a.organization_id, a.parent_advisor_id,
  a.commission_tier, a.agent_level_id,
  COALESCE(c.product_type, 'all'),
  date_trunc('month', c.commission_period::date);

CREATE UNIQUE INDEX idx_mv_advisor_monthly_perf_pk
  ON mv_advisor_monthly_performance (advisor_id, month, product_type);

CREATE INDEX idx_mv_advisor_monthly_perf_org
  ON mv_advisor_monthly_performance (organization_id, month);

CREATE INDEX idx_mv_advisor_monthly_perf_parent
  ON mv_advisor_monthly_performance (parent_advisor_id, month);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Skip mv_commission_rate_analysis (commission_rate_type column not yet on remote)
--    Drop it if it exists from a partial earlier run so refresh_reporting_views won't fail.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS mv_commission_rate_analysis CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Re-create refresh_advisor_commission_summary with ::date cast
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_advisor_commission_summary(
  p_org_id uuid DEFAULT NULL,
  p_month  date DEFAULT date_trunc('month', current_date)::date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int := 0;
BEGIN
  INSERT INTO advisor_commission_summary (
    organization_id, advisor_id, period_month,
    total_commissions, paid_commissions, pending_commissions, approved_commissions,
    signup_commissions, monthly_commissions, override_commissions, bonus_commissions,
    total_enrollments, commission_count,
    total_base_amount,
    total_adjustments_positive, total_adjustments_negative,
    updated_at
  )
  SELECT
    c.organization_id,
    c.advisor_id,
    date_trunc('month', c.commission_period::date)::date AS period_month,
    COALESCE(sum(c.commission_amount), 0),
    COALESCE(sum(c.commission_amount) FILTER (WHERE c.status = 'paid'), 0),
    COALESCE(sum(c.commission_amount) FILTER (WHERE c.status = 'pending'), 0),
    COALESCE(sum(c.commission_amount) FILTER (WHERE c.status = 'approved'), 0),
    COALESCE(sum(c.commission_amount) FILTER (WHERE c.commission_type = 'signup'), 0),
    COALESCE(sum(c.commission_amount) FILTER (WHERE c.commission_type = 'monthly'), 0),
    COALESCE(sum(c.commission_amount) FILTER (WHERE c.commission_type = 'override'), 0),
    COALESCE(sum(c.commission_amount) FILTER (WHERE c.commission_type = 'bonus'), 0),
    count(DISTINCT c.enrollment_id),
    count(c.id),
    COALESCE(sum(c.base_amount), 0),
    COALESCE((
      SELECT sum(adj.amount)
      FROM commission_adjustments adj
      WHERE adj.advisor_id = c.advisor_id
        AND adj.organization_id = c.organization_id
        AND adj.status = 'approved'
        AND adj.effective_period = date_trunc('month', c.commission_period::date)::date
        AND adj.amount > 0
    ), 0),
    COALESCE((
      SELECT sum(abs(adj.amount))
      FROM commission_adjustments adj
      WHERE adj.advisor_id = c.advisor_id
        AND adj.organization_id = c.organization_id
        AND adj.status = 'approved'
        AND adj.effective_period = date_trunc('month', c.commission_period::date)::date
        AND adj.amount < 0
    ), 0),
    now()
  FROM commissions c
  WHERE date_trunc('month', c.commission_period::date)::date = p_month
    AND (p_org_id IS NULL OR c.organization_id = p_org_id)
  GROUP BY c.organization_id, c.advisor_id, date_trunc('month', c.commission_period::date)::date
  ON CONFLICT (advisor_id, period_month)
  DO UPDATE SET
    total_commissions = EXCLUDED.total_commissions,
    paid_commissions = EXCLUDED.paid_commissions,
    pending_commissions = EXCLUDED.pending_commissions,
    approved_commissions = EXCLUDED.approved_commissions,
    signup_commissions = EXCLUDED.signup_commissions,
    monthly_commissions = EXCLUDED.monthly_commissions,
    override_commissions = EXCLUDED.override_commissions,
    bonus_commissions = EXCLUDED.bonus_commissions,
    total_enrollments = EXCLUDED.total_enrollments,
    commission_count = EXCLUDED.commission_count,
    total_base_amount = EXCLUDED.total_base_amount,
    total_adjustments_positive = EXCLUDED.total_adjustments_positive,
    total_adjustments_negative = EXCLUDED.total_adjustments_negative,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Re-create refresh_reporting_views
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_reporting_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_advisor_monthly_performance;
  -- mv_commission_rate_analysis skipped (commission_rate_type not on remote yet)
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Performance index on commissions.commission_period
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_commissions_advisor_period
  ON commissions (advisor_id, commission_period);


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
