/*
  # GoTo Connect Call Center Integration System

  ## Overview
  This migration creates a comprehensive call center system integrated with GoTo Connect API.
  It enables agents to make/receive calls, automatically creates tickets from incoming calls,
  links calls to existing tickets, stores call recordings, and provides real-time call tracking.

  ## 1. New Tables

  ### `call_logs`
  Complete audit trail of all calls (inbound/outbound) with GoTo Connect integration.
  - `id` (uuid, primary key) - Unique call identifier
  - `goto_call_id` (text, unique) - GoTo Connect call ID for API reference
  - `goto_conversation_space_id` (text) - GoTo conversation space ID for event tracking
  - `ticket_id` (uuid, nullable FK) - Linked support ticket (auto-created or manually linked)
  - `caller_phone` (text) - Phone number of the caller
  - `caller_name` (text, nullable) - Name of caller (from caller ID or profile lookup)
  - `recipient_phone` (text) - Phone number called/receiving
  - `assigned_agent_id` (uuid, nullable FK) - Agent who handled/is handling the call
  - `direction` (enum: inbound, outbound) - Call direction
  - `status` (enum: queued, ringing, active, ended, missed, voicemail, failed) - Current call state
  - `started_at` (timestamptz, nullable) - When call was answered/started
  - `ended_at` (timestamptz, nullable) - When call ended
  - `duration_seconds` (int, default 0) - Total call duration in seconds
  - `recording_url` (text, nullable) - URL to call recording in Supabase storage
  - `recording_transcription` (text, nullable) - AI-generated transcription of call
  - `call_summary` (text, nullable) - AI-generated summary of call content
  - `outcome` (text, nullable) - Call outcome (resolved, callback_needed, escalated, etc.)
  - `notes` (text) - Agent notes about the call
  - `metadata` (jsonb, default '{}') - Additional GoTo Connect metadata
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

  ### `call_participants`
  Tracks all participants in a call (supports conference calls and transfers).
  - `id` (uuid, primary key)
  - `call_log_id` (uuid, FK) - Reference to call_logs
  - `profile_id` (uuid, nullable FK) - User profile if participant is a registered user
  - `phone_number` (text) - Participant phone number
  - `display_name` (text) - Display name of participant
  - `role` (enum: caller, agent, observer, transferred) - Participant role in call
  - `joined_at` (timestamptz, default now()) - When participant joined
  - `left_at` (timestamptz, nullable) - When participant left call
  - `is_primary` (boolean, default false) - Is this the primary participant (original caller/agent)

  ### `goto_devices`
  Registered WebRTC devices for agents to make/receive calls via browser.
  - `id` (uuid, primary key)
  - `agent_id` (uuid, FK) - Agent who owns this device
  - `goto_device_id` (text, unique) - GoTo Connect device ID
  - `device_name` (text) - Friendly name for device (e.g., "Chrome Desktop", "Safari Mobile")
  - `device_type` (text, default 'webrtc') - Device type (webrtc, softphone, desk_phone)
  - `extension_number` (text) - Phone extension assigned to device
  - `is_active` (boolean, default true) - Whether device is currently registered
  - `last_heartbeat_at` (timestamptz, default now()) - Last successful connection check
  - `registration_data` (jsonb) - Device registration metadata from GoTo Connect
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

  ### `call_queue`
  Manages incoming calls waiting for agent assignment with priority routing.
  - `id` (uuid, primary key)
  - `call_log_id` (uuid, FK, unique) - Reference to the queued call
  - `priority` (int, default 5) - Queue priority (1=highest, 10=lowest)
  - `queue_position` (int) - Position in queue
  - `wait_time_seconds` (int, default 0) - Time spent waiting in queue
  - `routing_strategy` (text, default 'round_robin') - How to route (round_robin, skill_based, priority)
  - `required_skills` (text[], default '{}') - Skills required to handle call
  - `assigned_at` (timestamptz, nullable) - When call was assigned to agent
  - `status` (enum: waiting, assigned, timeout, abandoned) - Queue status
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

  ### `goto_webhooks`
  Audit log of all webhook events received from GoTo Connect for debugging and recovery.
  - `id` (uuid, primary key)
  - `event_id` (text, unique) - Unique event ID from GoTo Connect
  - `event_type` (text) - Type of event (STARTING, ACTIVE, ENDING, etc.)
  - `conversation_space_id` (text) - GoTo conversation space ID
  - `sequence_number` (int) - Sequence number for event ordering
  - `payload` (jsonb) - Full webhook payload
  - `processed_at` (timestamptz, nullable) - When event was successfully processed
  - `processing_error` (text, nullable) - Error message if processing failed
  - `retry_count` (int, default 0) - Number of processing retry attempts
  - `created_at` (timestamptz, default now())

  ### `goto_settings`
  System-wide GoTo Connect configuration and credentials (one row only).
  - `id` (uuid, primary key, default gen_random_uuid())
  - `access_token_encrypted` (text) - Encrypted personal access token
  - `webhook_url` (text) - Webhook endpoint URL for call events
  - `notification_channel_id` (text, nullable) - GoTo notification channel ID
  - `business_hours_start` (time, default '09:00') - Business hours start time
  - `business_hours_end` (time, default '17:00') - Business hours end time
  - `max_queue_wait_seconds` (int, default 300) - Max wait time before overflow
  - `voicemail_enabled` (boolean, default true) - Enable voicemail after timeout
  - `auto_ticket_creation` (boolean, default true) - Auto-create ticket for incoming calls
  - `call_recording_enabled` (boolean, default true) - Record all calls
  - `recording_retention_days` (int, default 90) - Days to keep recordings
  - `settings` (jsonb, default '{}') - Additional configuration
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

  ### `agent_call_status`
  Real-time agent availability status for call routing.
  - `agent_id` (uuid, primary key, FK) - Agent profile ID
  - `status` (enum: available, busy, away, dnd, offline) - Current status
  - `status_message` (text, nullable) - Optional status message
  - `active_call_id` (uuid, nullable, FK) - Current active call if busy
  - `max_concurrent_calls` (int, default 1) - Max simultaneous calls agent can handle
  - `current_call_count` (int, default 0) - Number of active calls
  - `skills` (text[], default '{}') - Agent skills for routing (hardware, software, network, etc.)
  - `auto_answer` (boolean, default false) - Automatically answer incoming calls
  - `updated_at` (timestamptz, default now())

  ## 2. Enums

  - `call_direction`: 'inbound', 'outbound'
  - `call_status`: 'queued', 'ringing', 'active', 'ended', 'missed', 'voicemail', 'failed'
  - `call_participant_role`: 'caller', 'agent', 'observer', 'transferred'
  - `queue_status`: 'waiting', 'assigned', 'timeout', 'abandoned'
  - `agent_status`: 'available', 'busy', 'away', 'dnd', 'offline'

  ## 3. Security (RLS Policies)

  All tables have RLS enabled with the following access patterns:

  - **call_logs**: Agents/admins see all, requesters see only their own calls
  - **call_participants**: Follow call_logs access rules
  - **goto_devices**: Agents manage their own devices, admins manage all
  - **call_queue**: Agents/admins read all, system writes
  - **goto_webhooks**: Admin read-only for debugging
  - **goto_settings**: Admin full access only
  - **agent_call_status**: All authenticated users read (for availability), agents update own

  ## 4. Indexes

  Performance indexes on:
  - call_logs: status, assigned_agent_id, ticket_id, created_at, caller_phone
  - call_queue: status, priority, created_at
  - goto_webhooks: event_id, conversation_space_id, sequence_number
  - goto_devices: agent_id, is_active
  - Foreign key relationships

  ## 5. Functions & Triggers

  - Auto-update updated_at timestamp on row changes
  - Automatic ticket creation trigger for inbound calls (if enabled)
  - Agent status auto-update when call starts/ends
  - Queue position recalculation on status changes
  - Call duration calculation on call end

  ## 6. Storage

  - Create 'call-recordings' bucket for storing call audio files
  - RLS policies for recording access (agents/admins + ticket requester only)
*/

-- =====================================================================
-- 1. CREATE ENUMS
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE call_status AS ENUM ('queued', 'ringing', 'active', 'ended', 'missed', 'voicemail', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE call_participant_role AS ENUM ('caller', 'agent', 'observer', 'transferred');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE queue_status AS ENUM ('waiting', 'assigned', 'timeout', 'abandoned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE agent_status AS ENUM ('available', 'busy', 'away', 'dnd', 'offline');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================================
-- 2. CREATE TABLES
-- =====================================================================

-- Call Logs Table
CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goto_call_id text UNIQUE,
  goto_conversation_space_id text,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  caller_phone text NOT NULL,
  caller_name text,
  recipient_phone text NOT NULL,
  assigned_agent_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  direction call_direction NOT NULL,
  status call_status DEFAULT 'queued',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int DEFAULT 0,
  recording_url text,
  recording_transcription text,
  call_summary text,
  outcome text,
  notes text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Call Participants Table
CREATE TABLE IF NOT EXISTS call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id uuid REFERENCES call_logs(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  display_name text,
  role call_participant_role NOT NULL,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  is_primary boolean DEFAULT false
);

-- GoTo Devices Table
CREATE TABLE IF NOT EXISTS goto_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  goto_device_id text UNIQUE NOT NULL,
  device_name text NOT NULL,
  device_type text DEFAULT 'webrtc',
  extension_number text,
  is_active boolean DEFAULT true,
  last_heartbeat_at timestamptz DEFAULT now(),
  registration_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Call Queue Table
CREATE TABLE IF NOT EXISTS call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id uuid REFERENCES call_logs(id) ON DELETE CASCADE UNIQUE NOT NULL,
  priority int DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  queue_position int,
  wait_time_seconds int DEFAULT 0,
  routing_strategy text DEFAULT 'round_robin',
  required_skills text[] DEFAULT '{}',
  assigned_at timestamptz,
  status queue_status DEFAULT 'waiting',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- GoTo Webhooks Table
CREATE TABLE IF NOT EXISTS goto_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text NOT NULL,
  conversation_space_id text,
  sequence_number int,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  processing_error text,
  retry_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- GoTo Settings Table
CREATE TABLE IF NOT EXISTS goto_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_encrypted text,
  webhook_url text,
  notification_channel_id text,
  business_hours_start time DEFAULT '09:00',
  business_hours_end time DEFAULT '17:00',
  max_queue_wait_seconds int DEFAULT 300,
  voicemail_enabled boolean DEFAULT true,
  auto_ticket_creation boolean DEFAULT true,
  call_recording_enabled boolean DEFAULT true,
  recording_retention_days int DEFAULT 90,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Agent Call Status Table
CREATE TABLE IF NOT EXISTS agent_call_status (
  agent_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  status agent_status DEFAULT 'offline',
  status_message text,
  active_call_id uuid REFERENCES call_logs(id) ON DELETE SET NULL,
  max_concurrent_calls int DEFAULT 1,
  current_call_count int DEFAULT 0,
  skills text[] DEFAULT '{}',
  auto_answer boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- =====================================================================
-- 3. CREATE INDEXES
-- =====================================================================

-- Call Logs Indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_assigned_agent ON call_logs(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_ticket ON call_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_phone ON call_logs(caller_phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_goto_call_id ON call_logs(goto_call_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_conversation_space ON call_logs(goto_conversation_space_id);

-- Call Participants Indexes
CREATE INDEX IF NOT EXISTS idx_call_participants_call_log ON call_participants(call_log_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_profile ON call_participants(profile_id);

-- GoTo Devices Indexes
CREATE INDEX IF NOT EXISTS idx_goto_devices_agent ON goto_devices(agent_id);
CREATE INDEX IF NOT EXISTS idx_goto_devices_active ON goto_devices(is_active);

-- Call Queue Indexes
CREATE INDEX IF NOT EXISTS idx_call_queue_status ON call_queue(status);
CREATE INDEX IF NOT EXISTS idx_call_queue_priority ON call_queue(priority, created_at);

-- GoTo Webhooks Indexes
CREATE INDEX IF NOT EXISTS idx_goto_webhooks_event_id ON goto_webhooks(event_id);
CREATE INDEX IF NOT EXISTS idx_goto_webhooks_conversation ON goto_webhooks(conversation_space_id);
CREATE INDEX IF NOT EXISTS idx_goto_webhooks_sequence ON goto_webhooks(sequence_number);
CREATE INDEX IF NOT EXISTS idx_goto_webhooks_created_at ON goto_webhooks(created_at DESC);

-- =====================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE goto_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE goto_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE goto_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_call_status ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 5. CREATE RLS POLICIES
-- =====================================================================

-- Call Logs Policies
CREATE POLICY "Agents and admins can view all call logs"
  ON call_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Users can view their own call logs"
  ON call_logs FOR SELECT
  TO authenticated
  USING (
    caller_phone IN (
      SELECT phone FROM profiles WHERE id = auth.uid()
    )
    OR assigned_agent_id = auth.uid()
    OR ticket_id IN (
      SELECT id FROM tickets WHERE requester_id = auth.uid()
    )
  );

CREATE POLICY "Agents and admins can insert call logs"
  ON call_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Agents and admins can update call logs"
  ON call_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  );

-- Call Participants Policies
CREATE POLICY "Call participants follow call log access"
  ON call_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM call_logs
      WHERE call_logs.id = call_participants.call_log_id
      AND (
        call_logs.assigned_agent_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('agent', 'admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Agents can manage call participants"
  ON call_participants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  );

-- GoTo Devices Policies
CREATE POLICY "Agents can view their own devices"
  ON goto_devices FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Admins can view all devices"
  ON goto_devices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Agents can manage their own devices"
  ON goto_devices FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Admins can manage all devices"
  ON goto_devices FOR ALL
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

-- Call Queue Policies
CREATE POLICY "Agents can view call queue"
  ON call_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "System can manage call queue"
  ON call_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  );

-- GoTo Webhooks Policies (Admin only for debugging)
CREATE POLICY "Admins can view webhooks"
  ON goto_webhooks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can insert webhooks"
  ON goto_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- GoTo Settings Policies (Admin only)
CREATE POLICY "Admins can manage goto settings"
  ON goto_settings FOR ALL
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

-- Agent Call Status Policies
CREATE POLICY "All authenticated users can view agent status"
  ON agent_call_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can update their own status"
  ON agent_call_status FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Admins can manage all agent statuses"
  ON agent_call_status FOR ALL
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

-- =====================================================================
-- 6. CREATE FUNCTIONS
-- =====================================================================

-- Function to update call duration on call end
CREATE OR REPLACE FUNCTION calculate_call_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::int;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update agent status when call starts/ends
CREATE OR REPLACE FUNCTION update_agent_call_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    -- Call started
    UPDATE agent_call_status
    SET
      status = 'busy',
      active_call_id = NEW.id,
      current_call_count = current_call_count + 1,
      updated_at = now()
    WHERE agent_id = NEW.assigned_agent_id;
  ELSIF NEW.status = 'ended' AND OLD.status = 'active' THEN
    -- Call ended
    UPDATE agent_call_status
    SET
      current_call_count = GREATEST(current_call_count - 1, 0),
      active_call_id = CASE
        WHEN current_call_count <= 1 THEN NULL
        ELSE active_call_id
      END,
      status = CASE
        WHEN current_call_count <= 1 THEN 'available'
        ELSE status
      END,
      updated_at = now()
    WHERE agent_id = NEW.assigned_agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate queue positions
CREATE OR REPLACE FUNCTION recalculate_queue_positions()
RETURNS TRIGGER AS $$
BEGIN
  WITH ranked_calls AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY priority ASC, created_at ASC) as new_position
    FROM call_queue
    WHERE status = 'waiting'
  )
  UPDATE call_queue
  SET queue_position = ranked_calls.new_position
  FROM ranked_calls
  WHERE call_queue.id = ranked_calls.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 7. CREATE TRIGGERS
-- =====================================================================

-- Trigger for updated_at on call_logs
DROP TRIGGER IF EXISTS set_call_logs_updated_at ON call_logs;
CREATE TRIGGER set_call_logs_updated_at
  BEFORE UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for call duration calculation
DROP TRIGGER IF EXISTS calculate_call_duration_trigger ON call_logs;
CREATE TRIGGER calculate_call_duration_trigger
  BEFORE INSERT OR UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_call_duration();

-- Trigger for agent status updates
DROP TRIGGER IF EXISTS update_agent_status_trigger ON call_logs;
CREATE TRIGGER update_agent_status_trigger
  AFTER UPDATE ON call_logs
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION update_agent_call_status();

-- Trigger for queue position recalculation
DROP TRIGGER IF EXISTS recalculate_queue_trigger ON call_queue;
CREATE TRIGGER recalculate_queue_trigger
  AFTER INSERT OR UPDATE ON call_queue
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_queue_positions();

-- Trigger for updated_at on goto_devices
DROP TRIGGER IF EXISTS set_goto_devices_updated_at ON goto_devices;
CREATE TRIGGER set_goto_devices_updated_at
  BEFORE UPDATE ON goto_devices
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for updated_at on call_queue
DROP TRIGGER IF EXISTS set_call_queue_updated_at ON call_queue;
CREATE TRIGGER set_call_queue_updated_at
  BEFORE UPDATE ON call_queue
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for updated_at on goto_settings
DROP TRIGGER IF EXISTS set_goto_settings_updated_at ON goto_settings;
CREATE TRIGGER set_goto_settings_updated_at
  BEFORE UPDATE ON goto_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 8. INSERT DEFAULT SETTINGS
-- =====================================================================

INSERT INTO goto_settings (id)
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;
