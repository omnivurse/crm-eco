-- =============================================================================
-- Group Demographics RPC (De-Identified / Aggregated Only)
--
-- Returns aggregated demographic breakdowns for members, enrollments,
-- health utilization, and agents. NEVER returns individual PII -- only
-- counts, percentages, and bucketed distributions.
--
-- Small-group suppression: buckets with < 5 records return count = 0
-- to prevent re-identification in small organizations.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_group_demographics(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_result    jsonb;
BEGIN
  -- Validate caller is authenticated
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate caller belongs to the requested org
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_caller_id
      AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'memberDemographics', (SELECT public._demographics_members(p_org_id)),
    'enrollmentDemographics', (SELECT public._demographics_enrollments(p_org_id)),
    'healthUtilization', (SELECT public._demographics_health(p_org_id)),
    'agentDemographics', (SELECT public._demographics_agents(p_org_id)),
    'generatedAt', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (RLS + org check inside function)
GRANT EXECUTE ON FUNCTION public.get_group_demographics(uuid) TO authenticated;


-- =============================================================================
-- Helper: Member Demographics
-- =============================================================================
CREATE OR REPLACE FUNCTION public._demographics_members(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total          bigint;
  v_active         bigint;
  v_avg_age        numeric;
  v_age_dist       jsonb;
  v_gender_dist    jsonb;
  v_state_dist     jsonb;
  v_plan_dist      jsonb;
  v_status_dist    jsonb;
  v_smoker_dist    jsonb;
  v_coverage_dist  jsonb;
BEGIN
  -- Totals
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'active')
    INTO v_total, v_active
    FROM members
   WHERE organization_id = p_org_id;

  -- Average age (rounded, no individual DOBs exposed)
  SELECT ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date))))
    INTO v_avg_age
    FROM members
   WHERE organization_id = p_org_id
     AND date_of_birth IS NOT NULL;

  -- Age distribution (bucketed)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_age_dist
    FROM (
      SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 18 THEN '0-17'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 26 THEN '18-25'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 36 THEN '26-35'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 46 THEN '36-45'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 56 THEN '46-55'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 65 THEN '56-64'
          ELSE '65+'
        END AS bucket,
        COUNT(*)::int AS cnt
      FROM members
      WHERE organization_id = p_org_id AND date_of_birth IS NOT NULL
      GROUP BY 1
      ORDER BY MIN(EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)))
    ) sub;

  -- Gender distribution
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(gender, 'Not specified'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_gender_dist
    FROM (
      SELECT gender, COUNT(*)::int AS cnt
      FROM members WHERE organization_id = p_org_id
      GROUP BY gender ORDER BY COUNT(*) DESC
    ) sub;

  -- State distribution (top 15 + Other)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_state_dist
    FROM (
      SELECT label, SUM(cnt)::int AS cnt FROM (
        SELECT
          CASE WHEN rn <= 15 THEN COALESCE(state, 'Unknown') ELSE 'Other' END AS label,
          cnt,
          rn
        FROM (
          SELECT state, COUNT(*)::int AS cnt,
                 ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rn
          FROM members WHERE organization_id = p_org_id
          GROUP BY state
        ) ranked
      ) grouped
      GROUP BY label ORDER BY SUM(cnt) DESC
    ) sub;

  -- Plan distribution
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(plan_name, 'No plan'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_plan_dist
    FROM (
      SELECT plan_name, COUNT(*)::int AS cnt
      FROM members WHERE organization_id = p_org_id
      GROUP BY plan_name ORDER BY COUNT(*) DESC LIMIT 10
    ) sub;

  -- Status distribution (with small-group suppression)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(status, 'unknown'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_status_dist
    FROM (
      SELECT status, COUNT(*)::int AS cnt
      FROM members WHERE organization_id = p_org_id
      GROUP BY status ORDER BY COUNT(*) DESC
    ) sub;

  -- Smoker distribution (with small-group suppression)
  SELECT jsonb_build_object(
    'smoker',    CASE WHEN COUNT(*) FILTER (WHERE is_smoker = true)  < 5 THEN 0 ELSE COUNT(*) FILTER (WHERE is_smoker = true)::int  END,
    'nonSmoker', CASE WHEN COUNT(*) FILTER (WHERE is_smoker = false) < 5 THEN 0 ELSE COUNT(*) FILTER (WHERE is_smoker = false)::int END,
    'unknown',   CASE WHEN COUNT(*) FILTER (WHERE is_smoker IS NULL) < 5 THEN 0 ELSE COUNT(*) FILTER (WHERE is_smoker IS NULL)::int END
  ) INTO v_smoker_dist
  FROM members WHERE organization_id = p_org_id;

  -- Coverage type distribution
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(coverage_type, 'Not specified'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_coverage_dist
    FROM (
      SELECT coverage_type, COUNT(*)::int AS cnt
      FROM members WHERE organization_id = p_org_id
      GROUP BY coverage_type ORDER BY COUNT(*) DESC
    ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'avgAge', COALESCE(v_avg_age, 0),
    'ageDistribution', v_age_dist,
    'genderDistribution', v_gender_dist,
    'stateDistribution', v_state_dist,
    'planDistribution', v_plan_dist,
    'statusDistribution', v_status_dist,
    'smokerDistribution', v_smoker_dist,
    'coverageDistribution', v_coverage_dist
  );
END;
$$;


-- =============================================================================
-- Helper: Enrollment Demographics
-- =============================================================================
CREATE OR REPLACE FUNCTION public._demographics_enrollments(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total         bigint;
  v_approved      bigint;
  v_approval_rate numeric;
  v_status_dist   jsonb;
  v_channel_dist  jsonb;
  v_hh_dist       jsonb;
  v_monthly_trend jsonb;
  v_age65_count   bigint;
  v_mandate_count bigint;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'approved')
    INTO v_total, v_approved
    FROM enrollments
   WHERE organization_id = p_org_id;

  v_approval_rate := CASE WHEN v_total > 0
    THEN ROUND((v_approved::numeric / v_total) * 100, 1)
    ELSE 0 END;

  -- Status distribution (with small-group suppression)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(status, 'unknown'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_status_dist
    FROM (
      SELECT status, COUNT(*)::int AS cnt
      FROM enrollments WHERE organization_id = p_org_id
      GROUP BY status ORDER BY COUNT(*) DESC
    ) sub;

  -- Channel distribution
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(channel, 'Direct'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_channel_dist
    FROM (
      SELECT channel, COUNT(*)::int AS cnt
      FROM enrollments WHERE organization_id = p_org_id
      GROUP BY channel ORDER BY COUNT(*) DESC
    ) sub;

  -- Household size distribution
  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_hh_dist
    FROM (
      SELECT
        CASE
          WHEN household_size IS NULL THEN 'Unknown'
          WHEN household_size >= 5 THEN '5+'
          ELSE household_size::text
        END AS bucket,
        COUNT(*)::int AS cnt
      FROM enrollments WHERE organization_id = p_org_id
      GROUP BY 1 ORDER BY 1
    ) sub;

  -- Monthly trend (last 12 months)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', TO_CHAR(month, 'YYYY-MM'),
    'count', cnt::int
  ) ORDER BY month), '[]'::jsonb)
    INTO v_monthly_trend
    FROM (
      SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS cnt
      FROM enrollments
      WHERE organization_id = p_org_id
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
      GROUP BY 1
    ) sub;

  -- Warning counts
  SELECT COUNT(*) FILTER (WHERE has_age65_warning = true),
         COUNT(*) FILTER (WHERE has_mandate_warning = true)
    INTO v_age65_count, v_mandate_count
    FROM enrollments
   WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'total', v_total,
    'approved', v_approved,
    'approvalRate', v_approval_rate,
    'statusDistribution', v_status_dist,
    'channelDistribution', v_channel_dist,
    'householdSizeDistribution', v_hh_dist,
    'monthlyTrend', v_monthly_trend,
    'age65WarningCount', v_age65_count,
    'mandateWarningCount', v_mandate_count
  );
END;
$$;


-- =============================================================================
-- Helper: Health Utilization
-- =============================================================================
CREATE OR REPLACE FUNCTION public._demographics_health(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_needs     bigint;
  v_approved_needs  bigint;
  v_approval_rate   numeric;
  v_status_dist     jsonb;
  v_type_dist       jsonb;
  v_preexist_rate   numeric;
  v_total_members   bigint;
  v_preexist_count  bigint;
BEGIN
  -- Needs counts
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'approved')
    INTO v_total_needs, v_approved_needs
    FROM needs
   WHERE organization_id = p_org_id;

  v_approval_rate := CASE WHEN v_total_needs > 0
    THEN ROUND((v_approved_needs::numeric / v_total_needs) * 100, 1)
    ELSE 0 END;

  -- Needs by status (with small-group suppression)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(status, 'unknown'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_status_dist
    FROM (
      SELECT status, COUNT(*)::int AS cnt
      FROM needs WHERE organization_id = p_org_id
      GROUP BY status ORDER BY COUNT(*) DESC
    ) sub;

  -- Needs by type/category
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(need_type, 'Other'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_type_dist
    FROM (
      SELECT need_type, COUNT(*)::int AS cnt
      FROM needs WHERE organization_id = p_org_id
      GROUP BY need_type ORDER BY COUNT(*) DESC LIMIT 10
    ) sub;

  -- Pre-existing conditions rate from members
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE has_existing_condition = true)
    INTO v_total_members, v_preexist_count
    FROM members
   WHERE organization_id = p_org_id;

  v_preexist_rate := CASE WHEN v_total_members > 0
    THEN ROUND((v_preexist_count::numeric / v_total_members) * 100, 1)
    ELSE 0 END;

  RETURN jsonb_build_object(
    'totalNeeds', v_total_needs,
    'approvedNeeds', v_approved_needs,
    'approvalRate', v_approval_rate,
    'statusDistribution', v_status_dist,
    'typeDistribution', v_type_dist,
    'preExistingConditionRate', v_preexist_rate
  );
END;
$$;


-- =============================================================================
-- Helper: Agent/Advisor Demographics
-- =============================================================================
CREATE OR REPLACE FUNCTION public._demographics_agents(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total         bigint;
  v_active        bigint;
  v_mpb_certified bigint;
  v_eo_current    bigint;
  v_with_downline bigint;
  v_state_dist    jsonb;
  v_type_dist     jsonb;
  v_status_dist   jsonb;
  v_cert_rate     numeric;
  v_eo_rate       numeric;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'active'),
         COUNT(*) FILTER (WHERE mpb_certified = true),
         COUNT(*) FILTER (WHERE mpb_eo_current = true),
         COUNT(*) FILTER (WHERE id IN (
           SELECT DISTINCT parent_advisor_id FROM advisors
           WHERE organization_id = p_org_id AND parent_advisor_id IS NOT NULL
         ))
    INTO v_total, v_active, v_mpb_certified, v_eo_current, v_with_downline
    FROM advisors
   WHERE organization_id = p_org_id;

  v_cert_rate := CASE WHEN v_total > 0 THEN ROUND((v_mpb_certified::numeric / v_total) * 100, 1) ELSE 0 END;
  v_eo_rate   := CASE WHEN v_total > 0 THEN ROUND((v_eo_current::numeric / v_total) * 100, 1) ELSE 0 END;

  -- State distribution
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(state, 'Unknown'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_state_dist
    FROM (
      SELECT state, COUNT(*)::int AS cnt
      FROM advisors WHERE organization_id = p_org_id
      GROUP BY state ORDER BY COUNT(*) DESC LIMIT 15
    ) sub;

  -- Producer type distribution
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(producer_type, 'Not specified'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_type_dist
    FROM (
      SELECT producer_type, COUNT(*)::int AS cnt
      FROM advisors WHERE organization_id = p_org_id
      GROUP BY producer_type ORDER BY COUNT(*) DESC
    ) sub;

  -- Status distribution (with small-group suppression)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', COALESCE(status, 'unknown'), 'count',
           CASE WHEN cnt < 5 THEN 0 ELSE cnt END)), '[]'::jsonb)
    INTO v_status_dist
    FROM (
      SELECT status, COUNT(*)::int AS cnt
      FROM advisors WHERE organization_id = p_org_id
      GROUP BY status ORDER BY COUNT(*) DESC
    ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'mpbCertifiedRate', v_cert_rate,
    'eoCurrentRate', v_eo_rate,
    'withDownline', v_with_downline,
    'independent', v_total - v_with_downline,
    'stateDistribution', v_state_dist,
    'producerTypeDistribution', v_type_dist,
    'statusDistribution', v_status_dist
  );
END;
$$;
