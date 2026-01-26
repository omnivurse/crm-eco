-- ============================================================================
-- CHANGE INTELLIGENCE SYSTEM
-- Centralized change detection, scoring, and reconciliation
-- ============================================================================

-- Change Events Table
-- Captures all changes from any source with intelligence metadata
CREATE TABLE IF NOT EXISTS change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Source identification
  source_type text NOT NULL CHECK (source_type IN ('user', 'system', 'integration', 'vendor', 'import')),
  source_name text,                    -- Human-readable source name (e.g., 'Stripe', 'Bulk Import')
  source_id text,                      -- External ID from source system

  -- Change classification
  change_type text NOT NULL,           -- 'create', 'update', 'delete', 'status_change', 'enrollment', etc.
  entity_type text NOT NULL,           -- 'record', 'enrollment', 'member', 'deal', 'task', etc.
  entity_id uuid NOT NULL,
  entity_title text,                   -- Cached display title for quick reference

  -- Severity and priority
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  requires_review boolean DEFAULT false,

  -- Change details
  title text NOT NULL,                 -- Human-readable summary
  description text,                    -- Detailed description
  diff jsonb,                          -- Before/after state
  payload jsonb DEFAULT '{}',          -- Additional context data

  -- Actor information
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name text,                     -- Cached for display
  actor_type text DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'integration', 'vendor')),

  -- Reconciliation tracking
  reconciliation_status text DEFAULT 'none' CHECK (reconciliation_status IN (
    'none',           -- No action needed
    'pending',        -- Awaiting review
    'approved',       -- Reviewed and approved
    'rejected',       -- Reviewed and rejected
    'auto_resolved'   -- System auto-resolved
  )),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,

  -- Hash for deduplication
  content_hash text,
  previous_hash text,

  -- Sync status (for cross-system reconciliation)
  sync_status text DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'stale')),
  synced_at timestamptz,

  -- Timestamps
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE change_events IS 'Centralized change intelligence tracking for all system changes';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary query patterns
CREATE INDEX idx_change_events_org_created ON change_events(org_id, created_at DESC);
CREATE INDEX idx_change_events_entity ON change_events(entity_type, entity_id);

-- Severity-based filtering (partial index for critical/high only)
CREATE INDEX idx_change_events_severity ON change_events(org_id, severity)
  WHERE severity IN ('critical', 'high');

-- Pending review queue
CREATE INDEX idx_change_events_pending_review ON change_events(org_id, reconciliation_status)
  WHERE requires_review = true AND reconciliation_status IN ('none', 'pending');

-- Source tracking
CREATE INDEX idx_change_events_source ON change_events(source_type, source_name);

-- Hash lookup for deduplication
CREATE INDEX idx_change_events_hash ON change_events(content_hash) WHERE content_hash IS NOT NULL;

-- Sync status monitoring
CREATE INDEX idx_change_events_sync ON change_events(org_id, sync_status)
  WHERE sync_status != 'synced';

-- Actor activity
CREATE INDEX idx_change_events_actor ON change_events(actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE change_events ENABLE ROW LEVEL SECURITY;

-- Read access for org members (CRM users)
CREATE POLICY "change_events_crm_read"
ON change_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM crm_user_orgs cuo
    WHERE cuo.org_id = change_events.org_id
    AND cuo.user_id = auth.uid()
  )
);

-- Read access for admin users
CREATE POLICY "change_events_admin_read"
ON change_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = change_events.org_id
    AND p.role IN ('owner', 'admin', 'manager')
  )
);

-- Insert for authenticated users with proper roles
CREATE POLICY "change_events_insert"
ON change_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_user_orgs cuo
    WHERE cuo.org_id = change_events.org_id
    AND cuo.user_id = auth.uid()
    AND cuo.role IN ('crm_admin', 'crm_manager')
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = change_events.org_id
    AND p.role IN ('owner', 'admin')
  )
);

-- Update for review actions
CREATE POLICY "change_events_update_review"
ON change_events FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM crm_user_orgs cuo
    WHERE cuo.org_id = change_events.org_id
    AND cuo.user_id = auth.uid()
    AND cuo.role IN ('crm_admin', 'crm_manager')
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = change_events.org_id
    AND p.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_user_orgs cuo
    WHERE cuo.org_id = change_events.org_id
    AND cuo.user_id = auth.uid()
    AND cuo.role IN ('crm_admin', 'crm_manager')
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = change_events.org_id
    AND p.role IN ('owner', 'admin')
  )
);

-- Service role can insert (for system/integration changes)
CREATE POLICY "change_events_service_insert"
ON change_events FOR INSERT
TO service_role
WITH CHECK (true);

-- Service role can update
CREATE POLICY "change_events_service_update"
ON change_events FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- CHANGE SUBSCRIPTIONS TABLE
-- User preferences for which changes to show in their feed
-- ============================================================================

CREATE TABLE IF NOT EXISTS change_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Filter settings
  entity_types text[] DEFAULT '{}',        -- Empty = all types
  source_types text[] DEFAULT '{}',        -- Empty = all sources
  min_severity text DEFAULT 'info' CHECK (min_severity IN ('critical', 'high', 'medium', 'low', 'info')),

  -- Notification preferences
  show_in_ticker boolean DEFAULT true,
  send_push boolean DEFAULT false,
  send_email boolean DEFAULT false,
  email_digest text DEFAULT 'none' CHECK (email_digest IN ('none', 'hourly', 'daily', 'weekly')),

  -- Sound preferences
  sound_enabled boolean DEFAULT true,
  sound_critical_only boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(org_id, user_id)
);

COMMENT ON TABLE change_subscriptions IS 'User preferences for change notifications and feed filtering';

-- Index for user lookup
CREATE INDEX idx_change_subscriptions_user ON change_subscriptions(user_id);

-- RLS
ALTER TABLE change_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own subscriptions
CREATE POLICY "change_subscriptions_own"
ON change_subscriptions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- VIEW: Change Feed with Actor Info
-- Optimized view for feed queries
-- ============================================================================

CREATE OR REPLACE VIEW change_feed_view AS
SELECT
  ce.*,
  p.full_name as actor_full_name,
  p.avatar_url as actor_avatar_url,
  rp.full_name as reviewer_full_name
FROM change_events ce
LEFT JOIN profiles p ON ce.actor_id = p.id
LEFT JOIN profiles rp ON ce.reviewed_by = rp.id;

COMMENT ON VIEW change_feed_view IS 'Change events with joined actor and reviewer profile information';

-- ============================================================================
-- FUNCTION: Record Change Event
-- Helper function to insert change events with proper defaults
-- ============================================================================

CREATE OR REPLACE FUNCTION record_change_event(
  p_org_id uuid,
  p_source_type text,
  p_source_name text,
  p_change_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_entity_title text,
  p_title text,
  p_description text DEFAULT NULL,
  p_diff jsonb DEFAULT NULL,
  p_payload jsonb DEFAULT '{}',
  p_actor_id uuid DEFAULT NULL,
  p_actor_type text DEFAULT 'user',
  p_severity text DEFAULT NULL,
  p_requires_review boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_severity text;
  v_requires_review boolean;
  v_change_id uuid;
  v_actor_name text;
BEGIN
  -- Calculate severity if not provided
  IF p_severity IS NULL THEN
    v_severity := CASE
      WHEN p_change_type IN ('termination', 'integration_error') THEN 'critical'
      WHEN p_change_type IN ('plan_change', 'sync_conflict') OR p_change_type LIKE 'status_change:inactive%' THEN 'high'
      WHEN p_change_type IN ('enrollment', 'member_new') THEN 'medium'
      WHEN p_change_type = 'create' THEN 'low'
      ELSE 'info'
    END;
  ELSE
    v_severity := p_severity;
  END IF;

  -- Determine if review is required
  IF p_requires_review IS NULL THEN
    v_requires_review := v_severity IN ('critical', 'high') OR p_change_type IN ('termination', 'plan_change');
  ELSE
    v_requires_review := p_requires_review;
  END IF;

  -- Get actor name if actor_id provided
  IF p_actor_id IS NOT NULL THEN
    SELECT full_name INTO v_actor_name FROM profiles WHERE id = p_actor_id;
  END IF;

  -- Insert the change event
  INSERT INTO change_events (
    org_id, source_type, source_name, change_type, entity_type, entity_id,
    entity_title, title, description, diff, payload, actor_id, actor_name,
    actor_type, severity, requires_review, reconciliation_status
  ) VALUES (
    p_org_id, p_source_type, p_source_name, p_change_type, p_entity_type, p_entity_id,
    p_entity_title, p_title, p_description, p_diff, p_payload, p_actor_id, v_actor_name,
    p_actor_type, v_severity, v_requires_review,
    CASE WHEN v_requires_review THEN 'pending' ELSE 'none' END
  )
  RETURNING id INTO v_change_id;

  RETURN v_change_id;
END;
$$;

COMMENT ON FUNCTION record_change_event IS 'Helper function to record change events with automatic severity calculation';

-- ============================================================================
-- FUNCTION: Get Change Feed Stats
-- Returns summary statistics for the change feed
-- ============================================================================

CREATE OR REPLACE FUNCTION get_change_feed_stats(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_today', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
    'critical_count', COUNT(*) FILTER (WHERE severity = 'critical' AND reconciliation_status IN ('none', 'pending')),
    'high_count', COUNT(*) FILTER (WHERE severity = 'high' AND reconciliation_status IN ('none', 'pending')),
    'pending_review', COUNT(*) FILTER (WHERE requires_review = true AND reconciliation_status IN ('none', 'pending')),
    'sync_conflicts', COUNT(*) FILTER (WHERE sync_status = 'conflict'),
    'by_source', jsonb_object_agg(
      COALESCE(source_type, 'unknown'),
      source_count
    )
  ) INTO v_stats
  FROM (
    SELECT
      ce.*,
      COUNT(*) OVER (PARTITION BY source_type) as source_count
    FROM change_events ce
    WHERE ce.org_id = p_org_id
    AND ce.created_at >= CURRENT_DATE - INTERVAL '7 days'
  ) sub;

  RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_change_feed_stats IS 'Returns summary statistics for the change intelligence dashboard';

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE change_events;
