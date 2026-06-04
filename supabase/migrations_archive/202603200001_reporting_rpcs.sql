-- ============================================================================
-- PHASE 6 — REPORTING RPCS
-- Dashboard stats, reporting views, and KPI functions
-- ============================================================================

-- ============================================================================
-- 1. Dashboard KPI Stats — single call returns all dashboard counts
-- ============================================================================

CREATE OR REPLACE FUNCTION get_crm_dashboard_stats(p_org_id uuid, p_module_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_mod_id uuid;
BEGIN
  -- Default to contacts module if not specified
  IF p_module_id IS NULL THEN
    SELECT id INTO v_mod_id FROM crm_modules
    WHERE org_id = p_org_id AND key = 'contacts' LIMIT 1;
  ELSE
    v_mod_id := p_module_id;
  END IF;

  SELECT jsonb_build_object(
    -- Total counts
    'total_records', count(*),
    'total_individual', count(*) FILTER (WHERE record_type = 'individual'),
    'total_group', count(*) FILTER (WHERE record_type = 'group'),

    -- By plan type
    'healthshare', count(*) FILTER (WHERE market_type = 'healthshare'),
    'traditional_insurance', count(*) FILTER (WHERE market_type = 'traditional_insurance'),
    'unknown_plan_type', count(*) FILTER (WHERE market_type = 'unknown' OR market_type IS NULL),

    -- Tobacco
    'tobacco_users', count(*) FILTER (WHERE tobacco_user = true AND record_type = 'individual'),
    'non_tobacco', count(*) FILTER (WHERE tobacco_user = false AND record_type = 'individual'),
    'tobacco_unknown', count(*) FILTER (WHERE tobacco_user IS NULL AND record_type = 'individual'),

    -- Normalization / review
    'normalized', count(*) FILTER (WHERE normalization_status = 'normalized'),
    'needs_review', count(*) FILTER (WHERE normalization_status = 'needs_review'),
    'needs_classification', count(*) FILTER (WHERE market_type = 'unknown' OR market_type IS NULL),

    -- Carrier
    'with_carrier', count(*) FILTER (WHERE carrier_id IS NOT NULL),
    'missing_carrier', count(*) FILTER (WHERE carrier_id IS NULL AND record_type = 'individual'),

    -- Advisor assignment
    'with_advisor', count(*) FILTER (WHERE canonical_advisor_id IS NOT NULL OR normalized_advisor_name IS NOT NULL),
    'unassigned_advisor', count(*) FILTER (WHERE canonical_advisor_id IS NULL AND normalized_advisor_name IS NULL AND record_type = 'individual'),

    -- Import source
    'from_zoho', count(*) FILTER (WHERE import_source = 'zoho_csv'),
    'from_csv', count(*) FILTER (WHERE import_source = 'csv_import'),
    'manual_entry', count(*) FILTER (WHERE import_source = 'manual' OR import_source IS NULL),

    -- Time-based
    'created_last_7d', count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'created_last_30d', count(*) FILTER (WHERE created_at >= now() - interval '30 days'),
    'updated_last_7d', count(*) FILTER (WHERE updated_at >= now() - interval '7 days')
  ) INTO v_result
  FROM crm_records
  WHERE org_id = p_org_id
    AND (v_mod_id IS NULL OR module_id = v_mod_id);

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_crm_dashboard_stats(uuid, uuid) TO authenticated;

-- ============================================================================
-- 2. Members by Advisor — top advisors with record counts
-- ============================================================================

CREATE OR REPLACE FUNCTION get_members_by_advisor(p_org_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE(advisor_name text, record_count bigint, healthshare_count bigint, insurance_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(TRIM(r.normalized_advisor_name), ''), 'Unassigned') AS advisor_name,
    count(*) AS record_count,
    count(*) FILTER (WHERE r.market_type = 'healthshare') AS healthshare_count,
    count(*) FILTER (WHERE r.market_type = 'traditional_insurance') AS insurance_count
  FROM crm_records r
  WHERE r.org_id = p_org_id
    AND r.record_type = 'individual'
  GROUP BY 1
  ORDER BY record_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_members_by_advisor(uuid, int) TO authenticated;

-- ============================================================================
-- 3. Members by Carrier — top carriers with record counts
-- ============================================================================

CREATE OR REPLACE FUNCTION get_members_by_carrier(p_org_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE(carrier_name text, carrier_type text, record_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(ic.carrier_name, 'No Carrier Assigned') AS carrier_name,
    COALESCE(ic.carrier_type, 'unknown') AS carrier_type,
    count(*) AS record_count
  FROM crm_records r
  LEFT JOIN insurance_carriers ic ON ic.id = r.carrier_id
  WHERE r.org_id = p_org_id
    AND r.record_type = 'individual'
  GROUP BY ic.carrier_name, ic.carrier_type
  ORDER BY record_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_members_by_carrier(uuid, int) TO authenticated;

-- ============================================================================
-- 4. Members by Age Range
-- ============================================================================

CREATE OR REPLACE FUNCTION get_members_by_age_range(p_org_id uuid)
RETURNS TABLE(age_bucket text, record_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(r.age_range, 'Unknown') AS age_bucket,
    count(*) AS record_count
  FROM crm_records r
  WHERE r.org_id = p_org_id
    AND r.record_type = 'individual'
  GROUP BY 1
  ORDER BY
    CASE COALESCE(r.age_range, 'Unknown')
      WHEN '0-17' THEN 1
      WHEN '18-25' THEN 2
      WHEN '26-34' THEN 3
      WHEN '35-44' THEN 4
      WHEN '45-54' THEN 5
      WHEN '55-64' THEN 6
      WHEN '65+' THEN 7
      ELSE 8
    END;
$$;

GRANT EXECUTE ON FUNCTION get_members_by_age_range(uuid) TO authenticated;

-- ============================================================================
-- 5. Members by Status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_members_by_status(p_org_id uuid)
RETURNS TABLE(member_status text, record_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(TRIM(r.status), ''), 'No Status') AS member_status,
    count(*) AS record_count
  FROM crm_records r
  WHERE r.org_id = p_org_id
    AND r.record_type = 'individual'
  GROUP BY 1
  ORDER BY record_count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_members_by_status(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
