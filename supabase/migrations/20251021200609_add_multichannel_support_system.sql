/*
  # Multi-Channel Support System
  
  ## Overview
  Enterprise-grade multi-channel support including email-to-ticket conversion,
  live chat, SMS, and social media integration capabilities.
  
  ## 1. New Tables
  
  ### `support_channels`
  Defines available support channels and their configuration
  - `id` (uuid, primary key)
  - `channel_type` (enum: email, chat, sms, phone, social, web)
  - `name` (text) - friendly name
  - `config` (jsonb) - channel-specific configuration
  - `is_active` (boolean)
  - `auto_create_ticket` (boolean)
  - `created_at` (timestamptz)
  
  ### `channel_messages`
  Stores all messages across all channels
  - `id` (uuid, primary key)
  - `channel_id` (uuid, references support_channels)
  - `ticket_id` (uuid, references tickets)
  - `sender_type` (enum: customer, agent, system)
  - `sender_id` (uuid) - user id if authenticated
  - `sender_name` (text)
  - `sender_email` (text)
  - `sender_phone` (text)
  - `message_body` (text)
  - `message_html` (text)
  - `attachments` (jsonb array)
  - `metadata` (jsonb) - channel-specific metadata
  - `is_internal` (boolean)
  - `thread_id` (text) - for email threading
  - `created_at` (timestamptz)
  
  ### `email_accounts`
  Email accounts for email-to-ticket processing
  - `id` (uuid, primary key)
  - `email_address` (text, unique)
  - `display_name` (text)
  - `provider` (text) - smtp, imap, etc
  - `config` (jsonb) - connection settings
  - `is_active` (boolean)
  - `last_sync_at` (timestamptz)
  - `created_at` (timestamptz)
  
  ### `chat_sessions`
  Live chat session management
  - `id` (uuid, primary key)
  - `visitor_id` (text) - anonymous visitor identifier
  - `customer_name` (text)
  - `customer_email` (text)
  - `ticket_id` (uuid, references tickets)
  - `assigned_agent_id` (uuid, references profiles)
  - `status` (enum: waiting, active, ended)
  - `started_at` (timestamptz)
  - `ended_at` (timestamptz)
  - `metadata` (jsonb) - visitor info, page url, etc
  
  ### `channel_routing_rules`
  Rules for automatic ticket routing by channel
  - `id` (uuid, primary key)
  - `channel_id` (uuid, references support_channels)
  - `priority` (integer)
  - `conditions` (jsonb) - matching conditions
  - `actions` (jsonb) - routing actions
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  
  ## 2. Security
  - Enable RLS on all tables
  - Messages: customers see own, agents see assigned/all
  - Chat sessions: agents can view and manage
  - Channel config: admin only
  
  ## 3. Indexes
  - Performance indexes on commonly queried fields
  - Message threading and ticket relationships
  - Chat session lookups
*/

-- Create channel type enum
DO $$ BEGIN
  CREATE TYPE channel_type AS ENUM ('email', 'chat', 'sms', 'phone', 'social', 'web');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create sender type enum
DO $$ BEGIN
  CREATE TYPE sender_type AS ENUM ('customer', 'agent', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create chat status enum
DO $$ BEGIN
  CREATE TYPE chat_status AS ENUM ('waiting', 'active', 'ended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create support_channels table
CREATE TABLE IF NOT EXISTS support_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type channel_type NOT NULL,
  name text NOT NULL,
  config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  auto_create_ticket boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create channel_messages table
CREATE TABLE IF NOT EXISTS channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES support_channels(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  sender_type sender_type NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name text,
  sender_email text,
  sender_phone text,
  message_body text NOT NULL,
  message_html text,
  attachments jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  is_internal boolean DEFAULT false,
  thread_id text,
  created_at timestamptz DEFAULT now()
);

-- Create email_accounts table
CREATE TABLE IF NOT EXISTS email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address text UNIQUE NOT NULL,
  display_name text,
  provider text DEFAULT 'smtp',
  config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  customer_name text,
  customer_email text,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  assigned_agent_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status chat_status DEFAULT 'waiting',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

-- Create channel_routing_rules table
CREATE TABLE IF NOT EXISTS channel_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES support_channels(id) ON DELETE CASCADE NOT NULL,
  priority integer DEFAULT 100,
  conditions jsonb NOT NULL,
  actions jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_ticket ON channel_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_thread ON channel_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_created_at ON channel_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_visitor ON chat_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent ON chat_sessions(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_channel ON channel_routing_rules(channel_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON channel_routing_rules(priority);

-- Enable Row Level Security
ALTER TABLE support_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_routing_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_channels

-- Staff and above can read all channels
CREATE POLICY "channels_staff_read" ON support_channels
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'it', 'admin', 'super_admin')
    )
  );

-- Only admins can manage channels
CREATE POLICY "channels_admin_all" ON support_channels
  FOR ALL
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for channel_messages

-- Agents can read all messages
CREATE POLICY "messages_agent_read" ON channel_messages
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
    )
  );

-- Customers can read their own messages
CREATE POLICY "messages_customer_read" ON channel_messages
  FOR SELECT
  USING (
    sender_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM tickets t
      WHERE t.id = channel_messages.ticket_id
      AND t.requester_id = auth.uid()
    )
  );

-- Authenticated users can insert messages
CREATE POLICY "messages_insert" ON channel_messages
  FOR INSERT
  WITH CHECK (true);

-- Agents can update messages
CREATE POLICY "messages_agent_update" ON channel_messages
  FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
    )
  );

-- RLS Policies for email_accounts

-- Staff and above can read email accounts
CREATE POLICY "email_accounts_staff_read" ON email_accounts
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'it', 'admin', 'super_admin')
    )
  );

-- Only admins can manage email accounts
CREATE POLICY "email_accounts_admin_all" ON email_accounts
  FOR ALL
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for chat_sessions

-- Agents can read all chat sessions
CREATE POLICY "chat_sessions_agent_read" ON chat_sessions
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
    )
  );

-- Public can create chat sessions
CREATE POLICY "chat_sessions_public_insert" ON chat_sessions
  FOR INSERT
  WITH CHECK (true);

-- Agents can update chat sessions
CREATE POLICY "chat_sessions_agent_update" ON chat_sessions
  FOR UPDATE
  USING (
    assigned_agent_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
    )
  );

-- RLS Policies for channel_routing_rules

-- Staff can read routing rules
CREATE POLICY "routing_rules_staff_read" ON channel_routing_rules
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'it', 'admin', 'super_admin')
    )
  );

-- Only admins can manage routing rules
CREATE POLICY "routing_rules_admin_all" ON channel_routing_rules
  FOR ALL
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- Function to create ticket from channel message
CREATE OR REPLACE FUNCTION create_ticket_from_message()
RETURNS TRIGGER AS $$
DECLARE
  new_ticket_id uuid;
  channel_config jsonb;
  auto_create boolean;
BEGIN
  -- Check if channel has auto_create_ticket enabled
  SELECT sc.auto_create_ticket, sc.config
  INTO auto_create, channel_config
  FROM support_channels sc
  WHERE sc.id = NEW.channel_id;
  
  -- Only create ticket if auto_create is enabled and no ticket exists
  IF auto_create AND NEW.ticket_id IS NULL AND NEW.sender_type = 'customer' THEN
    INSERT INTO tickets (
      subject,
      description,
      status,
      priority,
      origin,
      submitter_email,
      submitter_name
    ) VALUES (
      COALESCE(NEW.metadata->>'subject', 'New support request'),
      NEW.message_body,
      'new',
      'normal',
      CASE 
        WHEN (SELECT channel_type FROM support_channels WHERE id = NEW.channel_id) = 'email' THEN 'member'
        WHEN (SELECT channel_type FROM support_channels WHERE id = NEW.channel_id) = 'chat' THEN 'member'
        ELSE 'member'
      END,
      NEW.sender_email,
      NEW.sender_name
    ) RETURNING id INTO new_ticket_id;
    
    -- Update the message with the new ticket_id
    NEW.ticket_id := new_ticket_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create tickets from messages
DROP TRIGGER IF EXISTS auto_create_ticket_from_message ON channel_messages;
CREATE TRIGGER auto_create_ticket_from_message
  BEFORE INSERT ON channel_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_ticket_from_message();

-- Function to sync channel messages to ticket comments
CREATE OR REPLACE FUNCTION sync_message_to_comment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if ticket exists and not already a comment
  IF NEW.ticket_id IS NOT NULL AND NOT NEW.is_internal THEN
    INSERT INTO ticket_comments (
      ticket_id,
      author_id,
      body,
      is_internal
    ) VALUES (
      NEW.ticket_id,
      NEW.sender_id,
      NEW.message_body,
      false
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync messages to comments
DROP TRIGGER IF EXISTS sync_channel_message_to_comment ON channel_messages;
CREATE TRIGGER sync_channel_message_to_comment
  AFTER INSERT ON channel_messages
  FOR EACH ROW
  EXECUTE FUNCTION sync_message_to_comment();

-- Insert default support channels
INSERT INTO support_channels (channel_type, name, config, is_active, auto_create_ticket)
VALUES 
  ('email', 'Email Support', '{"address": "support@mympb.com"}', true, true),
  ('chat', 'Live Chat', '{"widget_enabled": true}', true, true),
  ('web', 'Web Forms', '{"forms_enabled": true}', true, true),
  ('phone', 'Phone Support', '{"number": "+1-800-MPB-HELP"}', false, false)
ON CONFLICT DO NOTHING;

-- Create view for active chat sessions with agent info
CREATE OR REPLACE VIEW active_chat_sessions AS
SELECT 
  cs.*,
  p.full_name as agent_name,
  p.email as agent_email,
  COUNT(cm.id) as message_count,
  MAX(cm.created_at) as last_message_at
FROM chat_sessions cs
LEFT JOIN profiles p ON p.id = cs.assigned_agent_id
LEFT JOIN channel_messages cm ON cm.metadata->>'session_id' = cs.id::text
WHERE cs.status IN ('waiting', 'active')
GROUP BY cs.id, p.full_name, p.email;

-- Create view for channel activity summary
CREATE OR REPLACE VIEW channel_activity_summary AS
SELECT 
  sc.id as channel_id,
  sc.channel_type,
  sc.name,
  COUNT(DISTINCT cm.id) as total_messages,
  COUNT(DISTINCT cm.ticket_id) as tickets_created,
  COUNT(DISTINCT CASE WHEN cm.created_at >= NOW() - INTERVAL '24 hours' THEN cm.id END) as messages_24h,
  MAX(cm.created_at) as last_activity
FROM support_channels sc
LEFT JOIN channel_messages cm ON cm.channel_id = sc.id
WHERE sc.is_active = true
GROUP BY sc.id, sc.channel_type, sc.name;
