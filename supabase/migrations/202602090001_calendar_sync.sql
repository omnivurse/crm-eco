-- ============================================================================
-- CALENDAR SYNC
-- Tables for syncing calendar events from Google Calendar and Microsoft Outlook
-- ============================================================================

-- ============================================================================
-- CALENDAR EVENTS CACHE
-- Stores synced calendar events from external providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- External identifiers
  external_id TEXT NOT NULL,
  external_calendar_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- google_calendar, microsoft_outlook

  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,

  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,

  -- Recurrence
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT,
  recurring_event_id TEXT,

  -- Attendees
  organizer_email TEXT,
  organizer_name TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  -- e.g., [{"email": "...", "name": "...", "status": "accepted|declined|tentative|needsAction"}]

  -- Meeting links
  meeting_url TEXT,
  meeting_provider TEXT, -- zoom, google_meet, microsoft_teams

  -- Status
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed, tentative, cancelled
  visibility TEXT DEFAULT 'default', -- default, public, private, confidential

  -- CRM links
  linked_contact_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
  linked_deal_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
  linked_task_id UUID REFERENCES crm_tasks(id) ON DELETE SET NULL,

  -- Sync metadata
  etag TEXT,
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint per provider
  UNIQUE(connection_id, external_id)
);

-- ============================================================================
-- CALENDAR SYNC STATE
-- Tracks sync state for each calendar
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE UNIQUE,

  -- Sync cursors
  sync_token TEXT,
  page_token TEXT,
  next_sync_token TEXT,

  -- Sync window
  sync_from TIMESTAMPTZ,
  sync_to TIMESTAMPTZ,

  -- Status
  last_full_sync_at TIMESTAMPTZ,
  last_incremental_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle', -- idle, syncing, error
  sync_error TEXT,

  -- Stats
  events_synced INT DEFAULT 0,
  calendars_synced INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CALENDAR LIST
-- User's connected calendars from external providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,

  -- External identifiers
  external_id TEXT NOT NULL,
  provider TEXT NOT NULL,

  -- Calendar details
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  timezone TEXT,

  -- Access level
  access_role TEXT, -- owner, writer, reader, freeBusyReader
  is_primary BOOLEAN DEFAULT FALSE,

  -- Sync settings
  is_selected BOOLEAN DEFAULT TRUE, -- Whether to sync events from this calendar
  sync_enabled BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(connection_id, external_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_calendar_events_org ON calendar_events(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection ON calendar_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner ON calendar_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_external ON calendar_events(external_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end ON calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_range ON calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_linked_contact ON calendar_events(linked_contact_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_linked_deal ON calendar_events(linked_deal_id);

CREATE INDEX IF NOT EXISTS idx_calendar_list_connection ON calendar_list(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_list_selected ON calendar_list(connection_id, is_selected);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_list ENABLE ROW LEVEL SECURITY;

-- Calendar Events Policies
DROP POLICY IF EXISTS "Users can view calendar events in their org" ON calendar_events;
CREATE POLICY "Users can view calendar events in their org"
  ON calendar_events FOR SELECT
  USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own calendar events" ON calendar_events;
CREATE POLICY "Users can manage their own calendar events"
  ON calendar_events FOR ALL
  USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Calendar Sync State Policies
DROP POLICY IF EXISTS "Users can view sync state for their connections" ON calendar_sync_state;
CREATE POLICY "Users can view sync state for their connections"
  ON calendar_sync_state FOR SELECT
  USING (connection_id IN (
    SELECT id FROM integration_connections
    WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Users can manage sync state for their connections" ON calendar_sync_state;
CREATE POLICY "Users can manage sync state for their connections"
  ON calendar_sync_state FOR ALL
  USING (connection_id IN (
    SELECT id FROM integration_connections
    WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  ));

-- Calendar List Policies
DROP POLICY IF EXISTS "Users can view calendars for their connections" ON calendar_list;
CREATE POLICY "Users can view calendars for their connections"
  ON calendar_list FOR SELECT
  USING (connection_id IN (
    SELECT id FROM integration_connections
    WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Users can manage calendars for their connections" ON calendar_list;
CREATE POLICY "Users can manage calendars for their connections"
  ON calendar_list FOR ALL
  USING (connection_id IN (
    SELECT id FROM integration_connections
    WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  ));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_sync_state_updated_at ON calendar_sync_state;
CREATE TRIGGER update_calendar_sync_state_updated_at
  BEFORE UPDATE ON calendar_sync_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_list_updated_at ON calendar_list;
CREATE TRIGGER update_calendar_list_updated_at
  BEFORE UPDATE ON calendar_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get calendar events for a date range
CREATE OR REPLACE FUNCTION get_calendar_events_range(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS SETOF calendar_events AS $$
BEGIN
  RETURN QUERY
  SELECT ce.*
  FROM calendar_events ce
  WHERE ce.owner_id = p_owner_id
    AND ce.status != 'cancelled'
    AND (
      (ce.start_time >= p_start AND ce.start_time < p_end)
      OR (ce.end_time > p_start AND ce.end_time <= p_end)
      OR (ce.start_time <= p_start AND ce.end_time >= p_end)
    )
  ORDER BY ce.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get free/busy slots for a user
CREATE OR REPLACE FUNCTION get_busy_slots(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE (
  busy_start TIMESTAMPTZ,
  busy_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT ce.start_time, ce.end_time
  FROM calendar_events ce
  WHERE ce.owner_id = p_owner_id
    AND ce.status = 'confirmed'
    AND ce.start_time < p_end
    AND ce.end_time > p_start
  ORDER BY ce.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
