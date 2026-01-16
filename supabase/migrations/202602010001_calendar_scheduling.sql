-- ============================================================================
-- PHASE W15: CALENDAR SYNC + SCHEDULING
-- Google/Outlook calendar sync and Calendly-like booking links
-- ============================================================================

-- ============================================================================
-- CALENDAR CONNECTIONS
-- OAuth connections for calendar providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Provider
  provider text NOT NULL, -- google, microsoft
  
  -- Account info
  calendar_id text NOT NULL,
  calendar_name text,
  email_address text,
  
  -- OAuth tokens
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  
  -- Sync settings
  sync_enabled boolean DEFAULT true,
  sync_direction text DEFAULT 'both', -- read, write, both
  
  -- Status
  status text DEFAULT 'active', -- active, paused, error, revoked
  last_sync_at timestamptz,
  sync_error text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(org_id, user_id, provider, calendar_id)
);

CREATE INDEX idx_calendar_connections_org ON calendar_connections(org_id);
CREATE INDEX idx_calendar_connections_user ON calendar_connections(user_id);

-- ============================================================================
-- CALENDAR EVENTS CACHE
-- Cached calendar events from connected calendars
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_events_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  
  -- External reference
  external_id text NOT NULL,
  
  -- Event info
  title text NOT NULL,
  description text,
  location text,
  
  -- Timing
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  all_day boolean DEFAULT false,
  timezone text,
  
  -- Attendees
  organizer_email text,
  attendees jsonb DEFAULT '[]'::jsonb,
  
  -- Recurrence
  recurring boolean DEFAULT false,
  recurrence_rule text,
  
  -- Status
  status text DEFAULT 'confirmed', -- confirmed, tentative, cancelled
  
  -- CRM links
  linked_record_id uuid,
  linked_record_type text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(connection_id, external_id)
);

CREATE INDEX idx_calendar_events_org ON calendar_events_cache(org_id);
CREATE INDEX idx_calendar_events_connection ON calendar_events_cache(connection_id);
CREATE INDEX idx_calendar_events_time ON calendar_events_cache(start_time, end_time);
CREATE INDEX idx_calendar_events_linked ON calendar_events_cache(linked_record_id);

-- ============================================================================
-- SCHEDULING LINKS
-- Calendly-like booking link configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduling_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Link info
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  
  -- Meeting settings
  duration_minutes int NOT NULL DEFAULT 30,
  buffer_minutes int DEFAULT 0,
  
  -- Meeting type
  meeting_type text DEFAULT 'video', -- call, video, in_person
  video_provider text, -- zoom, google_meet, microsoft_teams
  location text,
  
  -- Availability
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- { monday: [{start: "09:00", end: "17:00"}], ... }
  
  timezone text DEFAULT 'America/New_York',
  
  -- Booking rules
  min_notice_hours int DEFAULT 24,
  max_days_in_advance int DEFAULT 60,
  max_bookings_per_day int,
  
  -- Routing (for team scheduling)
  routing_type text DEFAULT 'owner', -- owner, round_robin, most_available
  routing_rules jsonb,
  
  -- Customization
  custom_questions jsonb DEFAULT '[]'::jsonb,
  confirmation_message text,
  reminder_enabled boolean DEFAULT true,
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(org_id, slug)
);

CREATE INDEX idx_scheduling_links_org ON scheduling_links(org_id);
CREATE INDEX idx_scheduling_links_owner ON scheduling_links(owner_id);
CREATE INDEX idx_scheduling_links_slug ON scheduling_links(slug);

-- ============================================================================
-- SCHEDULING BOOKINGS
-- Actual bookings made through scheduling links
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduling_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES scheduling_links(id) ON DELETE CASCADE,
  
  -- Assigned host
  host_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Invitee info
  invitee_name text NOT NULL,
  invitee_email text NOT NULL,
  invitee_phone text,
  invitee_timezone text,
  
  -- Meeting time
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  
  -- Meeting details
  meeting_type text,
  meeting_url text,
  meeting_id text,
  location text,
  
  -- Status
  status text DEFAULT 'scheduled', -- scheduled, confirmed, cancelled, completed, no_show
  
  -- Calendar event
  calendar_event_id uuid REFERENCES calendar_events_cache(id) ON DELETE SET NULL,
  
  -- Custom answers
  custom_answers jsonb DEFAULT '{}'::jsonb,
  
  -- Notes
  notes text,
  cancellation_reason text,
  
  -- CRM links
  linked_contact_id uuid,
  linked_lead_id uuid,
  linked_deal_id uuid,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_scheduling_bookings_org ON scheduling_bookings(org_id);
CREATE INDEX idx_scheduling_bookings_link ON scheduling_bookings(link_id);
CREATE INDEX idx_scheduling_bookings_host ON scheduling_bookings(host_id);
CREATE INDEX idx_scheduling_bookings_time ON scheduling_bookings(start_time);
CREATE INDEX idx_scheduling_bookings_email ON scheduling_bookings(invitee_email);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their calendar connections"
  ON calendar_connections FOR SELECT
  USING (user_id = get_user_profile_id());

CREATE POLICY "Users can manage their calendar connections"
  ON calendar_connections FOR ALL
  USING (user_id = get_user_profile_id());

CREATE POLICY "Users can view calendar events for their org"
  ON calendar_events_cache FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Users can view scheduling links for their org"
  ON scheduling_links FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Users can manage their scheduling links"
  ON scheduling_links FOR ALL
  USING (owner_id = get_user_profile_id() OR get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view bookings for their org"
  ON scheduling_bookings FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Anyone can create bookings"
  ON scheduling_bookings FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduling_links_updated_at
  BEFORE UPDATE ON scheduling_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduling_bookings_updated_at
  BEFORE UPDATE ON scheduling_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
