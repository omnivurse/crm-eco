/*
  # Team Collaboration Features - Meetings, Announcements, and Presence

  ## New Tables

  ### 1. team_meetings
  - `id` (uuid, primary key)
  - `title` (text) - Meeting title
  - `description` (text) - Meeting description
  - `scheduled_at` (timestamptz) - Meeting start time
  - `duration_minutes` (integer) - Meeting duration
  - `meeting_link` (text) - Virtual meeting URL
  - `location` (text) - Physical location if applicable
  - `created_by` (uuid) - Meeting organizer
  - `status` (text) - 'scheduled', 'in_progress', 'completed', 'cancelled'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. meeting_participants
  - `id` (uuid, primary key)
  - `meeting_id` (uuid, foreign key)
  - `user_id` (uuid, foreign key)
  - `status` (text) - 'invited', 'accepted', 'declined', 'tentative'
  - `attended` (boolean) - Whether they attended
  - `created_at` (timestamptz)

  ### 3. team_announcements
  - `id` (uuid, primary key)
  - `title` (text) - Announcement title
  - `content` (text) - Announcement body
  - `priority` (text) - 'low', 'normal', 'high', 'urgent'
  - `created_by` (uuid) - Author
  - `target_roles` (text[]) - Roles that should see this
  - `expires_at` (timestamptz) - Optional expiration
  - `is_pinned` (boolean) - Pin to top
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. announcement_reads
  - `id` (uuid, primary key)
  - `announcement_id` (uuid, foreign key)
  - `user_id` (uuid, foreign key)
  - `read_at` (timestamptz)

  ### 5. team_presence
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `status` (text) - 'online', 'away', 'offline'
  - `last_seen_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. team_activities
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `action_type` (text) - Type of activity
  - `entity_type` (text) - 'ticket', 'comment', 'meeting', etc.
  - `entity_id` (uuid) - Related entity ID
  - `metadata` (jsonb) - Additional data
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all new tables
  - Staff and admin users can view all collaboration features
  - Users can manage their own participation and reads
  - Only admins can create announcements
  - Meeting creators can manage their meetings
*/

-- Team Meetings Table
CREATE TABLE IF NOT EXISTS team_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  meeting_link text DEFAULT '',
  location text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_meetings_scheduled ON team_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_team_meetings_status ON team_meetings(status);

ALTER TABLE team_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all meetings"
  ON team_meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Staff can create meetings"
  ON team_meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Meeting creators can update their meetings"
  ON team_meetings FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Meeting creators can delete their meetings"
  ON team_meetings FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Meeting Participants Table
CREATE TABLE IF NOT EXISTS meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES team_meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'tentative')),
  attended boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id);

ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view meeting participants"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Meeting creators can add participants"
  ON meeting_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_meetings
      WHERE team_meetings.id = meeting_participants.meeting_id
      AND team_meetings.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participation status"
  ON meeting_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Team Announcements Table
CREATE TABLE IF NOT EXISTS team_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_roles text[] DEFAULT ARRAY['staff', 'agent', 'admin', 'super_admin']::text[],
  expires_at timestamptz DEFAULT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_announcements_created ON team_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_announcements_pinned ON team_announcements(is_pinned);

ALTER TABLE team_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view announcements for their role"
  ON team_announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = ANY(target_roles)
    )
  );

CREATE POLICY "Admins can create announcements"
  ON team_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update announcements"
  ON team_announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete announcements"
  ON team_announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Announcement Reads Table
CREATE TABLE IF NOT EXISTS announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES team_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);

ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reads"
  ON announcement_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark announcements as read"
  ON announcement_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Team Presence Table
CREATE TABLE IF NOT EXISTS team_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  last_seen_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_presence_user ON team_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_team_presence_status ON team_presence(status);

ALTER TABLE team_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view team presence"
  ON team_presence FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Users can update their own presence"
  ON team_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own presence status"
  ON team_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Team Activities Table
CREATE TABLE IF NOT EXISTS team_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_activities_user ON team_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activities_created ON team_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activities_entity ON team_activities(entity_type, entity_id);

ALTER TABLE team_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view team activities"
  ON team_activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "System can insert activities"
  ON team_activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to automatically update presence on activity
CREATE OR REPLACE FUNCTION update_user_presence()
RETURNS trigger AS $$
BEGIN
  INSERT INTO team_presence (user_id, status, last_seen_at, updated_at)
  VALUES (NEW.user_id, 'online', now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = 'online',
    last_seen_at = now(),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update presence on activity
CREATE TRIGGER trigger_update_presence_on_activity
  AFTER INSERT ON team_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_user_presence();

-- Function to clean up stale presence records
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  UPDATE team_presence
  SET status = 'offline'
  WHERE status IN ('online', 'away')
  AND last_seen_at < now() - interval '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;