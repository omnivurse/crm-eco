-- ============================================================================
-- ADVISOR PERFORMANCE REPORTS
-- Tables: crm_report_filters, crm_report_results_cache
-- RPCs: 4 report functions + 3 widget functions
-- ============================================================================

-- ============================================================================
-- SECTION 1: crm_report_filters — Saved filter presets
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_report_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filter_type text NOT NULL CHECK (filter_type IN (
    'advisor', 'date_range', 'state', 'plan', 'status', 'composite'
  )),
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_report_filters_org
  ON public.crm_report_filters(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_report_filters_org_type
  ON public.crm_report_filters(org_id, filter_type);
CREATE INDEX IF NOT EXISTS idx_crm_report_filters_created_by
  ON public.crm_report_filters(created_by);

ALTER TABLE public.crm_report_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_report_filters_select" ON public.crm_report_filters;
CREATE POLICY "crm_report_filters_select" ON public.crm_report_filters
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "crm_report_filters_insert" ON public.crm_report_filters;
CREATE POLICY "crm_report_filters_insert" ON public.crm_report_filters
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "crm_report_filters_update" ON public.crm_report_filters;
CREATE POLICY "crm_report_filters_update" ON public.crm_report_filters
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR org_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS "crm_report_filters_delete" ON public.crm_report_filters;
CREATE POLICY "crm_report_filters_delete" ON public.crm_report_filters
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR org_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ============================================================================
-- SECTION 2: crm_report_results_cache — Cached query results with TTL
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_report_results_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  report_id uuid REFERENCES public.crm_reports(id) ON DELETE CASCADE,
  template_key text,
  filters_hash text NOT NULL,
  result_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_summary jsonb DEFAULT '{}'::jsonb,
  row_count integer DEFAULT 0,
  computed_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_report_cache_org_key
  ON public.crm_report_results_cache(org_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_report_cache_expires
  ON public.crm_report_results_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_report_cache_org_template
  ON public.crm_report_results_cache(org_id, template_key);

ALTER TABLE public.crm_report_results_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_cache_select" ON public.crm_report_results_cache;
CREATE POLICY "report_cache_select" ON public.crm_report_results_cache
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "report_cache_insert" ON public.crm_report_results_cache;
CREATE POLICY "report_cache_insert" ON public.crm_report_results_cache
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "report_cache_delete" ON public.crm_report_results_cache;
CREATE POLICY "report_cache_delete" ON public.crm_report_results_cache
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_report_results_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM crm_report_results_cache WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_report_results_cache() TO authenticated;

-- ============================================================================
-- SECTION 3: REPORT RPC — Advisor Enrollment Report
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_advisor_enrollment_report(
  p_org_id uuid,
  p_advisor_ids uuid[] DEFAULT NULL,
  p_include_downline boolean DEFAULT false,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL,
  p_states text[] DEFAULT NULL,
  p_plan_names text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_advisor_ids uuid[];
  v_result jsonb;
BEGIN
  -- Expand downline if requested
  IF p_advisor_ids IS NOT NULL AND p_include_downline THEN
    SELECT array_agg(DISTINCT aid) INTO v_advisor_ids
    FROM (
      SELECT unnest(p_advisor_ids) AS aid
      UNION
      SELECT dl FROM unnest(p_advisor_ids) AS root_id,
        LATERAL get_advisor_downline_ids(root_id) AS dl
    ) expanded;
  ELSE
    v_advisor_ids := p_advisor_ids;
  END IF;

  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(row_data ORDER BY total_enrollments DESC), '[]'::jsonb),
    'total', COUNT(*)
  ) INTO v_result
  FROM (
    SELECT
      a.id AS advisor_id,
      a.first_name || ' ' || a.last_name AS advisor_name,
      a.email AS advisor_email,
      a.agency_name,
      a.commission_tier,
      COUNT(e.id) AS total_enrollments,
      COUNT(e.id) FILTER (WHERE e.status = 'active') AS active_count,
      COUNT(e.id) FILTER (WHERE e.status = 'pending') AS pending_count,
      COUNT(e.id) FILTER (WHERE e.status = 'cancelled') AS cancelled_count,
      COUNT(e.id) FILTER (WHERE e.status = 'terminated') AS terminated_count,
      COUNT(e.id) FILTER (WHERE e.status = 'inactive') AS inactive_count,
      jsonb_build_object(
        'advisor_id', a.id,
        'advisor_name', a.first_name || ' ' || a.last_name,
        'advisor_email', a.email,
        'agency_name', a.agency_name,
        'commission_tier', a.commission_tier,
        'total_enrollments', COUNT(e.id),
        'active', COUNT(e.id) FILTER (WHERE e.status = 'active'),
        'pending', COUNT(e.id) FILTER (WHERE e.status = 'pending'),
        'cancelled', COUNT(e.id) FILTER (WHERE e.status = 'cancelled'),
        'terminated', COUNT(e.id) FILTER (WHERE e.status = 'terminated'),
        'inactive', COUNT(e.id) FILTER (WHERE e.status = 'inactive')
      ) AS row_data
    FROM advisors a
    LEFT JOIN enrollments e ON e.advisor_id = a.id
      AND (p_date_start IS NULL OR e.enrollment_date >= p_date_start)
      AND (p_date_end IS NULL OR e.enrollment_date <= p_date_end)
      AND (p_statuses IS NULL OR e.status = ANY(p_statuses))
    LEFT JOIN members m ON e.member_id = m.id
      AND (p_states IS NULL OR m.state = ANY(p_states))
    WHERE a.organization_id = p_org_id
      AND (v_advisor_ids IS NULL OR a.id = ANY(v_advisor_ids))
      AND (p_states IS NULL OR m.id IS NOT NULL)
    GROUP BY a.id, a.first_name, a.last_name, a.email, a.agency_name, a.commission_tier
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_advisor_enrollment_report(uuid, uuid[], boolean, date, date, text[], text[], text[]) TO authenticated;

-- ============================================================================
-- SECTION 4: REPORT RPC — Advisor Active Members Report
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_advisor_active_members_report(
  p_org_id uuid,
  p_advisor_ids uuid[] DEFAULT NULL,
  p_include_downline boolean DEFAULT false,
  p_states text[] DEFAULT NULL,
  p_plan_names text[] DEFAULT NULL,
  p_plan_types text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_advisor_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_advisor_ids IS NOT NULL AND p_include_downline THEN
    SELECT array_agg(DISTINCT aid) INTO v_advisor_ids
    FROM (
      SELECT unnest(p_advisor_ids) AS aid
      UNION
      SELECT dl FROM unnest(p_advisor_ids) AS root_id,
        LATERAL get_advisor_downline_ids(root_id) AS dl
    ) expanded;
  ELSE
    v_advisor_ids := p_advisor_ids;
  END IF;

  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(row_data ORDER BY active_members DESC), '[]'::jsonb),
    'total', COUNT(*)
  ) INTO v_result
  FROM (
    SELECT
      a.id AS advisor_id,
      COUNT(m.id) AS active_members,
      jsonb_build_object(
        'advisor_id', a.id,
        'advisor_name', a.first_name || ' ' || a.last_name,
        'advisor_email', a.email,
        'agency_name', a.agency_name,
        'commission_tier', a.commission_tier,
        'active_members', COUNT(m.id),
        'states', jsonb_agg(DISTINCT m.state) FILTER (WHERE m.state IS NOT NULL),
        'plan_breakdown', jsonb_object_agg(
          COALESCE(e.metadata->>'plan_name', 'Unknown'),
          1
        ) FILTER (WHERE e.id IS NOT NULL)
      ) AS row_data
    FROM advisors a
    LEFT JOIN members m ON m.advisor_id = a.id
      AND m.status = 'active'
      AND (p_states IS NULL OR m.state = ANY(p_states))
    LEFT JOIN enrollments e ON e.member_id = m.id AND e.status = 'active'
    WHERE a.organization_id = p_org_id
      AND (v_advisor_ids IS NULL OR a.id = ANY(v_advisor_ids))
    GROUP BY a.id, a.first_name, a.last_name, a.email, a.agency_name, a.commission_tier
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_advisor_active_members_report(uuid, uuid[], boolean, text[], text[], text[]) TO authenticated;

-- ============================================================================
-- SECTION 5: REPORT RPC — Advisor Cancellations Report
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_advisor_cancellations_report(
  p_org_id uuid,
  p_advisor_ids uuid[] DEFAULT NULL,
  p_include_downline boolean DEFAULT false,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL,
  p_states text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_advisor_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_advisor_ids IS NOT NULL AND p_include_downline THEN
    SELECT array_agg(DISTINCT aid) INTO v_advisor_ids
    FROM (
      SELECT unnest(p_advisor_ids) AS aid
      UNION
      SELECT dl FROM unnest(p_advisor_ids) AS root_id,
        LATERAL get_advisor_downline_ids(root_id) AS dl
    ) expanded;
  ELSE
    v_advisor_ids := p_advisor_ids;
  END IF;

  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(row_data ORDER BY cancellation_rate DESC), '[]'::jsonb),
    'total', COUNT(*)
  ) INTO v_result
  FROM (
    SELECT
      a.id AS advisor_id,
      CASE WHEN total_count > 0
        THEN ROUND((cancelled_count::numeric / total_count) * 100, 2)
        ELSE 0
      END AS cancellation_rate,
      jsonb_build_object(
        'advisor_id', a.id,
        'advisor_name', a.first_name || ' ' || a.last_name,
        'advisor_email', a.email,
        'agency_name', a.agency_name,
        'total_members', total_count,
        'active_members', active_count,
        'cancelled_count', cancelled_count,
        'terminated_count', terminated_count,
        'cancellation_rate', CASE WHEN total_count > 0
          THEN ROUND((cancelled_count::numeric / total_count) * 100, 2)
          ELSE 0 END
      ) AS row_data
    FROM advisors a
    LEFT JOIN LATERAL (
      SELECT
        COUNT(m.id) AS total_count,
        COUNT(m.id) FILTER (WHERE m.status = 'active') AS active_count,
        COUNT(m.id) FILTER (WHERE m.status IN ('cancelled', 'inactive')) AS cancelled_count,
        COUNT(m.id) FILTER (WHERE m.status = 'terminated') AS terminated_count
      FROM members m
      WHERE m.advisor_id = a.id
        AND (p_states IS NULL OR m.state = ANY(p_states))
        AND (p_date_start IS NULL OR m.termination_date >= p_date_start OR m.status = 'active')
        AND (p_date_end IS NULL OR m.termination_date <= p_date_end OR m.status = 'active')
    ) counts ON true
    WHERE a.organization_id = p_org_id
      AND (v_advisor_ids IS NULL OR a.id = ANY(v_advisor_ids))
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_advisor_cancellations_report(uuid, uuid[], boolean, date, date, text[]) TO authenticated;

-- ============================================================================
-- SECTION 6: REPORT RPC — Advisor Revenue Report
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_advisor_revenue_report(
  p_org_id uuid,
  p_advisor_ids uuid[] DEFAULT NULL,
  p_include_downline boolean DEFAULT false,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_advisor_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_advisor_ids IS NOT NULL AND p_include_downline THEN
    SELECT array_agg(DISTINCT aid) INTO v_advisor_ids
    FROM (
      SELECT unnest(p_advisor_ids) AS aid
      UNION
      SELECT dl FROM unnest(p_advisor_ids) AS root_id,
        LATERAL get_advisor_downline_ids(root_id) AS dl
    ) expanded;
  ELSE
    v_advisor_ids := p_advisor_ids;
  END IF;

  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(row_data ORDER BY gross_commissions DESC), '[]'::jsonb),
    'total', COUNT(*)
  ) INTO v_result
  FROM (
    SELECT
      a.id AS advisor_id,
      COALESCE(SUM(s.gross_commissions), 0) AS gross_commissions,
      jsonb_build_object(
        'advisor_id', a.id,
        'advisor_name', a.first_name || ' ' || a.last_name,
        'advisor_email', a.email,
        'agency_name', a.agency_name,
        'commission_tier', a.commission_tier,
        'signup_commissions', COALESCE(SUM(s.signup_commissions), 0),
        'monthly_commissions', COALESCE(SUM(s.monthly_commissions), 0),
        'override_commissions', COALESCE(SUM(s.override_commissions), 0),
        'bonus_commissions', COALESCE(SUM(s.bonus_commissions), 0),
        'adjustments', COALESCE(SUM(s.adjustments), 0),
        'clawbacks', COALESCE(SUM(s.clawbacks), 0),
        'gross_commissions', COALESCE(SUM(s.gross_commissions), 0),
        'net_commissions', COALESCE(SUM(s.net_commissions), 0),
        'total_enrollments', COALESCE(SUM(s.total_enrollments), 0),
        'active_members', MAX(s.active_members)
      ) AS row_data
    FROM advisors a
    LEFT JOIN advisor_commission_summary s ON s.advisor_id = a.id
      AND (p_date_start IS NULL OR s.period_month >= p_date_start)
      AND (p_date_end IS NULL OR s.period_month <= p_date_end)
    WHERE a.organization_id = p_org_id
      AND (v_advisor_ids IS NULL OR a.id = ANY(v_advisor_ids))
    GROUP BY a.id, a.first_name, a.last_name, a.email, a.agency_name, a.commission_tier
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_advisor_revenue_report(uuid, uuid[], boolean, date, date) TO authenticated;

-- ============================================================================
-- SECTION 7: WIDGET RPC — Top Advisors
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_top_advisors_widget(
  p_org_id uuid,
  p_metric text DEFAULT 'enrollments',
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_period date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  IF p_metric = 'revenue' THEN
    SELECT COALESCE(jsonb_agg(row_data ORDER BY value DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'advisor_id', a.id,
        'name', a.first_name || ' ' || a.last_name,
        'agency_name', a.agency_name,
        'value', COALESCE(s.gross_commissions, 0),
        'metric', 'revenue'
      ) AS row_data,
      COALESCE(s.gross_commissions, 0) AS value
      FROM advisors a
      LEFT JOIN advisor_commission_summary s
        ON s.advisor_id = a.id AND s.period_month = v_period
      WHERE a.organization_id = p_org_id AND a.status = 'active'
      ORDER BY value DESC
      LIMIT p_limit
    ) sub;
  ELSE
    -- Default: enrollments
    SELECT COALESCE(jsonb_agg(row_data ORDER BY value DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'advisor_id', a.id,
        'name', a.first_name || ' ' || a.last_name,
        'agency_name', a.agency_name,
        'value', COUNT(e.id),
        'metric', 'enrollments'
      ) AS row_data,
      COUNT(e.id) AS value
      FROM advisors a
      LEFT JOIN enrollments e ON e.advisor_id = a.id
        AND e.enrollment_date >= v_period
        AND e.enrollment_date < (v_period + interval '1 month')::date
      WHERE a.organization_id = p_org_id AND a.status = 'active'
      GROUP BY a.id, a.first_name, a.last_name, a.agency_name
      ORDER BY value DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN jsonb_build_object('advisors', v_result, 'period', v_period, 'metric', p_metric);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_top_advisors_widget(uuid, text, integer) TO authenticated;

-- ============================================================================
-- SECTION 8: WIDGET RPC — Lowest Churn Advisors
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_lowest_churn_advisors_widget(
  p_org_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY churn_rate ASC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'advisor_id', a.id,
        'name', a.first_name || ' ' || a.last_name,
        'agency_name', a.agency_name,
        'churn_rate', ROUND(
          CASE WHEN total_members > 0
            THEN (cancelled_count::numeric / total_members) * 100
            ELSE 0
          END, 2),
        'total_members', total_members,
        'cancelled_count', cancelled_count,
        'active_members', active_count
      ) AS row_data,
      CASE WHEN total_members > 0
        THEN (cancelled_count::numeric / total_members) * 100
        ELSE 0
      END AS churn_rate
    FROM advisors a
    LEFT JOIN LATERAL (
      SELECT
        COUNT(m.id) AS total_members,
        COUNT(m.id) FILTER (WHERE m.status = 'active') AS active_count,
        COUNT(m.id) FILTER (WHERE m.status IN ('cancelled', 'inactive', 'terminated')) AS cancelled_count
      FROM members m
      WHERE m.advisor_id = a.id
    ) mc ON true
    WHERE a.organization_id = p_org_id
      AND a.status = 'active'
      AND mc.total_members >= 5  -- Minimum threshold to avoid noise
    ORDER BY churn_rate ASC
    LIMIT p_limit
  ) sub;

  RETURN jsonb_build_object('advisors', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lowest_churn_advisors_widget(uuid, integer) TO authenticated;

-- ============================================================================
-- SECTION 9: WIDGET RPC — Advisor Member Retention (time-series)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_advisor_retention_widget(
  p_org_id uuid,
  p_months integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'month', TO_CHAR(month_date, 'YYYY-MM'),
      'retention_rate', ROUND(
        CASE WHEN total_count > 0
          THEN (active_count::numeric / total_count) * 100
          ELSE 0
        END, 1),
      'active_count', active_count,
      'total_count', total_count
    ) ORDER BY month_date
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      gs.month_date,
      COUNT(m.id) AS total_count,
      COUNT(m.id) FILTER (WHERE
        m.status = 'active'
        OR (m.termination_date IS NOT NULL AND m.termination_date > gs.month_date + interval '1 month')
      ) AS active_count
    FROM generate_series(
      date_trunc('month', CURRENT_DATE - (p_months || ' months')::interval)::date,
      date_trunc('month', CURRENT_DATE)::date,
      '1 month'::interval
    ) AS gs(month_date)
    LEFT JOIN members m ON m.org_id = p_org_id
      AND m.effective_date <= gs.month_date + interval '1 month'
      AND (m.termination_date IS NULL OR m.termination_date >= gs.month_date)
    LEFT JOIN advisors a ON a.id = m.advisor_id AND a.organization_id = p_org_id
    WHERE a.id IS NOT NULL  -- Only count members with advisors
    GROUP BY gs.month_date
  ) monthly;

  RETURN jsonb_build_object('months', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_advisor_retention_widget(uuid, integer) TO authenticated;

-- ============================================================================
-- SECTION 10: COMMENTS
-- ============================================================================
COMMENT ON TABLE public.crm_report_filters IS 'Saved filter presets for advisor and CRM reports';
COMMENT ON TABLE public.crm_report_results_cache IS 'TTL-based cache for expensive report query results';
COMMENT ON FUNCTION public.rpc_advisor_enrollment_report IS 'Enrollments grouped by advisor with status breakdown';
COMMENT ON FUNCTION public.rpc_advisor_active_members_report IS 'Active members per advisor with plan details';
COMMENT ON FUNCTION public.rpc_advisor_cancellations_report IS 'Cancellations by advisor with churn rate';
COMMENT ON FUNCTION public.rpc_advisor_revenue_report IS 'Commission revenue per advisor by type';
COMMENT ON FUNCTION public.rpc_top_advisors_widget IS 'Top N advisors by enrollments or revenue for dashboard widget';
COMMENT ON FUNCTION public.rpc_lowest_churn_advisors_widget IS 'Advisors with lowest churn rate for dashboard widget';
COMMENT ON FUNCTION public.rpc_advisor_retention_widget IS 'Monthly retention time-series for dashboard widget';
