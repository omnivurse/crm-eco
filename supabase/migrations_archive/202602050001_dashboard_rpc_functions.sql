-- Dashboard RPC Functions
-- Replaces unbounded record fetch + JS counting with DB-level COUNT aggregation
-- Combines hero stats into a single RPC call
-- Net effect: 5-8 dashboard queries → 2 RPC calls, ~50k+ rows → ~1KB JSON

-- =============================================================================
-- Function 1: get_module_stats(p_org_id uuid)
-- Replaces getModuleStats() — COUNT aggregation at DB level
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_module_stats(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_one_week_ago timestamptz := now() - interval '7 days';
BEGIN
  -- Count crm_records per enabled module using GROUP BY (no row fetch)
  -- Then merge legacy table counts for leads/contacts
  WITH module_counts AS (
    SELECT
      m.key AS module_key,
      COALESCE(m.name_plural, m.name || 's') AS module_name,
      COUNT(r.id) AS total_records,
      COUNT(r.id) FILTER (WHERE r.created_at >= v_one_week_ago) AS created_this_week
    FROM crm_modules m
    LEFT JOIN crm_records r ON r.module_id = m.id
    WHERE m.org_id = p_org_id AND m.is_enabled = true
    GROUP BY m.key, m.name, m.name_plural
  ),
  legacy_leads AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE created_at >= v_one_week_ago) AS this_week
    FROM leads
    WHERE organization_id = p_org_id
  ),
  legacy_members AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE created_at >= v_one_week_ago) AS this_week
    FROM members
    WHERE organization_id = p_org_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'moduleKey', mc.module_key,
      'moduleName', mc.module_name,
      'totalRecords', mc.total_records +
        CASE mc.module_key
          WHEN 'leads' THEN COALESCE((SELECT total FROM legacy_leads), 0)
          WHEN 'contacts' THEN COALESCE((SELECT total FROM legacy_members), 0)
          ELSE 0
        END,
      'createdThisWeek', mc.created_this_week +
        CASE mc.module_key
          WHEN 'leads' THEN COALESCE((SELECT this_week FROM legacy_leads), 0)
          WHEN 'contacts' THEN COALESCE((SELECT this_week FROM legacy_members), 0)
          ELSE 0
        END
    )
  ) INTO v_result
  FROM module_counts mc;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_module_stats(uuid) TO authenticated;

-- =============================================================================
-- Function 2: get_dashboard_hero_stats(p_org_id uuid, p_user_id uuid)
-- Combined function returning all hero section stats in a single round-trip
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_hero_stats(
  p_org_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end   timestamptz := v_today_start + interval '1 day';
  v_seven_days  timestamptz := now() - interval '7 days';
  v_todays_task_count int;
  v_overdue_count int;
  v_at_risk_count int;
  v_new_this_week bigint;
BEGIN
  -- Today's tasks assigned to user (not completed, due today)
  SELECT COUNT(*) INTO v_todays_task_count
  FROM crm_tasks
  WHERE assigned_to = p_user_id
    AND status != 'completed'
    AND due_at >= v_today_start
    AND due_at < v_today_end;

  -- Overdue tasks (due before now, not completed)
  SELECT COUNT(*) INTO v_overdue_count
  FROM crm_tasks
  WHERE assigned_to = p_user_id
    AND status != 'completed'
    AND due_at < now();

  -- At-risk deals: not updated in > 7 days, not closed
  SELECT COUNT(*) INTO v_at_risk_count
  FROM crm_records r
  JOIN crm_modules m ON m.id = r.module_id
  WHERE m.org_id = p_org_id
    AND m.key = 'deals'
    AND r.updated_at < v_seven_days
    AND r.data->>'stage' NOT IN ('Closed Won', 'Closed Lost', 'closed_won', 'closed_lost');

  -- New records created this week across all modules
  SELECT COUNT(*) INTO v_new_this_week
  FROM crm_records r
  JOIN crm_modules m ON m.id = r.module_id
  WHERE m.org_id = p_org_id
    AND m.is_enabled = true
    AND r.created_at >= v_seven_days;

  RETURN jsonb_build_object(
    'todaysTaskCount', v_todays_task_count,
    'overdueCount', v_overdue_count,
    'atRiskCount', v_at_risk_count,
    'newThisWeek', v_new_this_week
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_hero_stats(uuid, uuid) TO authenticated;
