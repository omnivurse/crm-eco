-- Migration: Enterprise Reporting Layer + Commission Automation + Downline Analytics
-- =================================================================================
-- Builds on existing commission engine (commission_rates, commissions, advisors,
-- advisor_commission_summary, commission_adjustments, commission_payment_batches).
--
-- Adds:
--   Section 1 – Materialized views for fast dashboard queries
--   Section 2 – Refresh functions (concurrent-safe)
--   Section 3 – Advisor commission summary refresh function
--   Section 4 – Commission auto-fire trigger on enrollment activation
--   Section 5 – Downline analytics RPC functions
--   Section 6 – Performance indexes
--   Section 7 – pg_cron scheduling (safe-create)

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1 – MATERIALIZED VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1a. Per-advisor monthly performance (the fast lane for advisor dashboards)
DROP MATERIALIZED VIEW IF EXISTS mv_advisor_monthly_performance;

CREATE MATERIALIZED VIEW mv_advisor_monthly_performance AS
SELECT
  a.id                                    AS advisor_id,
  a.organization_id,
  a.parent_advisor_id,
  a.commission_tier,
  a.agent_level_id,
  COALESCE(c.product_type, 'all')         AS product_type,
  date_trunc('month', c.commission_period) AS month,
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
  date_trunc('month', c.commission_period);

-- UNIQUE index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_advisor_monthly_perf_pk
  ON mv_advisor_monthly_performance (advisor_id, month, product_type);

CREATE INDEX idx_mv_advisor_monthly_perf_org
  ON mv_advisor_monthly_performance (organization_id, month);

CREATE INDEX idx_mv_advisor_monthly_perf_parent
  ON mv_advisor_monthly_performance (parent_advisor_id, month);


-- 1b. Org-wide monthly dashboard rollup
DROP MATERIALIZED VIEW IF EXISTS mv_org_monthly_dashboard;

CREATE MATERIALIZED VIEW mv_org_monthly_dashboard AS
SELECT
  c.organization_id,
  COALESCE(c.product_type, 'all')            AS product_type,
  date_trunc('month', c.commission_period)   AS month,
  count(DISTINCT c.advisor_id)               AS active_advisors,
  count(DISTINCT c.enrollment_id)            AS total_enrollments,
  count(DISTINCT c.member_id)                AS total_members,
  count(c.id)                                AS commission_count,
  sum(c.commission_amount)                   AS total_commissions,
  sum(c.base_amount)                         AS total_base_amount,
  sum(CASE WHEN c.status = 'paid'     THEN c.commission_amount ELSE 0 END) AS paid_amount,
  sum(CASE WHEN c.status = 'pending'  THEN c.commission_amount ELSE 0 END) AS pending_amount,
  sum(CASE WHEN c.status = 'approved' THEN c.commission_amount ELSE 0 END) AS approved_amount,
  avg(c.commission_amount)                   AS avg_commission
FROM commissions c
GROUP BY
  c.organization_id,
  COALESCE(c.product_type, 'all'),
  date_trunc('month', c.commission_period);

CREATE UNIQUE INDEX idx_mv_org_monthly_dash_pk
  ON mv_org_monthly_dashboard (organization_id, month, product_type);


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2 – REFRESH FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_reporting_views()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start timestamptz;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Refresh advisor monthly performance
  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_advisor_monthly_performance;
  v_result := v_result || jsonb_build_object(
    'mv_advisor_monthly_performance',
    jsonb_build_object('duration_ms', extract(milliseconds from clock_timestamp() - v_start)::int)
  );

  -- Refresh org monthly dashboard
  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_monthly_dashboard;
  v_result := v_result || jsonb_build_object(
    'mv_org_monthly_dashboard',
    jsonb_build_object('duration_ms', extract(milliseconds from clock_timestamp() - v_start)::int)
  );

  v_result := v_result || jsonb_build_object('refreshed_at', now()::text);
  RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3 – ADVISOR COMMISSION SUMMARY REFRESH
-- ═══════════════════════════════════════════════════════════════════════════════

-- Upserts advisor_commission_summary for a given org + month (or all orgs if NULL).
-- This replaces the need for manual summary creation.
CREATE OR REPLACE FUNCTION refresh_advisor_commission_summary(
  p_org_id uuid DEFAULT NULL,
  p_month  date DEFAULT date_trunc('month', current_date)::date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO advisor_commission_summary (
    organization_id, advisor_id, period_month,
    total_enrollments,
    signup_commissions, monthly_commissions, override_commissions, bonus_commissions,
    adjustments, clawbacks,
    gross_commissions, net_commissions,
    amount_paid, amount_pending,
    calculated_at, updated_at
  )
  SELECT
    c.organization_id,
    c.advisor_id,
    date_trunc('month', c.commission_period)::date AS period_month,
    count(DISTINCT c.enrollment_id)::int,
    sum(CASE WHEN c.commission_type = 'signup'   THEN c.commission_amount ELSE 0 END),
    sum(CASE WHEN c.commission_type = 'monthly'  THEN c.commission_amount ELSE 0 END),
    sum(CASE WHEN c.commission_type = 'override' THEN c.commission_amount ELSE 0 END),
    sum(CASE WHEN c.commission_type = 'bonus'    THEN c.commission_amount ELSE 0 END),
    COALESCE((
      SELECT sum(adj.amount)
      FROM commission_adjustments adj
      WHERE adj.advisor_id = c.advisor_id
        AND adj.organization_id = c.organization_id
        AND adj.effective_period = date_trunc('month', c.commission_period)::date
        AND adj.status = 'approved'
        AND adj.adjustment_type NOT IN ('clawback', 'chargeback')
    ), 0),
    COALESCE((
      SELECT sum(abs(adj.amount))
      FROM commission_adjustments adj
      WHERE adj.advisor_id = c.advisor_id
        AND adj.organization_id = c.organization_id
        AND adj.effective_period = date_trunc('month', c.commission_period)::date
        AND adj.status = 'approved'
        AND adj.adjustment_type IN ('clawback', 'chargeback')
    ), 0),
    sum(c.commission_amount),
    sum(c.commission_amount)
      + COALESCE((
          SELECT sum(adj.amount)
          FROM commission_adjustments adj
          WHERE adj.advisor_id = c.advisor_id
            AND adj.organization_id = c.organization_id
            AND adj.effective_period = date_trunc('month', c.commission_period)::date
            AND adj.status = 'approved'
        ), 0),
    sum(CASE WHEN c.status = 'paid'    THEN c.commission_amount ELSE 0 END),
    sum(CASE WHEN c.status = 'pending' THEN c.commission_amount ELSE 0 END),
    now(),
    now()
  FROM commissions c
  WHERE date_trunc('month', c.commission_period)::date = p_month
    AND (p_org_id IS NULL OR c.organization_id = p_org_id)
  GROUP BY c.organization_id, c.advisor_id, date_trunc('month', c.commission_period)::date
  ON CONFLICT (advisor_id, period_month)
  DO UPDATE SET
    total_enrollments    = EXCLUDED.total_enrollments,
    signup_commissions   = EXCLUDED.signup_commissions,
    monthly_commissions  = EXCLUDED.monthly_commissions,
    override_commissions = EXCLUDED.override_commissions,
    bonus_commissions    = EXCLUDED.bonus_commissions,
    adjustments          = EXCLUDED.adjustments,
    clawbacks            = EXCLUDED.clawbacks,
    gross_commissions    = EXCLUDED.gross_commissions,
    net_commissions      = EXCLUDED.net_commissions,
    amount_paid          = EXCLUDED.amount_paid,
    amount_pending       = EXCLUDED.amount_pending,
    calculated_at        = now(),
    updated_at           = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4 – COMMISSION AUTO-FIRE TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════════

-- Fires when an enrollment transitions to 'active', creating commission records
-- via the existing calculate_enrollment_commission() function.
CREATE OR REPLACE FUNCTION trg_enrollment_commission_auto_fire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_advisor_id      uuid;
  v_commission_amt  numeric;
  v_product_type    text;
BEGIN
  -- Only fire on status change TO 'active'
  IF NEW.status != 'active' THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.status = 'active' THEN RETURN NEW; END IF;

  -- Need an advisor
  v_advisor_id := NEW.advisor_id;
  IF v_advisor_id IS NULL THEN RETURN NEW; END IF;

  -- Check if commission already exists for this enrollment
  IF EXISTS (
    SELECT 1 FROM commissions
    WHERE enrollment_id = NEW.id
      AND commission_type = 'signup'
  ) THEN
    RETURN NEW;
  END IF;

  -- Get product type from the enrollment's product
  SELECT p.product_type INTO v_product_type
  FROM products p
  WHERE p.id = COALESCE(NEW.selected_plan_id, NEW.product_id)
  LIMIT 1;

  -- Calculate commission using existing function
  v_commission_amt := calculate_enrollment_commission(NEW.id, 'signup');

  -- Insert direct commission if amount > 0
  IF v_commission_amt > 0 THEN
    INSERT INTO commissions (
      organization_id, advisor_id, enrollment_id, member_id,
      commission_type, product_type,
      base_amount, commission_rate, commission_amount,
      commission_period, status
    ) VALUES (
      NEW.organization_id, v_advisor_id, NEW.id, NEW.primary_member_id,
      'signup', v_product_type,
      COALESCE(NEW.total_monthly_cost, 0), 0, v_commission_amt,
      date_trunc('month', COALESCE(NEW.effective_date, now()))::date, 'pending'
    );
  END IF;

  -- Generate override commissions for upline (up to 5 levels)
  DECLARE
    v_current_id uuid := v_advisor_id;
    v_parent_id  uuid;
    v_level      int := 1;
    v_override_amt  numeric;
  BEGIN
    LOOP
      EXIT WHEN v_level > 5;

      SELECT parent_advisor_id INTO v_parent_id
      FROM advisors WHERE id = v_current_id;

      EXIT WHEN v_parent_id IS NULL;

      -- Check parent is commission eligible
      IF EXISTS (
        SELECT 1 FROM advisors
        WHERE id = v_parent_id AND commission_eligible = true
      ) THEN
        -- Get override rate for parent
        SELECT cr.override_commission_percent INTO v_override_amt
        FROM commission_rates cr
        JOIN advisors pa ON pa.id = v_parent_id
        WHERE cr.organization_id = NEW.organization_id
          AND cr.is_active = true
          AND cr.effective_date <= current_date
          AND (cr.end_date IS NULL OR cr.end_date > current_date)
          AND (cr.agent_level_id IS NULL OR cr.agent_level_id = pa.agent_level_id)
          AND (cr.product_id IS NULL OR cr.product_id = NEW.selected_plan_id)
        ORDER BY
          CASE WHEN cr.product_id IS NOT NULL THEN 0 ELSE 1 END,
          CASE WHEN cr.agent_level_id IS NOT NULL THEN 0 ELSE 1 END
        LIMIT 1;

        IF v_override_amt IS NOT NULL AND v_override_amt > 0 THEN
          INSERT INTO commissions (
            organization_id, advisor_id, enrollment_id, member_id,
            source_advisor_id, override_level,
            commission_type, product_type,
            base_amount, commission_rate, commission_rate_type, commission_amount,
            commission_period, status
          ) VALUES (
            NEW.organization_id, v_parent_id, NEW.id, NEW.primary_member_id,
            v_advisor_id, v_level,
            'override', v_product_type,
            COALESCE(NEW.total_monthly_cost, 0), v_override_amt, 'percentage',
            COALESCE(NEW.total_monthly_cost, 0) * (v_override_amt / 100),
            date_trunc('month', COALESCE(NEW.effective_date, now()))::date, 'pending'
          );
        END IF;
      END IF;

      v_current_id := v_parent_id;
      v_level := v_level + 1;
    END LOOP;
  END;

  RETURN NEW;
END;
$$;

-- Apply the trigger to enrollments
DROP TRIGGER IF EXISTS trg_enrollment_commission ON enrollments;
CREATE TRIGGER trg_enrollment_commission
  AFTER INSERT OR UPDATE OF status ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION trg_enrollment_commission_auto_fire();


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5 – DOWNLINE ANALYTICS RPC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- 5a. Get advisor personal + downline performance metrics
CREATE OR REPLACE FUNCTION get_advisor_analytics(
  p_advisor_id uuid,
  p_org_id     uuid,
  p_months     int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result       jsonb;
  v_personal     jsonb;
  v_downline     jsonb;
  v_monthly      jsonb;
  v_top_downline jsonb;
  v_cutoff       date := (date_trunc('month', current_date) - (p_months || ' months')::interval)::date;
BEGIN
  -- Personal metrics (from MV)
  SELECT jsonb_build_object(
    'total_commissions',    COALESCE(sum(total_commissions), 0),
    'paid_commissions',     COALESCE(sum(paid_commissions), 0),
    'pending_commissions',  COALESCE(sum(pending_commissions), 0),
    'total_enrollments',    COALESCE(sum(total_enrollments), 0),
    'signup_commissions',   COALESCE(sum(signup_commissions), 0),
    'monthly_commissions',  COALESCE(sum(monthly_commissions), 0),
    'override_commissions', COALESCE(sum(override_commissions), 0),
    'avg_commission',       COALESCE(avg(NULLIF(total_commissions, 0)), 0)
  ) INTO v_personal
  FROM mv_advisor_monthly_performance
  WHERE advisor_id = p_advisor_id
    AND organization_id = p_org_id
    AND month >= v_cutoff;

  -- Downline aggregate metrics (from MV using existing downline function)
  SELECT jsonb_build_object(
    'total_commissions',    COALESCE(sum(total_commissions), 0),
    'total_enrollments',    COALESCE(sum(total_enrollments), 0),
    'active_advisors',      count(DISTINCT advisor_id),
    'avg_per_advisor',      COALESCE(avg(total_commissions), 0)
  ) INTO v_downline
  FROM mv_advisor_monthly_performance
  WHERE advisor_id IN (SELECT id FROM get_advisor_downline_ids(p_advisor_id))
    AND organization_id = p_org_id
    AND month >= v_cutoff;

  -- Monthly trend (personal + downline combined)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY month), '[]'::jsonb) INTO v_monthly
  FROM (
    SELECT
      m.month,
      jsonb_build_object(
        'month',               m.month,
        'personal_commissions', COALESCE(sum(CASE WHEN m.advisor_id = p_advisor_id THEN m.total_commissions ELSE 0 END), 0),
        'downline_commissions', COALESCE(sum(CASE WHEN m.advisor_id != p_advisor_id THEN m.total_commissions ELSE 0 END), 0),
        'personal_enrollments', COALESCE(sum(CASE WHEN m.advisor_id = p_advisor_id THEN m.total_enrollments ELSE 0 END), 0),
        'downline_enrollments', COALESCE(sum(CASE WHEN m.advisor_id != p_advisor_id THEN m.total_enrollments ELSE 0 END), 0),
        'total_commissions',    COALESCE(sum(m.total_commissions), 0)
      ) AS row_data
    FROM mv_advisor_monthly_performance m
    WHERE (m.advisor_id = p_advisor_id
           OR m.advisor_id IN (SELECT id FROM get_advisor_downline_ids(p_advisor_id)))
      AND m.organization_id = p_org_id
      AND m.month >= v_cutoff
    GROUP BY m.month
  ) sub;

  -- Top 5 downline performers
  SELECT COALESCE(jsonb_agg(row_data ORDER BY total_commissions DESC), '[]'::jsonb) INTO v_top_downline
  FROM (
    SELECT jsonb_build_object(
      'advisor_id',        m.advisor_id,
      'first_name',        a.first_name,
      'last_name',         a.last_name,
      'email',             a.email,
      'commission_tier',   a.commission_tier,
      'total_commissions', sum(m.total_commissions),
      'total_enrollments', sum(m.total_enrollments)
    ) AS row_data,
    sum(m.total_commissions) AS total_commissions
    FROM mv_advisor_monthly_performance m
    JOIN advisors a ON a.id = m.advisor_id
    WHERE m.advisor_id IN (SELECT id FROM get_advisor_downline_ids(p_advisor_id))
      AND m.organization_id = p_org_id
      AND m.month >= v_cutoff
    GROUP BY m.advisor_id, a.first_name, a.last_name, a.email, a.commission_tier
    ORDER BY sum(m.total_commissions) DESC
    LIMIT 5
  ) sub;

  -- Assemble result
  v_result := jsonb_build_object(
    'personal',     COALESCE(v_personal, '{}'::jsonb),
    'downline',     COALESCE(v_downline, '{}'::jsonb),
    'monthly',      COALESCE(v_monthly, '[]'::jsonb),
    'top_downline', COALESCE(v_top_downline, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;


-- 5b. Org-wide dashboard metrics (for admins)
CREATE OR REPLACE FUNCTION get_org_dashboard_analytics(
  p_org_id uuid,
  p_months int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result  jsonb;
  v_summary jsonb;
  v_monthly jsonb;
  v_by_type jsonb;
  v_cutoff  date := (date_trunc('month', current_date) - (p_months || ' months')::interval)::date;
BEGIN
  -- Overall summary
  SELECT jsonb_build_object(
    'total_commissions',  COALESCE(sum(total_commissions), 0),
    'paid_amount',        COALESCE(sum(paid_amount), 0),
    'pending_amount',     COALESCE(sum(pending_amount), 0),
    'approved_amount',    COALESCE(sum(approved_amount), 0),
    'total_enrollments',  COALESCE(sum(total_enrollments), 0),
    'active_advisors',    COALESCE(sum(active_advisors), 0),
    'avg_commission',     COALESCE(avg(NULLIF(avg_commission, 0)), 0)
  ) INTO v_summary
  FROM mv_org_monthly_dashboard
  WHERE organization_id = p_org_id
    AND month >= v_cutoff;

  -- Monthly trend
  SELECT COALESCE(jsonb_agg(row_data ORDER BY month), '[]'::jsonb) INTO v_monthly
  FROM (
    SELECT jsonb_build_object(
      'month',             month,
      'total_commissions', COALESCE(sum(total_commissions), 0),
      'total_enrollments', COALESCE(sum(total_enrollments), 0),
      'active_advisors',   COALESCE(sum(active_advisors), 0),
      'paid_amount',       COALESCE(sum(paid_amount), 0)
    ) AS row_data, month
    FROM mv_org_monthly_dashboard
    WHERE organization_id = p_org_id
      AND month >= v_cutoff
    GROUP BY month
  ) sub;

  -- Breakdown by product type
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_by_type
  FROM (
    SELECT jsonb_build_object(
      'product_type',      product_type,
      'total_commissions', COALESCE(sum(total_commissions), 0),
      'total_enrollments', COALESCE(sum(total_enrollments), 0),
      'commission_count',  COALESCE(sum(commission_count), 0)
    ) AS row_data
    FROM mv_org_monthly_dashboard
    WHERE organization_id = p_org_id
      AND month >= v_cutoff
    GROUP BY product_type
  ) sub;

  v_result := jsonb_build_object(
    'summary',    COALESCE(v_summary, '{}'::jsonb),
    'monthly',    COALESCE(v_monthly, '[]'::jsonb),
    'by_product', COALESCE(v_by_type, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;


-- 5c. Growth metrics: month-over-month comparison
CREATE OR REPLACE FUNCTION get_growth_metrics(
  p_org_id     uuid,
  p_advisor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_current_month date := date_trunc('month', current_date)::date;
  v_prev_month    date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_current       record;
  v_previous      record;
  v_result        jsonb;
BEGIN
  IF p_advisor_id IS NOT NULL THEN
    -- Advisor-specific growth
    SELECT
      COALESCE(sum(total_commissions), 0) AS commissions,
      COALESCE(sum(total_enrollments), 0) AS enrollments
    INTO v_current
    FROM mv_advisor_monthly_performance
    WHERE advisor_id = p_advisor_id
      AND organization_id = p_org_id
      AND month = v_current_month;

    SELECT
      COALESCE(sum(total_commissions), 0) AS commissions,
      COALESCE(sum(total_enrollments), 0) AS enrollments
    INTO v_previous
    FROM mv_advisor_monthly_performance
    WHERE advisor_id = p_advisor_id
      AND organization_id = p_org_id
      AND month = v_prev_month;
  ELSE
    -- Org-wide growth
    SELECT
      COALESCE(sum(total_commissions), 0) AS commissions,
      COALESCE(sum(total_enrollments), 0) AS enrollments
    INTO v_current
    FROM mv_org_monthly_dashboard
    WHERE organization_id = p_org_id
      AND month = v_current_month;

    SELECT
      COALESCE(sum(total_commissions), 0) AS commissions,
      COALESCE(sum(total_enrollments), 0) AS enrollments
    INTO v_previous
    FROM mv_org_monthly_dashboard
    WHERE organization_id = p_org_id
      AND month = v_prev_month;
  END IF;

  v_result := jsonb_build_object(
    'current_month', jsonb_build_object(
      'commissions', v_current.commissions,
      'enrollments', v_current.enrollments
    ),
    'previous_month', jsonb_build_object(
      'commissions', v_previous.commissions,
      'enrollments', v_previous.enrollments
    ),
    'growth_pct', jsonb_build_object(
      'commissions', CASE
        WHEN v_previous.commissions > 0
        THEN round(((v_current.commissions - v_previous.commissions) / v_previous.commissions * 100)::numeric, 1)
        ELSE 0
      END,
      'enrollments', CASE
        WHEN v_previous.enrollments > 0
        THEN round(((v_current.enrollments - v_previous.enrollments)::numeric / v_previous.enrollments * 100)::numeric, 1)
        ELSE 0
      END
    )
  );

  RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6 – PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Commissions: fast lookups by advisor + period
CREATE INDEX IF NOT EXISTS idx_commissions_advisor_period
  ON commissions (advisor_id, commission_period);

-- Commissions: fast status filtering
CREATE INDEX IF NOT EXISTS idx_commissions_org_status
  ON commissions (organization_id, status);

-- Commissions: enrollment lookup (for duplicate check in trigger)
CREATE INDEX IF NOT EXISTS idx_commissions_enrollment_type
  ON commissions (enrollment_id, commission_type)
  WHERE enrollment_id IS NOT NULL;

-- Commissions: source advisor for override queries
CREATE INDEX IF NOT EXISTS idx_commissions_source_advisor
  ON commissions (source_advisor_id)
  WHERE source_advisor_id IS NOT NULL;

-- Advisors: fast parent lookup for hierarchy traversal
CREATE INDEX IF NOT EXISTS idx_advisors_parent_advisor
  ON advisors (parent_advisor_id)
  WHERE parent_advisor_id IS NOT NULL;

-- Advisors: org + status for active advisor counts
CREATE INDEX IF NOT EXISTS idx_advisors_org_status
  ON advisors (organization_id, status);

-- Advisor commission summary: fast org + period queries
CREATE INDEX IF NOT EXISTS idx_acs_org_period
  ON advisor_commission_summary (organization_id, period_month);

-- Commission rates: fast rate lookup
CREATE INDEX IF NOT EXISTS idx_commission_rates_lookup
  ON commission_rates (organization_id, is_active, effective_date)
  WHERE is_active = true;

-- Enrollments: advisor + status for commission trigger efficiency
CREATE INDEX IF NOT EXISTS idx_enrollments_advisor_status
  ON enrollments (advisor_id, status)
  WHERE advisor_id IS NOT NULL;

-- Commission adjustments: summary refresh
CREATE INDEX IF NOT EXISTS idx_commission_adj_advisor_period
  ON commission_adjustments (advisor_id, effective_period, status);


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 7 – pg_cron SCHEDULING (optional – requires extension)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable pg_cron if available (Supabase has it by default)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not available, skipping cron setup';
END;
$$;

-- Schedule nightly refresh at 2 AM UTC
DO $$
BEGIN
  -- Remove existing jobs if any
  PERFORM cron.unschedule('nightly_refresh_reporting_views');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'nightly_refresh_reporting_views',
    '0 2 * * *',
    'SELECT refresh_reporting_views()'
  );
  RAISE NOTICE 'Scheduled nightly MV refresh at 2 AM UTC';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  -- Remove existing jobs if any
  PERFORM cron.unschedule('nightly_refresh_commission_summary');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'nightly_refresh_commission_summary',
    '0 3 * * *',
    'SELECT refresh_advisor_commission_summary()'
  );
  RAISE NOTICE 'Scheduled nightly commission summary refresh at 3 AM UTC';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
