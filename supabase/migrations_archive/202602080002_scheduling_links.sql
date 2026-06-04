-- ============================================================================
-- SCHEDULING LINKS
-- Calendar scheduling system for appointments and meetings
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduling_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Link details
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  -- Meeting settings
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  meeting_type TEXT NOT NULL DEFAULT 'video' CHECK (meeting_type IN ('call', 'video', 'in_person')),
  video_provider TEXT,
  location TEXT,

  -- Availability settings
  availability JSONB NOT NULL DEFAULT '{
    "monday": [{"start": "09:00", "end": "17:00"}],
    "tuesday": [{"start": "09:00", "end": "17:00"}],
    "wednesday": [{"start": "09:00", "end": "17:00"}],
    "thursday": [{"start": "09:00", "end": "17:00"}],
    "friday": [{"start": "09:00", "end": "17:00"}]
  }'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',

  -- Booking constraints
  min_notice_hours INTEGER NOT NULL DEFAULT 24,
  max_days_in_advance INTEGER NOT NULL DEFAULT 60,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique slug per org
  UNIQUE(org_id, slug)
);

-- Scheduled appointments
CREATE TABLE IF NOT EXISTS scheduled_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scheduling_link_id UUID NOT NULL REFERENCES scheduling_links(id) ON DELETE CASCADE,

  -- Attendee info
  attendee_name TEXT NOT NULL,
  attendee_email TEXT NOT NULL,
  attendee_phone TEXT,
  attendee_notes TEXT,

  -- Linked records
  contact_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,

  -- Appointment details
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,

  -- Meeting info
  meeting_type TEXT NOT NULL,
  meeting_url TEXT,
  location TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Reminders
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduling_links_org ON scheduling_links(org_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_links_owner ON scheduling_links(owner_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_links_slug ON scheduling_links(org_id, slug);
CREATE INDEX IF NOT EXISTS idx_scheduling_links_active ON scheduling_links(org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_scheduled_appointments_org ON scheduled_appointments(org_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_appointments_link ON scheduled_appointments(scheduling_link_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_appointments_start ON scheduled_appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_appointments_status ON scheduled_appointments(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_appointments_attendee ON scheduled_appointments(attendee_email);

-- RLS
ALTER TABLE scheduling_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_appointments ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view scheduling links in their org" ON scheduling_links;
CREATE POLICY "Users can view scheduling links in their org"
  ON scheduling_links FOR SELECT
  USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage scheduling links in their org" ON scheduling_links;
CREATE POLICY "Users can manage scheduling links in their org"
  ON scheduling_links FOR ALL
  USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view appointments in their org" ON scheduled_appointments;
CREATE POLICY "Users can view appointments in their org"
  ON scheduled_appointments FOR SELECT
  USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage appointments in their org" ON scheduled_appointments;
CREATE POLICY "Users can manage appointments in their org"
  ON scheduled_appointments FOR ALL
  USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Allow public to insert appointments (for booking)
DROP POLICY IF EXISTS "Anyone can create appointments via booking" ON scheduled_appointments;
CREATE POLICY "Anyone can create appointments via booking"
  ON scheduled_appointments FOR INSERT
  WITH CHECK (TRUE);

-- Triggers
DROP TRIGGER IF EXISTS update_scheduling_links_updated_at ON scheduling_links;
CREATE TRIGGER update_scheduling_links_updated_at
  BEFORE UPDATE ON scheduling_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_appointments_updated_at ON scheduled_appointments;
CREATE TRIGGER update_scheduled_appointments_updated_at
  BEFORE UPDATE ON scheduled_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
