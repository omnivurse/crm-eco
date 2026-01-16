-- ============================================================================
-- PHASE W12: UNIFIED INBOX V2 (OMNICHANNEL)
-- Replace mock inbox with real omnichannel data from all sources
-- ============================================================================

-- ============================================================================
-- EXTEND COMMUNICATIONS TABLE
-- Add inbox-specific fields for unified message handling
-- ============================================================================

-- Add inbox-related columns to communications table if it exists
DO $$ 
BEGIN
  -- Add assigned_to column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'communications' AND column_name = 'assigned_to') THEN
    ALTER TABLE communications ADD COLUMN assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  -- Add inbox_status column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'communications' AND column_name = 'inbox_status') THEN
    ALTER TABLE communications ADD COLUMN inbox_status text DEFAULT 'open';
  END IF;

  -- Add unread_count column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'communications' AND column_name = 'unread_count') THEN
    ALTER TABLE communications ADD COLUMN unread_count int DEFAULT 1;
  END IF;

  -- Add last_read_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'communications' AND column_name = 'last_read_at') THEN
    ALTER TABLE communications ADD COLUMN last_read_at timestamptz;
  END IF;

  -- Add thread_id column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'communications' AND column_name = 'thread_id') THEN
    ALTER TABLE communications ADD COLUMN thread_id text;
  END IF;

  -- Add channel_metadata column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'communications' AND column_name = 'channel_metadata') THEN
    ALTER TABLE communications ADD COLUMN channel_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add priority column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'communications' AND column_name = 'priority') THEN
    ALTER TABLE communications ADD COLUMN priority text DEFAULT 'normal';
  END IF;

  -- Add tags column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'communications' AND column_name = 'tags') THEN
    ALTER TABLE communications ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
END $$;

-- Create indexes for inbox queries
CREATE INDEX IF NOT EXISTS idx_communications_assigned_to ON communications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_communications_inbox_status ON communications(inbox_status);
CREATE INDEX IF NOT EXISTS idx_communications_thread_id ON communications(thread_id);
CREATE INDEX IF NOT EXISTS idx_communications_unread ON communications(organization_id, inbox_status, unread_count) 
  WHERE unread_count > 0;

COMMENT ON COLUMN communications.assigned_to IS 'User assigned to handle this communication';
COMMENT ON COLUMN communications.inbox_status IS 'Status: open, pending, resolved, archived';
COMMENT ON COLUMN communications.unread_count IS 'Number of unread messages in thread';
COMMENT ON COLUMN communications.thread_id IS 'Grouping ID for conversation threads';
COMMENT ON COLUMN communications.channel_metadata IS 'Channel-specific metadata (external IDs, etc)';

-- ============================================================================
-- INBOX CONVERSATIONS TABLE
-- Unified view of conversations across all channels
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbox_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Channel info
  channel text NOT NULL,
  -- Channels: email, sms, whatsapp, phone, video, chat, social, support
  
  -- Thread identification
  thread_id text NOT NULL,
  subject text,
  preview text,
  
  -- Participants
  contact_id uuid REFERENCES crm_records(id) ON DELETE SET NULL,
  contact_email text,
  contact_phone text,
  contact_name text,
  
  -- Entity links
  linked_lead_id uuid,
  linked_deal_id uuid,
  linked_account_id uuid,
  
  -- Status
  status text NOT NULL DEFAULT 'open',
  -- Status: open, pending, snoozed, resolved, archived
  
  priority text DEFAULT 'normal',
  -- Priority: low, normal, high, urgent
  
  -- Assignment
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  
  -- Read tracking
  unread_count int DEFAULT 1,
  last_read_at timestamptz,
  last_read_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Message counts
  message_count int DEFAULT 1,
  
  -- Timestamps
  last_message_at timestamptz NOT NULL DEFAULT now(),
  first_message_at timestamptz NOT NULL DEFAULT now(),
  snoozed_until timestamptz,
  resolved_at timestamptz,
  
  -- Tags and labels
  tags text[] DEFAULT '{}',
  labels jsonb DEFAULT '[]'::jsonb,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(org_id, channel, thread_id)
);

CREATE INDEX idx_inbox_conversations_org ON inbox_conversations(org_id);
CREATE INDEX idx_inbox_conversations_status ON inbox_conversations(status);
CREATE INDEX idx_inbox_conversations_assigned ON inbox_conversations(assigned_to);
CREATE INDEX idx_inbox_conversations_channel ON inbox_conversations(channel);
CREATE INDEX idx_inbox_conversations_contact ON inbox_conversations(contact_id);
CREATE INDEX idx_inbox_conversations_unread ON inbox_conversations(org_id, status, unread_count DESC) 
  WHERE status IN ('open', 'pending');
CREATE INDEX idx_inbox_conversations_last_message ON inbox_conversations(org_id, last_message_at DESC);

COMMENT ON TABLE inbox_conversations IS 'Unified conversations across all communication channels';

-- ============================================================================
-- INBOX MESSAGES TABLE
-- Individual messages within conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
  
  -- Message content
  channel text NOT NULL,
  direction text NOT NULL,
  -- Direction: inbound, outbound
  
  -- Sender/Recipient
  from_address text,
  from_name text,
  to_address text,
  to_name text,
  
  -- Content
  subject text,
  body_text text,
  body_html text,
  
  -- Attachments
  attachments jsonb DEFAULT '[]'::jsonb,
  
  -- External reference
  external_id text,
  external_provider text,
  
  -- Status
  status text DEFAULT 'delivered',
  -- Status: pending, sent, delivered, read, failed, bounced
  
  -- Tracking
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inbox_messages_org ON inbox_messages(org_id);
CREATE INDEX idx_inbox_messages_conversation ON inbox_messages(conversation_id);
CREATE INDEX idx_inbox_messages_sent ON inbox_messages(sent_at DESC);
CREATE INDEX idx_inbox_messages_external ON inbox_messages(org_id, external_provider, external_id);

COMMENT ON TABLE inbox_messages IS 'Individual messages within inbox conversations';

-- ============================================================================
-- INBOX ASSIGNMENTS TABLE
-- Track assignment history
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbox_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
  
  -- Assignment details
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_from uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Reason
  reason text,
  -- Reasons: manual, auto_route, round_robin, skill_based, load_balance
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inbox_assignments_org ON inbox_assignments(org_id);
CREATE INDEX idx_inbox_assignments_conversation ON inbox_assignments(conversation_id);
CREATE INDEX idx_inbox_assignments_assigned ON inbox_assignments(assigned_to);
CREATE INDEX idx_inbox_assignments_created ON inbox_assignments(created_at DESC);

COMMENT ON TABLE inbox_assignments IS 'Assignment history for inbox conversations';

-- ============================================================================
-- INBOX QUICK ACTIONS LOG
-- Track quick actions taken from inbox
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbox_quick_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
  
  -- Action details
  action_type text NOT NULL,
  -- Actions: convert_lead, create_contact, create_task, add_note, change_deal_stage, 
  --          merge_contact, link_record, send_template, snooze, resolve, archive
  
  action_data jsonb NOT NULL,
  
  -- Result
  result_type text,
  result_id uuid,
  
  -- Who
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inbox_quick_actions_org ON inbox_quick_actions_log(org_id);
CREATE INDEX idx_inbox_quick_actions_conversation ON inbox_quick_actions_log(conversation_id);
CREATE INDEX idx_inbox_quick_actions_type ON inbox_quick_actions_log(action_type);
CREATE INDEX idx_inbox_quick_actions_created ON inbox_quick_actions_log(created_at DESC);

COMMENT ON TABLE inbox_quick_actions_log IS 'Log of quick actions performed from the inbox';

-- ============================================================================
-- INBOX VIEWS/FILTERS TABLE
-- Saved inbox views and filters
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbox_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- View details
  name text NOT NULL,
  description text,
  
  -- Filters
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- { channel: [], status: [], assigned_to: [], tags: [], priority: [] }
  
  -- Sort
  sort_by text DEFAULT 'last_message_at',
  sort_direction text DEFAULT 'desc',
  
  -- Visibility
  is_default boolean DEFAULT false,
  is_shared boolean DEFAULT false,
  
  -- Owner
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inbox_views_org ON inbox_views(org_id);
CREATE INDEX idx_inbox_views_created_by ON inbox_views(created_by);

COMMENT ON TABLE inbox_views IS 'Saved inbox views and filter configurations';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_quick_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_views ENABLE ROW LEVEL SECURITY;

-- Inbox Conversations Policies
CREATE POLICY "Users can view inbox conversations for their org"
  ON inbox_conversations FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Users can manage inbox conversations for their org"
  ON inbox_conversations FOR ALL
  USING (org_id = get_user_organization_id());

-- Inbox Messages Policies
CREATE POLICY "Users can view inbox messages for their org"
  ON inbox_messages FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Users can manage inbox messages for their org"
  ON inbox_messages FOR ALL
  USING (org_id = get_user_organization_id());

-- Inbox Assignments Policies
CREATE POLICY "Users can view assignments for their org"
  ON inbox_assignments FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Users can create assignments for their org"
  ON inbox_assignments FOR INSERT
  WITH CHECK (org_id = get_user_organization_id());

-- Quick Actions Policies
CREATE POLICY "Users can view quick actions for their org"
  ON inbox_quick_actions_log FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Users can create quick actions for their org"
  ON inbox_quick_actions_log FOR INSERT
  WITH CHECK (org_id = get_user_organization_id());

-- Inbox Views Policies
CREATE POLICY "Users can view inbox views for their org"
  ON inbox_views FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Users can manage their own inbox views"
  ON inbox_views FOR ALL
  USING (
    org_id = get_user_organization_id()
    AND (created_by = get_user_profile_id() OR is_shared = true)
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE TRIGGER update_inbox_conversations_updated_at
  BEFORE UPDATE ON inbox_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inbox_views_updated_at
  BEFORE UPDATE ON inbox_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get inbox statistics
CREATE OR REPLACE FUNCTION get_inbox_stats(p_org_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  total_open int,
  total_pending int,
  total_unread int,
  assigned_to_me int,
  unassigned int
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'open')::int as total_open,
    COUNT(*) FILTER (WHERE status = 'pending')::int as total_pending,
    COUNT(*) FILTER (WHERE unread_count > 0 AND status IN ('open', 'pending'))::int as total_unread,
    COUNT(*) FILTER (WHERE assigned_to = p_user_id)::int as assigned_to_me,
    COUNT(*) FILTER (WHERE assigned_to IS NULL AND status IN ('open', 'pending'))::int as unassigned
  FROM inbox_conversations
  WHERE org_id = p_org_id
    AND status NOT IN ('archived');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inbox_conversations
  SET 
    last_message_at = NEW.sent_at,
    message_count = message_count + 1,
    unread_count = CASE 
      WHEN NEW.direction = 'inbound' THEN unread_count + 1 
      ELSE unread_count 
    END,
    preview = LEFT(COALESCE(NEW.body_text, NEW.subject, ''), 200),
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON inbox_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Function to log assignment change
CREATE OR REPLACE FUNCTION log_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO inbox_assignments (
      org_id, conversation_id, assigned_to, assigned_from, reason
    ) VALUES (
      NEW.org_id, NEW.id, NEW.assigned_to, OLD.assigned_to, 'manual'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_assignment_change
  AFTER UPDATE OF assigned_to ON inbox_conversations
  FOR EACH ROW EXECUTE FUNCTION log_assignment_change();
