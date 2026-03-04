-- ============================================================================
-- MODULE 8: Experience Center — Analytics & Signals
-- Creates behavioral signal system and dynamic segmentation engine
-- Complements existing: crm_scoring_rules, advisor_rankings,
--   advisor_achievements, system_events, change_events
-- ============================================================================

-- ============================================================================
-- 1. CRM SIGNALS — Behavioral signal definitions
-- Define signals that fire based on record conditions (e.g., lead_engaged,
-- payment_late, high_value_member, advisor_active)
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_signals (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id       uuid         REFERENCES crm_modules(id) ON DELETE SET NULL,
  -- Signal identity
  name            text         NOT NULL,
  key             text         NOT NULL,
  description     text,
  -- Signal category and severity
  category        text         NOT NULL DEFAULT 'engagement' CHECK (category IN (
                    'engagement', 'risk', 'opportunity', 'compliance',
                    'lifecycle', 'health', 'activity', 'custom'
                  )),
  severity        text         NOT NULL DEFAULT 'info' CHECK (severity IN (
                    'info', 'low', 'medium', 'high', 'critical'
                  )),
  -- Visual
  icon            text         DEFAULT 'zap',
  color           text         DEFAULT '#6366f1',
  -- Trigger conditions (when to fire)
  trigger_type    text         NOT NULL DEFAULT 'condition' CHECK (trigger_type IN (
                    'condition',    -- Fire when record matches conditions
                    'threshold',    -- Fire when a metric crosses a threshold
                    'inactivity',   -- Fire after period of inactivity
                    'scheduled',    -- Fire on schedule (cron)
                    'manual'        -- Manually triggered
                  )),
  conditions      jsonb        NOT NULL DEFAULT '[]',  -- ConditionGroup[] from automation
  -- Threshold config (for threshold type)
  threshold_field text,        -- Field to monitor
  threshold_op    text         CHECK (threshold_op IS NULL OR threshold_op IN (
                    'gt', 'gte', 'lt', 'lte', 'eq', 'between'
                  )),
  threshold_value jsonb,       -- Numeric value or {min, max} for between
  -- Inactivity config
  inactivity_days int,         -- Days of no activity before firing
  inactivity_field text,       -- Field to check for last activity (default: updated_at)
  -- Schedule config
  cron_expression text,
  -- Auto-resolution
  auto_resolve    boolean      NOT NULL DEFAULT false,  -- Auto-clear when conditions no longer match
  resolve_after_days int,      -- Auto-resolve after N days
  -- Actions on fire
  on_fire_actions jsonb        DEFAULT '[]',  -- [{type: "notify", config: {...}}, {type: "create_task", config: {...}}]
  on_resolve_actions jsonb     DEFAULT '[]',  -- Actions when signal resolves
  -- State
  is_enabled      boolean      NOT NULL DEFAULT true,
  is_system       boolean      NOT NULL DEFAULT false,  -- System signals can't be deleted
  fire_count      bigint       NOT NULL DEFAULT 0,
  last_evaluated_at timestamptz,
  -- Metadata
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_signal_org_key
    UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_crm_signals_org
  ON crm_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_signals_org_module
  ON crm_signals(organization_id, module_id) WHERE module_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_signals_category
  ON crm_signals(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_crm_signals_enabled
  ON crm_signals(organization_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_crm_signals_trigger
  ON crm_signals(trigger_type) WHERE is_enabled = true;

COMMENT ON TABLE crm_signals IS 'Behavioral signal definitions — fire based on record conditions, thresholds, or inactivity';
COMMENT ON COLUMN crm_signals.category IS 'Signal category: engagement, risk, opportunity, compliance, lifecycle, health, activity, custom';
COMMENT ON COLUMN crm_signals.trigger_type IS 'How the signal fires: condition match, threshold cross, inactivity period, schedule, or manual';
COMMENT ON COLUMN crm_signals.on_fire_actions IS 'Actions to execute when signal fires: [{type, config}]';

-- ============================================================================
-- 2. CRM SIGNAL EVENTS — Signal firing history
-- Tracks when signals fire and resolve for specific records
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_signal_events (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_id       uuid         NOT NULL REFERENCES crm_signals(id) ON DELETE CASCADE,
  record_id       uuid         REFERENCES crm_records(id) ON DELETE CASCADE,
  -- Event details
  status          text         NOT NULL DEFAULT 'active' CHECK (status IN (
                    'active', 'resolved', 'dismissed', 'expired'
                  )),
  severity        text         NOT NULL DEFAULT 'info',
  -- Context
  trigger_data    jsonb        DEFAULT '{}',  -- Snapshot of data that triggered the signal
  message         text,        -- Human-readable signal message
  -- Resolution
  resolved_at     timestamptz,
  resolved_by     uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_note text,
  -- Timestamps
  fired_at        timestamptz  NOT NULL DEFAULT now(),
  expires_at      timestamptz,  -- Auto-expire after this time
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_signal_events_org
  ON crm_signal_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_signal_events_signal
  ON crm_signal_events(signal_id);
CREATE INDEX IF NOT EXISTS idx_crm_signal_events_record
  ON crm_signal_events(record_id) WHERE record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_signal_events_active
  ON crm_signal_events(organization_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_crm_signal_events_org_date
  ON crm_signal_events(organization_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_signal_events_record_active
  ON crm_signal_events(record_id, status)
  WHERE status = 'active' AND record_id IS NOT NULL;

COMMENT ON TABLE crm_signal_events IS 'Signal firing history — tracks active, resolved, and dismissed signal events per record';

-- ============================================================================
-- 3. CRM SEGMENTATIONS — Dynamic segment definitions
-- Groups contacts/records based on filter criteria, signals, and scoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_segmentations (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id       uuid         REFERENCES crm_modules(id) ON DELETE SET NULL,
  -- Segment identity
  name            text         NOT NULL,
  key             text         NOT NULL,
  description     text,
  -- Segment type
  segment_type    text         NOT NULL DEFAULT 'dynamic' CHECK (segment_type IN (
                    'dynamic',    -- Auto-computed from criteria
                    'static',     -- Manually managed member list
                    'smart'       -- Dynamic with cached membership
                  )),
  -- Visual
  icon            text         DEFAULT 'users',
  color           text         DEFAULT '#6366f1',
  -- Filter criteria (for dynamic/smart)
  criteria        jsonb        NOT NULL DEFAULT '{}',  -- ConditionGroup from automation
  -- Signal-based criteria
  required_signals text[]      DEFAULT '{}',  -- Signal keys that members must have active
  excluded_signals text[]      DEFAULT '{}',  -- Signal keys that members must NOT have
  -- Score-based criteria
  min_score       int,         -- Minimum score to be in segment
  max_score       int,         -- Maximum score to be in segment
  score_field     text         DEFAULT 'score',  -- Field key for score
  -- Membership tracking
  member_count    int          NOT NULL DEFAULT 0,
  last_computed_at timestamptz,
  compute_interval_hours int   DEFAULT 24,  -- How often to recompute (0 = real-time)
  -- State
  is_active       boolean      NOT NULL DEFAULT true,
  is_system       boolean      NOT NULL DEFAULT false,
  -- Metadata
  tags            text[]       DEFAULT '{}',
  config          jsonb        DEFAULT '{}',  -- Additional config
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_segment_org_key
    UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_crm_segmentations_org
  ON crm_segmentations(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_segmentations_module
  ON crm_segmentations(organization_id, module_id) WHERE module_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_segmentations_type
  ON crm_segmentations(organization_id, segment_type);
CREATE INDEX IF NOT EXISTS idx_crm_segmentations_active
  ON crm_segmentations(organization_id, is_active) WHERE is_active = true;

COMMENT ON TABLE crm_segmentations IS 'Dynamic and static segments for grouping contacts/records by criteria, signals, and scores';
COMMENT ON COLUMN crm_segmentations.criteria IS 'Filter conditions using automation ConditionGroup format';
COMMENT ON COLUMN crm_segmentations.required_signals IS 'Signal keys that must be active on a record for segment membership';

-- ============================================================================
-- 4. CRM SEGMENT MEMBERS — Static/cached segment membership
-- For static segments and smart segments with cached membership
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_segment_members (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id      uuid         NOT NULL REFERENCES crm_segmentations(id) ON DELETE CASCADE,
  record_id       uuid         NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_by        text         NOT NULL DEFAULT 'system' CHECK (added_by IN ('system', 'manual', 'import')),
  added_at        timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_segment_member
    UNIQUE (segment_id, record_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_segment_members_segment
  ON crm_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_crm_segment_members_record
  ON crm_segment_members(record_id);
CREATE INDEX IF NOT EXISTS idx_crm_segment_members_org
  ON crm_segment_members(organization_id);

COMMENT ON TABLE crm_segment_members IS 'Membership list for static and smart (cached) segments';

-- ============================================================================
-- 5. FIRE SIGNAL FUNCTION
-- Creates a signal event and increments fire count
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_fire_signal(
  p_signal_id uuid,
  p_record_id uuid,
  p_trigger_data jsonb DEFAULT '{}',
  p_message text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_signal RECORD;
  v_event_id uuid;
  v_existing uuid;
BEGIN
  -- Get signal config
  SELECT * INTO v_signal FROM crm_signals WHERE id = p_signal_id AND is_enabled = true;
  IF v_signal IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if signal is already active for this record (avoid duplicates)
  SELECT id INTO v_existing
  FROM crm_signal_events
  WHERE signal_id = p_signal_id
    AND record_id = p_record_id
    AND status = 'active';

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;  -- Signal already active
  END IF;

  -- Create the event
  INSERT INTO crm_signal_events (
    organization_id, signal_id, record_id, status, severity,
    trigger_data, message, expires_at
  ) VALUES (
    v_signal.organization_id, p_signal_id, p_record_id, 'active', v_signal.severity,
    p_trigger_data, p_message,
    CASE WHEN v_signal.resolve_after_days IS NOT NULL
      THEN now() + (v_signal.resolve_after_days || ' days')::interval
      ELSE NULL
    END
  )
  RETURNING id INTO v_event_id;

  -- Increment fire count
  UPDATE crm_signals
  SET fire_count = fire_count + 1,
      last_evaluated_at = now()
  WHERE id = p_signal_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_fire_signal IS
  'Creates a signal event for a record, incrementing fire count. Prevents duplicate active signals.';

-- ============================================================================
-- 6. RESOLVE SIGNAL FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_resolve_signal(
  p_signal_id uuid,
  p_record_id uuid,
  p_resolved_by uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE crm_signal_events
  SET status = 'resolved',
      resolved_at = now(),
      resolved_by = p_resolved_by,
      resolution_note = p_note
  WHERE signal_id = p_signal_id
    AND record_id = p_record_id
    AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_resolve_signal IS
  'Resolves all active signal events for a given signal + record combination';

-- ============================================================================
-- 7. GET RECORD SIGNALS — active signals for a record
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_get_record_signals(p_record_id uuid)
RETURNS TABLE(
  event_id uuid,
  signal_id uuid,
  signal_name text,
  signal_key text,
  category text,
  severity text,
  icon text,
  color text,
  message text,
  fired_at timestamptz,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    s.id,
    s.name,
    s.key,
    s.category,
    e.severity,
    s.icon,
    s.color,
    e.message,
    e.fired_at,
    e.status
  FROM crm_signal_events e
  JOIN crm_signals s ON s.id = e.signal_id
  WHERE e.record_id = p_record_id
    AND e.status = 'active'
  ORDER BY e.fired_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_get_record_signals IS
  'Returns all active signal events for a record with signal metadata';

-- ============================================================================
-- 8. COMPUTE SEGMENT MEMBERSHIP
-- Recomputes membership for a smart/dynamic segment
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_compute_segment_membership(p_segment_id uuid)
RETURNS int AS $$
DECLARE
  v_segment RECORD;
  v_count int := 0;
BEGIN
  SELECT * INTO v_segment FROM crm_segmentations WHERE id = p_segment_id;
  IF v_segment IS NULL OR v_segment.segment_type = 'static' THEN
    RETURN 0;
  END IF;

  -- For smart segments, refresh the membership cache
  IF v_segment.segment_type = 'smart' THEN
    -- Clear existing computed members
    DELETE FROM crm_segment_members
    WHERE segment_id = p_segment_id AND added_by = 'system';

    -- Insert matching records (basic criteria evaluation)
    -- This handles signal-based membership
    IF v_segment.required_signals IS NOT NULL AND array_length(v_segment.required_signals, 1) > 0 THEN
      INSERT INTO crm_segment_members (segment_id, record_id, organization_id, added_by)
      SELECT DISTINCT p_segment_id, r.id, r.org_id, 'system'
      FROM crm_records r
      WHERE r.org_id = v_segment.organization_id
        AND (v_segment.module_id IS NULL OR r.module_id = v_segment.module_id)
        -- Check all required signals are active
        AND NOT EXISTS (
          SELECT 1 FROM unnest(v_segment.required_signals) AS req_sig(key)
          WHERE NOT EXISTS (
            SELECT 1 FROM crm_signal_events se
            JOIN crm_signals s ON s.id = se.signal_id
            WHERE se.record_id = r.id
              AND se.status = 'active'
              AND s.key = req_sig.key
          )
        )
        -- Check excluded signals are not active
        AND NOT EXISTS (
          SELECT 1 FROM crm_signal_events se
          JOIN crm_signals s ON s.id = se.signal_id
          WHERE se.record_id = r.id
            AND se.status = 'active'
            AND s.key = ANY(v_segment.excluded_signals)
        )
        -- Score filter
        AND (
          v_segment.min_score IS NULL
          OR COALESCE((r.data ->> COALESCE(v_segment.score_field, 'score'))::int, 0) >= v_segment.min_score
        )
        AND (
          v_segment.max_score IS NULL
          OR COALESCE((r.data ->> COALESCE(v_segment.score_field, 'score'))::int, 0) <= v_segment.max_score
        )
      ON CONFLICT (segment_id, record_id) DO NOTHING;
    END IF;
  END IF;

  -- Update member count
  SELECT count(*) INTO v_count
  FROM crm_segment_members WHERE segment_id = p_segment_id;

  UPDATE crm_segmentations
  SET member_count = v_count,
      last_computed_at = now()
  WHERE id = p_segment_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_compute_segment_membership IS
  'Recomputes cached membership for smart segments based on signals, scores, and criteria';

-- ============================================================================
-- 9. SEED EXAMPLE SIGNALS
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_signals(p_org_id uuid)
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM crm_signals WHERE organization_id = p_org_id) THEN
    RETURN;
  END IF;

  INSERT INTO crm_signals (organization_id, name, key, description, category, severity, icon, color, trigger_type, is_system) VALUES
    (p_org_id, 'Advisor Active',      'advisor_active',      'Advisor has activity in the last 30 days',           'activity',    'info',     'user-check',  '#22c55e', 'condition',  true),
    (p_org_id, 'Lead Engaged',        'lead_engaged',        'Lead has opened emails or visited pages recently',   'engagement',  'low',      'sparkles',    '#3b82f6', 'condition',  true),
    (p_org_id, 'Payment Late',        'payment_late',        'Member has a payment overdue by 15+ days',           'risk',        'high',     'alert-circle','#ef4444', 'threshold',  true),
    (p_org_id, 'High Value Member',   'high_value_member',   'Member with premium plan or high lifetime value',    'opportunity', 'medium',   'crown',       '#f59e0b', 'condition',  true),
    (p_org_id, 'At Risk of Churn',    'churn_risk',          'Member showing disengagement signals',               'risk',        'high',     'trending-down','#dc2626','inactivity', true),
    (p_org_id, 'Compliance Due',      'compliance_due',      'Required compliance documents nearing deadline',     'compliance',  'critical', 'shield-alert','#7c3aed', 'scheduled',  true),
    (p_org_id, 'New Lead Assigned',   'new_lead_assigned',   'Fresh lead assigned — follow up within 24 hours',    'lifecycle',   'medium',   'user-plus',   '#0ea5e9', 'condition',  true),
    (p_org_id, 'Enrollment Stalled',  'enrollment_stalled',  'Enrollment in pipeline for 7+ days without progress','risk',        'medium',   'pause-circle','#f97316', 'inactivity', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION seed_default_signals(uuid) TO authenticated;

COMMENT ON FUNCTION seed_default_signals IS
  'Seeds 8 default behavioral signals for a new organization';

-- ============================================================================
-- 10. AUTO-EXPIRE SIGNAL EVENTS
-- Cleanup function for expired signal events
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_expire_old_signal_events()
RETURNS int AS $$
DECLARE
  v_expired int;
BEGIN
  UPDATE crm_signal_events
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_expired = ROW_COUNT;
  RETURN v_expired;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_expire_old_signal_events IS
  'Marks active signal events as expired when past their expiry date';

-- ============================================================================
-- 11. AUDIT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_experience_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm',
    COALESCE(
      (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
      NULL
    ),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'experience',
    CASE
      WHEN TG_TABLE_NAME = 'crm_signals' AND TG_OP = 'DELETE' THEN 'high'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'entity_name', CASE
        WHEN TG_TABLE_NAME = 'crm_signals' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_segmentations' THEN COALESCE(NEW.name, OLD.name)
        ELSE NULL
      END
    ),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', to_jsonb(NEW))
      WHEN 'UPDATE' THEN jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      WHEN 'DELETE' THEN jsonb_build_object('old', to_jsonb(OLD))
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_crm_signals
  AFTER INSERT OR UPDATE OR DELETE ON crm_signals
  FOR EACH ROW EXECUTE FUNCTION fn_audit_experience_changes();

CREATE TRIGGER trg_audit_crm_segmentations
  AFTER INSERT OR UPDATE OR DELETE ON crm_segmentations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_experience_changes();

-- ============================================================================
-- 12. UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_signals_updated_at
  BEFORE UPDATE ON crm_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_segmentations_updated_at
  BEFORE UPDATE ON crm_segmentations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13. ROW LEVEL SECURITY
-- ============================================================================

-- ── crm_signals ──────────────────────────────────────────────────────
ALTER TABLE crm_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signals_select" ON crm_signals;
CREATE POLICY "signals_select" ON crm_signals
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "signals_admin_insert" ON crm_signals;
CREATE POLICY "signals_admin_insert" ON crm_signals
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "signals_admin_update" ON crm_signals;
CREATE POLICY "signals_admin_update" ON crm_signals
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "signals_admin_delete" ON crm_signals;
CREATE POLICY "signals_admin_delete" ON crm_signals
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']) AND NOT is_system);

DROP POLICY IF EXISTS "signals_service" ON crm_signals;
CREATE POLICY "signals_service" ON crm_signals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_signal_events ────────────────────────────────────────────────
ALTER TABLE crm_signal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signal_events_select" ON crm_signal_events;
CREATE POLICY "signal_events_select" ON crm_signal_events
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "signal_events_insert" ON crm_signal_events;
CREATE POLICY "signal_events_insert" ON crm_signal_events
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "signal_events_update" ON crm_signal_events;
CREATE POLICY "signal_events_update" ON crm_signal_events
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "signal_events_service" ON crm_signal_events;
CREATE POLICY "signal_events_service" ON crm_signal_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_segmentations ───────────────────────────────────────────────
ALTER TABLE crm_segmentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segments_select" ON crm_segmentations;
CREATE POLICY "segments_select" ON crm_segmentations
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "segments_admin_insert" ON crm_segmentations;
CREATE POLICY "segments_admin_insert" ON crm_segmentations
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "segments_admin_update" ON crm_segmentations;
CREATE POLICY "segments_admin_update" ON crm_segmentations
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "segments_admin_delete" ON crm_segmentations;
CREATE POLICY "segments_admin_delete" ON crm_segmentations
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']) AND NOT is_system);

DROP POLICY IF EXISTS "segments_service" ON crm_segmentations;
CREATE POLICY "segments_service" ON crm_segmentations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_segment_members ─────────────────────────────────────────────
ALTER TABLE crm_segment_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segment_members_select" ON crm_segment_members;
CREATE POLICY "segment_members_select" ON crm_segment_members
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "segment_members_manage" ON crm_segment_members;
CREATE POLICY "segment_members_manage" ON crm_segment_members
  FOR ALL TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "segment_members_service" ON crm_segment_members;
CREATE POLICY "segment_members_service" ON crm_segment_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE 8
-- ============================================================================
