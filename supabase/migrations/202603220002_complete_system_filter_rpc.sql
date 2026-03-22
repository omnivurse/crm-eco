-- ============================================================================
-- COMPLETE SYSTEM FILTER RPC
-- Add all missing CASE handlers so every system filter preset returns
-- correct data instead of silently returning empty results.
-- ============================================================================

-- Accept optional p_value parameter for value-based filters
CREATE OR REPLACE FUNCTION public.filter_records_by_system_preset(
  p_module_id uuid,
  p_preset text,
  p_user_profile_id uuid DEFAULT NULL,
  p_value text DEFAULT NULL
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: caller must belong to the org that owns this module
  IF NOT EXISTS (
    SELECT 1 FROM crm_modules m
    JOIN profiles p ON p.organization_id = m.org_id
    WHERE m.id = p_module_id
      AND p.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  CASE p_preset
    -- ══════════════════════════════════════════════════════════
    -- BUSINESS LANE FILTERS (query columns on crm_records)
    -- ══════════════════════════════════════════════════════════
    WHEN 'healthshare_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.market_type = 'healthshare';

    WHEN 'insurance_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.market_type = 'traditional_insurance';

    WHEN 'unclassified_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (r.market_type IS NULL OR r.market_type = 'unknown');

    WHEN 'needs_review_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.normalization_status = 'needs_review';

    -- ══════════════════════════════════════════════════════════
    -- OWNER FILTER (from Filter by Owner combobox)
    -- ══════════════════════════════════════════════════════════
    WHEN 'owner_is' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (
            r.owner_id = p_value::uuid
            OR r.canonical_advisor_id = p_value::uuid
          );

    -- ══════════════════════════════════════════════════════════
    -- ACTIVITY / ENGAGEMENT FILTERS
    -- ══════════════════════════════════════════════════════════
    WHEN 'touched_records' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id)
               OR EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id));

    WHEN 'untouched_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND NOT EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);

    WHEN 'my_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.owner_id = p_user_profile_id;

    WHEN 'unassigned' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.owner_id IS NULL;

    -- ══════════════════════════════════════════════════════════
    -- DATE FILTERS
    -- ══════════════════════════════════════════════════════════
    WHEN 'created_today' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.created_at >= date_trunc('day', now())
          AND r.created_at < date_trunc('day', now()) + interval '1 day';

    WHEN 'created_this_week' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.created_at >= date_trunc('week', now())
          AND r.created_at < date_trunc('week', now()) + interval '1 week';

    WHEN 'modified_today' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.updated_at >= date_trunc('day', now())
          AND r.updated_at < date_trunc('day', now()) + interval '1 day';

    WHEN 'modified_this_week' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.updated_at >= date_trunc('week', now())
          AND r.updated_at < date_trunc('week', now()) + interval '1 week';

    -- ══════════════════════════════════════════════════════════
    -- TASK / NOTE FILTERS
    -- ══════════════════════════════════════════════════════════
    WHEN 'has_activities' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id);

    WHEN 'no_activities' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND NOT EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id);

    WHEN 'has_notes' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);

    WHEN 'has_open_tasks' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_tasks t
            WHERE t.record_id = r.id AND t.status NOT IN ('completed', 'cancelled')
          );

    WHEN 'has_overdue_tasks' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_tasks t
            WHERE t.record_id = r.id
              AND t.status NOT IN ('completed', 'cancelled')
              AND t.due_at IS NOT NULL AND t.due_at < now()
          );

    -- ══════════════════════════════════════════════════════════
    -- RECORD STATE FILTERS
    -- ══════════════════════════════════════════════════════════
    WHEN 'locked' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (r.data->>'is_locked')::boolean = true;

    -- ══════════════════════════════════════════════════════════
    -- CAMPAIGN / CADENCE / COMMUNICATION FILTERS
    -- These check for existence of related campaign/cadence data
    -- ══════════════════════════════════════════════════════════
    WHEN 'campaigns' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'campaign_source' IS NOT NULL;

    WHEN 'cadences' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'cadence_id' IS NOT NULL;

    WHEN 'chats' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'chat_count' IS NOT NULL
          AND (r.data->>'chat_count')::int > 0;

    WHEN 'website_activity' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'website_visits' IS NOT NULL
          AND (r.data->>'website_visits')::int > 0;

    -- ══════════════════════════════════════════════════════════
    -- VALUE-BASED FILTERS (use p_value parameter)
    -- ══════════════════════════════════════════════════════════
    WHEN 'record_action' THEN
      RETURN QUERY
        SELECT DISTINCT a.record_id FROM crm_audit_log a
        JOIN crm_records r ON r.id = a.record_id
        WHERE r.module_id = p_module_id AND a.action = COALESCE(p_value, 'update');

    WHEN 'related_records_action' THEN
      RETURN QUERY
        SELECT DISTINCT a.record_id FROM crm_audit_log a
        JOIN crm_records r ON r.id = a.record_id
        WHERE r.module_id = p_module_id
          AND a.action = COALESCE(p_value, 'update')
          AND a.changes->>'related' IS NOT NULL;

    WHEN 'scoring_rules' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'score' IS NOT NULL
          AND (r.data->>'score')::int >= COALESCE(p_value::int, 0);

    WHEN 'latest_email_status' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'latest_email_status' = COALESCE(p_value, 'sent');

    WHEN 'attended_by' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'attended_by' ILIKE '%' || COALESCE(p_value, '') || '%';

    WHEN 'browser' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'browser' ILIKE '%' || COALESCE(p_value, '') || '%';

    WHEN 'operating_system' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'operating_system' ILIKE '%' || COALESCE(p_value, '') || '%';

    WHEN 'portal_name' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'portal_name' ILIKE '%' || COALESCE(p_value, '') || '%';

    WHEN 'search_engine' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'search_engine' ILIKE '%' || COALESCE(p_value, '') || '%';

    WHEN 'referrer' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'referrer' ILIKE '%' || COALESCE(p_value, '') || '%';

    WHEN 'time_spent_minutes' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'time_spent_minutes' IS NOT NULL
          AND (r.data->>'time_spent_minutes')::numeric >= COALESCE(p_value::numeric, 0);

    WHEN 'time_visited' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'time_visited' IS NOT NULL
          AND (r.data->>'time_visited')::int >= COALESCE(p_value::int, 0);

    WHEN 'avg_time_spent_minutes' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'avg_time_spent_minutes' IS NOT NULL
          AND (r.data->>'avg_time_spent_minutes')::numeric >= COALESCE(p_value::numeric, 0);

    WHEN 'days_visited' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'days_visited' IS NOT NULL
          AND (r.data->>'days_visited')::int >= COALESCE(p_value::int, 0);

    WHEN 'first_page_visited' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'first_page_visited' ILIKE '%' || COALESCE(p_value, '') || '%';

    WHEN 'first_visit' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'first_visit' IS NOT NULL
          AND (r.data->>'first_visit')::date >= COALESCE(p_value::date, '1970-01-01');

    WHEN 'most_recent_visit' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'most_recent_visit' IS NOT NULL
          AND (r.data->>'most_recent_visit')::date >= COALESCE(p_value::date, '1970-01-01');

    WHEN 'number_of_chats' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'number_of_chats' IS NOT NULL
          AND (r.data->>'number_of_chats')::int >= COALESCE(p_value::int, 0);

    WHEN 'visitor_score' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.data->>'visitor_score' IS NOT NULL
          AND (r.data->>'visitor_score')::int >= COALESCE(p_value::int, 0);

    ELSE
      -- Unknown preset: return empty set
      RETURN;
  END CASE;
END;
$$;

-- Re-grant execution permissions
GRANT EXECUTE ON FUNCTION public.filter_records_by_system_preset(uuid, text, uuid, text) TO authenticated;
