-- ============================================================================
-- MODULE: Member Lifecycle Tracking
-- Tracks enrolled / cancelled / returned / paused events with reasons
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table — member_lifecycle_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_lifecycle_events (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id       uuid         NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  event_type       text         NOT NULL
    CHECK (event_type IN ('enrolled', 'cancelled', 'returned', 'paused')),
  event_date       date         NOT NULL DEFAULT CURRENT_DATE,
  reason           text
    CHECK (reason IS NULL OR reason IN (
      'cost', 'coverage_change', 'moved_state', 'joined_medicaid',
      'joined_employer_plan', 'dissatisfied', 'non_payment', 'aging_out',
      'life_event', 'better_option', 'voluntary', 'involuntary', 'other'
    )),
  reason_detail    text,
  plan_type        text
    CHECK (plan_type IS NULL OR plan_type IN ('healthshare', 'insurance', 'medicaid', 'short_term')),
  advisor_id       uuid         REFERENCES advisors(id) ON DELETE SET NULL,
  source           text         DEFAULT 'manual',
  metadata         jsonb        NOT NULL DEFAULT '{}',
  created_by       uuid         REFERENCES profiles(id),
  created_at       timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  member_lifecycle_events IS 'Chronological lifecycle events for member churn and retention tracking';
COMMENT ON COLUMN member_lifecycle_events.event_type IS 'enrolled | cancelled | returned | paused';
COMMENT ON COLUMN member_lifecycle_events.reason IS 'Standardized reason code for the event';
COMMENT ON COLUMN member_lifecycle_events.reason_detail IS 'Free-text notes about the reason';

-- ----------------------------------------------------------------------------
-- 2. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lifecycle_org
  ON member_lifecycle_events (organization_id);

CREATE INDEX IF NOT EXISTS idx_lifecycle_contact
  ON member_lifecycle_events (contact_id);

CREATE INDEX IF NOT EXISTS idx_lifecycle_type
  ON member_lifecycle_events (organization_id, event_type);

CREATE INDEX IF NOT EXISTS idx_lifecycle_date
  ON member_lifecycle_events (organization_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_advisor
  ON member_lifecycle_events (advisor_id) WHERE advisor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lifecycle_reason
  ON member_lifecycle_events (organization_id, reason) WHERE reason IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Audit trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_lifecycle_events()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm',
    COALESCE(NEW.created_by, OLD.created_by),
    CASE TG_OP
      WHEN 'INSERT' THEN 'lifecycle_event_created'
      WHEN 'DELETE' THEN 'lifecycle_event_deleted'
    END,
    'member_lifecycle',
    'medium',
    jsonb_build_object(
      'contact_id', COALESCE(NEW.contact_id, OLD.contact_id),
      'event_type', COALESCE(NEW.event_type, OLD.event_type),
      'reason', COALESCE(NEW.reason, OLD.reason)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_lifecycle_events
  AFTER INSERT OR DELETE ON member_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION fn_audit_lifecycle_events();

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE member_lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lifecycle_select_member" ON member_lifecycle_events;
CREATE POLICY "lifecycle_select_member" ON member_lifecycle_events
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "lifecycle_insert_agent" ON member_lifecycle_events;
CREATE POLICY "lifecycle_insert_agent" ON member_lifecycle_events
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "lifecycle_delete_admin" ON member_lifecycle_events;
CREATE POLICY "lifecycle_delete_admin" ON member_lifecycle_events
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "lifecycle_service" ON member_lifecycle_events;
CREATE POLICY "lifecycle_service" ON member_lifecycle_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. Summary view — member_history_summary
-- Per-contact lifecycle overview for churn/retention analysis
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW member_history_summary AS
SELECT
  e.contact_id,
  e.organization_id,
  r.title                                           AS contact_name,
  r.email                                           AS contact_email,
  COUNT(e.id)                                        AS total_events,
  COUNT(e.id) FILTER (WHERE e.event_type = 'enrolled')  AS enroll_count,
  COUNT(e.id) FILTER (WHERE e.event_type = 'cancelled') AS cancel_count,
  COUNT(e.id) FILTER (WHERE e.event_type = 'returned')  AS return_count,
  COUNT(e.id) FILTER (WHERE e.event_type = 'paused')    AS pause_count,
  MIN(e.event_date) FILTER (WHERE e.event_type = 'enrolled')  AS first_enrolled,
  MAX(e.event_date)                                  AS last_event_date,
  -- Current status: latest event type
  (SELECT le.event_type
   FROM member_lifecycle_events le
   WHERE le.contact_id = e.contact_id
   ORDER BY le.event_date DESC, le.created_at DESC
   LIMIT 1)                                          AS current_status,
  -- Most common cancel reason
  (SELECT le.reason
   FROM member_lifecycle_events le
   WHERE le.contact_id = e.contact_id AND le.event_type = 'cancelled'
   GROUP BY le.reason ORDER BY COUNT(*) DESC LIMIT 1) AS top_cancel_reason
FROM member_lifecycle_events e
JOIN crm_records r ON r.id = e.contact_id
GROUP BY e.contact_id, e.organization_id, r.title, r.email;

COMMENT ON VIEW member_history_summary IS 'Per-contact lifecycle summary for churn and retention dashboards';

-- ----------------------------------------------------------------------------
-- 6. Org-level lifecycle stats view
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW lifecycle_org_stats AS
SELECT
  e.organization_id,
  COUNT(DISTINCT e.contact_id)                                          AS total_tracked_members,
  COUNT(DISTINCT e.contact_id) FILTER (
    WHERE e.event_type = 'enrolled'
      AND e.event_date >= date_trunc('month', now())
  )                                                                      AS enrolled_this_month,
  COUNT(DISTINCT e.contact_id) FILTER (
    WHERE e.event_type = 'cancelled'
      AND e.event_date >= date_trunc('month', now())
  )                                                                      AS cancelled_this_month,
  COUNT(DISTINCT e.contact_id) FILTER (
    WHERE e.event_type = 'returned'
  )                                                                      AS total_returned,
  -- Churn rate: cancelled / enrolled in last 12 months
  CASE
    WHEN COUNT(e.id) FILTER (
      WHERE e.event_type = 'enrolled'
        AND e.event_date >= (now() - interval '12 months')
    ) > 0
    THEN ROUND(
      COUNT(e.id) FILTER (
        WHERE e.event_type = 'cancelled'
          AND e.event_date >= (now() - interval '12 months')
      )::numeric /
      COUNT(e.id) FILTER (
        WHERE e.event_type = 'enrolled'
          AND e.event_date >= (now() - interval '12 months')
      ) * 100, 1
    )
    ELSE 0
  END                                                                    AS churn_rate_12m,
  -- Top cancel reason across org
  (SELECT le.reason
   FROM member_lifecycle_events le
   WHERE le.organization_id = e.organization_id AND le.event_type = 'cancelled'
   GROUP BY le.reason ORDER BY COUNT(*) DESC LIMIT 1)                    AS top_cancel_reason
FROM member_lifecycle_events e
GROUP BY e.organization_id;

COMMENT ON VIEW lifecycle_org_stats IS 'Org-wide lifecycle KPIs: enrollments, cancellations, churn rate';

-- ============================================================================
-- END MODULE: Member Lifecycle Tracking
-- ============================================================================
