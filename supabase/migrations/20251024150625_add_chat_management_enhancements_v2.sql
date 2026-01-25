/*
  # Chat Management Enhancements
  
  ## Overview
  Adds support for chat quick responses, agent preferences, and enhanced session tracking
  for the Chat Management system.
  
  ## 1. New Tables
  
  ### `chat_quick_responses`
  Pre-defined quick responses for agents (linked to KB articles)
  - `id` (uuid, primary key)
  - `title` (text) - Quick response title
  - `content` (text) - Response content
  - `kb_article_id` (uuid) - Optional link to KB article
  - `category` (text) - Category for organization
  - `is_active` (boolean)
  - `usage_count` (integer) - Track popularity
  - `created_by` (uuid) - Agent who created it
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `agent_chat_preferences`
  Store agent-specific chat settings
  - `id` (uuid, primary key)
  - `agent_id` (uuid) - References profiles
  - `notification_sound` (boolean)
  - `desktop_notifications` (boolean)
  - `auto_accept_chats` (boolean)
  - `max_concurrent_chats` (integer)
  - `favorite_responses` (jsonb) - Array of quick response IDs
  - `availability_status` (text) - online, offline, busy
  - `updated_at` (timestamptz)
  
  ### `chat_session_notes`
  Internal notes agents can add during chats
  - `id` (uuid, primary key)
  - `session_id` (uuid) - References chat_sessions
  - `agent_id` (uuid) - References profiles
  - `note` (text)
  - `created_at` (timestamptz)
  
  ## 2. Security
  - Enable RLS on all new tables
  - Agents can manage their own preferences
  - Quick responses visible to all agents, editable by creators and admins
*/

-- Create chat_quick_responses table
CREATE TABLE IF NOT EXISTS chat_quick_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  kb_article_id uuid REFERENCES kb_articles(id) ON DELETE SET NULL,
  category text DEFAULT 'general',
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create agent_chat_preferences table
CREATE TABLE IF NOT EXISTS agent_chat_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid UNIQUE REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notification_sound boolean DEFAULT true,
  desktop_notifications boolean DEFAULT true,
  auto_accept_chats boolean DEFAULT false,
  max_concurrent_chats integer DEFAULT 5,
  favorite_responses jsonb DEFAULT '[]',
  availability_status text DEFAULT 'online',
  updated_at timestamptz DEFAULT now()
);

-- Create chat_session_notes table
CREATE TABLE IF NOT EXISTS chat_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quick_responses_category ON chat_quick_responses(category);
CREATE INDEX IF NOT EXISTS idx_quick_responses_active ON chat_quick_responses(is_active);
CREATE INDEX IF NOT EXISTS idx_quick_responses_usage ON chat_quick_responses(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_quick_responses_kb ON chat_quick_responses(kb_article_id);
CREATE INDEX IF NOT EXISTS idx_agent_preferences_agent ON agent_chat_preferences(agent_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_session ON chat_session_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_agent ON chat_session_notes(agent_id);

-- Enable Row Level Security
ALTER TABLE chat_quick_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_chat_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_session_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_quick_responses

-- All agents can read active quick responses
CREATE POLICY "quick_responses_agent_read" ON chat_quick_responses
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
    )
  );

-- Agents can create quick responses
CREATE POLICY "quick_responses_agent_insert" ON chat_quick_responses
  FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
    )
    AND created_by = auth.uid()
  );

-- Agents can update their own quick responses
CREATE POLICY "quick_responses_creator_update" ON chat_quick_responses
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- Agents can delete their own quick responses
CREATE POLICY "quick_responses_creator_delete" ON chat_quick_responses
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for agent_chat_preferences

-- Agents can read and manage their own preferences
CREATE POLICY "chat_prefs_agent_all" ON agent_chat_preferences
  FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Admins can read all preferences
CREATE POLICY "chat_prefs_admin_read" ON agent_chat_preferences
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for chat_session_notes

-- Agents can read notes for sessions they're involved in
CREATE POLICY "session_notes_agent_read" ON chat_session_notes
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = chat_session_notes.session_id
      AND cs.assigned_agent_id = auth.uid()
    )
    OR EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- Agents can create notes for their assigned sessions
CREATE POLICY "session_notes_agent_insert" ON chat_session_notes
  FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = session_id
      AND cs.assigned_agent_id = auth.uid()
    )
    AND agent_id = auth.uid()
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for chat_quick_responses
DROP TRIGGER IF EXISTS update_quick_responses_updated_at ON chat_quick_responses;
CREATE TRIGGER update_quick_responses_updated_at
  BEFORE UPDATE ON chat_quick_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for agent_chat_preferences
DROP TRIGGER IF EXISTS update_agent_prefs_updated_at ON agent_chat_preferences;
CREATE TRIGGER update_agent_prefs_updated_at
  BEFORE UPDATE ON agent_chat_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment quick response usage count
CREATE OR REPLACE FUNCTION increment_quick_response_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.metadata ? 'quick_response_id' THEN
    UPDATE chat_quick_responses
    SET usage_count = usage_count + 1
    WHERE id = (NEW.metadata->>'quick_response_id')::uuid;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track quick response usage
DROP TRIGGER IF EXISTS track_quick_response_usage ON channel_messages;
CREATE TRIGGER track_quick_response_usage
  AFTER INSERT ON channel_messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_quick_response_usage();

-- Create view for chat analytics by agent
CREATE OR REPLACE VIEW chat_analytics_by_agent AS
SELECT 
  p.id as agent_id,
  p.full_name as agent_name,
  p.email as agent_email,
  COUNT(DISTINCT cs.id) as total_sessions,
  COUNT(DISTINCT CASE WHEN cs.status = 'active' THEN cs.id END) as active_sessions,
  COUNT(DISTINCT CASE WHEN cs.status = 'ended' THEN cs.id END) as completed_sessions,
  ROUND(AVG(EXTRACT(EPOCH FROM (cs.ended_at - cs.started_at)) / 60)::numeric, 2) as avg_session_duration_minutes,
  ROUND(AVG(
    CASE 
      WHEN cs.metadata ? 'satisfaction_rating' 
      THEN (cs.metadata->>'satisfaction_rating')::numeric 
    END
  ), 2) as avg_satisfaction_rating,
  COUNT(DISTINCT cm.id) as total_messages_sent,
  ROUND(
    COUNT(DISTINCT cm.id)::numeric / NULLIF(COUNT(DISTINCT cs.id), 0), 
    2
  ) as avg_messages_per_session
FROM profiles p
LEFT JOIN chat_sessions cs ON cs.assigned_agent_id = p.id
LEFT JOIN channel_messages cm ON cm.sender_id = p.id AND cm.sender_type = 'agent'
WHERE p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
GROUP BY p.id, p.full_name, p.email;

-- Create view for chat response time analytics
CREATE OR REPLACE VIEW chat_response_time_analytics AS
SELECT
  cs.id as session_id,
  cs.assigned_agent_id,
  cs.started_at,
  MIN(cm.created_at) FILTER (WHERE cm.sender_type = 'agent') as first_agent_response,
  EXTRACT(EPOCH FROM (
    MIN(cm.created_at) FILTER (WHERE cm.sender_type = 'agent') - cs.started_at
  )) / 60 as first_response_minutes,
  COUNT(cm.id) FILTER (WHERE cm.sender_type = 'customer') as customer_messages,
  COUNT(cm.id) FILTER (WHERE cm.sender_type = 'agent') as agent_messages
FROM chat_sessions cs
LEFT JOIN channel_messages cm ON cm.metadata->>'session_id' = cs.id::text
GROUP BY cs.id, cs.assigned_agent_id, cs.started_at;

-- Insert default quick responses (system-level responses have NULL created_by)
INSERT INTO chat_quick_responses (title, content, category, created_by)
VALUES 
  ('Greeting', 'Hello! How can I help you today?', 'greeting', NULL),
  ('Technical Issue', 'I understand you are experiencing a technical issue. Let me investigate this for you.', 'technical', NULL),
  ('Billing Question', 'I would be happy to help with your billing inquiry. Let me pull up your account information.', 'billing', NULL),
  ('Follow-up', 'Thank you for contacting us. Is there anything else I can help you with?', 'closing', NULL),
  ('Closing', 'Thank you for chatting with us today. Have a great day!', 'closing', NULL),
  ('Escalation', 'Let me connect you with a specialist who can better assist you with this matter.', 'escalation', NULL)
ON CONFLICT DO NOTHING;
