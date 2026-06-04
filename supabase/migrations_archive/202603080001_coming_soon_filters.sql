-- =============================================================================
-- Coming Soon Filters: visitor sessions table + extended RPCs
-- Enables all 23 system filters and 6 related module filters previously
-- marked "Coming Soon" in the filter sidebar.
-- =============================================================================

-- =============================================================================
-- 1. crm_visitor_sessions — Web visitor tracking for Browser, OS, etc. filters
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  browser text,
  operating_system text,
  referrer text,
  search_engine text,
  portal_name text,
  first_page text,
  page_count integer DEFAULT 1,
  visitor_score integer DEFAULT 0,
  ip_address inet,
  user_agent text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visitor_sessions_org ON crm_visitor_sessions(org_id);
CREATE INDEX idx_visitor_sessions_record ON crm_visitor_sessions(record_id);
CREATE INDEX idx_visitor_sessions_started ON crm_visitor_sessions(started_at DESC);
CREATE INDEX idx_visitor_sessions_browser ON crm_visitor_sessions(browser) WHERE browser IS NOT NULL;
CREATE INDEX idx_visitor_sessions_os ON crm_visitor_sessions(operating_system) WHERE operating_system IS NOT NULL;

ALTER TABLE crm_visitor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitor_sessions_org_access" ON crm_visitor_sessions
  FOR ALL USING (
    org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

-- =============================================================================
-- 2. Extend filter_records_by_system_preset with p_value parameter
--    Drop old 3-param signature, recreate with 4 params (p_value defaults NULL).
-- =============================================================================

DROP FUNCTION IF EXISTS public.filter_records_by_system_preset(uuid, text, uuid);

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
AS $$
BEGIN
  CASE p_preset

    -- ===== EXISTING TOGGLE FILTERS =====

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

    WHEN 'unassigned' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.owner_id IS NULL;

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

    -- ===== NEW TOGGLE FILTERS (no p_value needed) =====

    WHEN 'locked' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.system->>'locked' = 'true';

    WHEN 'website_activity' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (SELECT 1 FROM crm_visitor_sessions vs WHERE vs.record_id = r.id);

    WHEN 'chats' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM inbox_conversations ic
            WHERE ic.channel = 'chat'
              AND (ic.contact_id = r.id OR ic.linked_lead_id = r.id
                   OR ic.linked_deal_id = r.id OR ic.linked_account_id = r.id)
          );

    WHEN 'campaigns' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM email_campaign_recipients ecr WHERE ecr.record_id = r.id
          );

    WHEN 'cadences' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_record_links rl
            JOIN crm_records tr ON tr.id = rl.target_record_id
            JOIN crm_modules tm ON tm.id = tr.module_id
            WHERE rl.source_record_id = r.id AND tm.key = 'cadences'
          );

    -- ===== NEW VALUE-BASED FILTERS (use p_value) =====

    WHEN 'record_action' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_audit_log al
            WHERE al.entity_id = r.id::text
              AND (p_value IS NULL OR al.action = p_value)
          );

    WHEN 'related_records_action' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_record_links rl
            JOIN crm_audit_log al ON al.entity_id = rl.target_record_id::text
            WHERE rl.source_record_id = r.id
              AND (p_value IS NULL OR al.action = p_value)
          );

    WHEN 'scoring_rules' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND COALESCE((r.data->>'lead_score')::numeric, 0) >= COALESCE(p_value::numeric, 0);

    WHEN 'latest_email_status' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_messages msg
            WHERE msg.record_id = r.id
              AND msg.status = p_value
              AND msg.sent_at = (
                SELECT MAX(m2.sent_at) FROM crm_messages m2 WHERE m2.record_id = r.id
              )
          );

    WHEN 'attended_by' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_tasks t
            WHERE t.record_id = r.id
              AND t.activity_type = 'meeting'
              AND t.attendees IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM unnest(t.attendees) a WHERE a ILIKE '%' || COALESCE(p_value, '') || '%'
              )
          );

    WHEN 'browser' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_visitor_sessions vs
            WHERE vs.record_id = r.id AND vs.browser ILIKE '%' || COALESCE(p_value, '') || '%'
          );

    WHEN 'operating_system' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_visitor_sessions vs
            WHERE vs.record_id = r.id AND vs.operating_system ILIKE '%' || COALESCE(p_value, '') || '%'
          );

    WHEN 'portal_name' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_visitor_sessions vs
            WHERE vs.record_id = r.id AND vs.portal_name ILIKE '%' || COALESCE(p_value, '') || '%'
          );

    WHEN 'search_engine' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_visitor_sessions vs
            WHERE vs.record_id = r.id AND vs.search_engine ILIKE '%' || COALESCE(p_value, '') || '%'
          );

    WHEN 'time_spent_minutes' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_visitor_sessions vs
            WHERE vs.record_id = r.id
              AND vs.duration_seconds >= (COALESCE(p_value::numeric, 0) * 60)
          );

    WHEN 'time_visited' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (SELECT COUNT(*) FROM crm_visitor_sessions vs WHERE vs.record_id = r.id)
              >= COALESCE(p_value::integer, 1);

    WHEN 'avg_time_spent_minutes' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (SELECT COALESCE(AVG(vs.duration_seconds), 0) FROM crm_visitor_sessions vs WHERE vs.record_id = r.id)
              >= (COALESCE(p_value::numeric, 0) * 60);

    WHEN 'days_visited' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (SELECT COUNT(DISTINCT vs.started_at::date) FROM crm_visitor_sessions vs WHERE vs.record_id = r.id)
              >= COALESCE(p_value::integer, 1);

    WHEN 'first_page_visited' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_visitor_sessions vs
            WHERE vs.record_id = r.id AND vs.first_page ILIKE '%' || COALESCE(p_value, '') || '%'
          );

    WHEN 'first_visit' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (SELECT MIN(vs.started_at) FROM crm_visitor_sessions vs WHERE vs.record_id = r.id)
              >= p_value::timestamptz;

    WHEN 'most_recent_visit' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (SELECT MAX(vs.started_at) FROM crm_visitor_sessions vs WHERE vs.record_id = r.id)
              >= p_value::timestamptz;

    WHEN 'number_of_chats' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (
            SELECT COUNT(*) FROM inbox_conversations ic
            WHERE ic.channel = 'chat'
              AND (ic.contact_id = r.id OR ic.linked_lead_id = r.id
                   OR ic.linked_deal_id = r.id OR ic.linked_account_id = r.id)
          ) >= COALESCE(p_value::integer, 1);

    WHEN 'referrer' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_visitor_sessions vs
            WHERE vs.record_id = r.id AND vs.referrer ILIKE '%' || COALESCE(p_value, '') || '%'
          );

    WHEN 'visitor_score' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_visitor_sessions vs
            WHERE vs.record_id = r.id AND vs.visitor_score >= COALESCE(p_value::integer, 0)
          );

    ELSE
      RETURN;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.filter_records_by_system_preset(uuid, text, uuid, text) TO authenticated;

-- =============================================================================
-- 3. Extend filter_records_by_related with new related types
-- =============================================================================

CREATE OR REPLACE FUNCTION public.filter_records_by_related(
  p_module_id uuid,
  p_related_type text,
  p_condition text,
  p_activity_type text DEFAULT NULL
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  CASE p_related_type

    -- Activities (crm_tasks, optionally filtered by activity_type)
    WHEN 'activities', 'appointments', 'calls', 'emails', 'tasks' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (
              SELECT 1 FROM crm_tasks t
              WHERE t.record_id = r.id
                AND (p_activity_type IS NULL OR t.activity_type = p_activity_type)
            );
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (
              SELECT 1 FROM crm_tasks t
              WHERE t.record_id = r.id
                AND (p_activity_type IS NULL OR t.activity_type = p_activity_type)
            );
      END IF;

    -- Notes
    WHEN 'notes' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);
      END IF;

    -- Linked records via crm_record_links (leads, products, invoices, etc.)
    WHEN 'linked_records' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (
              SELECT 1 FROM crm_record_links rl
              JOIN crm_records tr ON tr.id = rl.target_record_id
              JOIN crm_modules tm ON tm.id = tr.module_id
              WHERE rl.source_record_id = r.id
                AND (p_activity_type IS NULL OR tm.key = p_activity_type)
            );
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (
              SELECT 1 FROM crm_record_links rl
              JOIN crm_records tr ON tr.id = rl.target_record_id
              JOIN crm_modules tm ON tm.id = tr.module_id
              WHERE rl.source_record_id = r.id
                AND (p_activity_type IS NULL OR tm.key = p_activity_type)
            );
      END IF;

    -- Linked by link_type (e.g. prospect_role)
    WHEN 'linked_by_type' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (
              SELECT 1 FROM crm_record_links rl
              WHERE rl.source_record_id = r.id
                AND rl.link_type = p_activity_type
            );
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (
              SELECT 1 FROM crm_record_links rl
              WHERE rl.source_record_id = r.id
                AND rl.link_type = p_activity_type
            );
      END IF;

    -- Meeting invitees (tasks with activity_type='meeting' that have attendees)
    WHEN 'meeting_invitees' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (
              SELECT 1 FROM crm_tasks t
              WHERE t.record_id = r.id
                AND t.activity_type = 'meeting'
                AND t.attendees IS NOT NULL
                AND array_length(t.attendees, 1) > 0
            );
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (
              SELECT 1 FROM crm_tasks t
              WHERE t.record_id = r.id
                AND t.activity_type = 'meeting'
                AND t.attendees IS NOT NULL
                AND array_length(t.attendees, 1) > 0
            );
      END IF;

    ELSE
      RETURN;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.filter_records_by_related(uuid, text, text, text) TO authenticated;
