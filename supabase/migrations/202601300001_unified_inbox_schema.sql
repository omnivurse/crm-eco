-- ============================================================================
-- UNIFIED INBOX SCHEMA
-- Multi-channel conversation and message management
-- ============================================================================

-- Conversations table
CREATE TABLE IF NOT EXISTS inbox_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Channel info
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone', 'video', 'chat', 'social', 'support')),
  thread_id TEXT NOT NULL, -- External thread ID from provider

  -- Content preview
  subject TEXT,
  preview TEXT,

  -- Contact info (denormalized for quick access)
  contact_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
  contact_email TEXT,
  contact_phone TEXT,
  contact_name TEXT,

  -- Entity links
  linked_lead_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
  linked_deal_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
  linked_account_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,

  -- Status and priority
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'snoozed', 'resolved', 'archived')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Assignment
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  -- Read tracking
  unread_count INTEGER NOT NULL DEFAULT 1,
  last_read_at TIMESTAMPTZ,
  last_read_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Message counts
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Snooze/resolve
  snoozed_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Metadata
  tags TEXT[] NOT NULL DEFAULT '{}',
  labels JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint per org/thread
  UNIQUE(org_id, channel, thread_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,

  -- Channel and direction
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone', 'video', 'chat', 'social', 'support')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Addresses
  from_address TEXT,
  from_name TEXT,
  to_address TEXT,
  to_name TEXT,

  -- Content
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB NOT NULL DEFAULT '[]',

  -- External reference
  external_id TEXT,
  external_provider TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}',

  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assignment history
CREATE TABLE IF NOT EXISTS inbox_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,

  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_from UUID REFERENCES profiles(id) ON DELETE SET NULL,

  reason TEXT CHECK (reason IN ('manual', 'auto_route', 'round_robin', 'skill_based', 'load_balance')),
  metadata JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quick actions log
CREATE TABLE IF NOT EXISTS inbox_quick_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,

  action_type TEXT NOT NULL CHECK (action_type IN (
    'convert_lead', 'create_contact', 'create_task', 'add_note',
    'change_deal_stage', 'merge_contact', 'link_record', 'send_template',
    'snooze', 'resolve', 'archive'
  )),
  action_data JSONB NOT NULL DEFAULT '{}',

  result_type TEXT,
  result_id TEXT,

  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved views
CREATE TABLE IF NOT EXISTS inbox_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  filters JSONB NOT NULL DEFAULT '{}',
  sort_by TEXT NOT NULL DEFAULT 'last_message_at',
  sort_direction TEXT NOT NULL DEFAULT 'desc' CHECK (sort_direction IN ('asc', 'desc')),

  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inbox_conversations_org ON inbox_conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_status ON inbox_conversations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_channel ON inbox_conversations(org_id, channel);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_assigned ON inbox_conversations(org_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_last_message ON inbox_conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_contact ON inbox_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_thread ON inbox_conversations(org_id, channel, thread_id);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation ON inbox_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_sent ON inbox_messages(conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_external ON inbox_messages(external_provider, external_id);

CREATE INDEX IF NOT EXISTS idx_inbox_assignments_conversation ON inbox_assignments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_inbox_quick_actions_conversation ON inbox_quick_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_inbox_views_org ON inbox_views(org_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update conversation stats on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inbox_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.sent_at,
    preview = LEFT(COALESCE(NEW.body_text, NEW.subject, ''), 200),
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON inbox_messages;
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON inbox_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- Log assignment changes
CREATE OR REPLACE FUNCTION log_conversation_assignment()
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

DROP TRIGGER IF EXISTS trg_log_conversation_assignment ON inbox_conversations;
CREATE TRIGGER trg_log_conversation_assignment
  AFTER UPDATE OF assigned_to ON inbox_conversations
  FOR EACH ROW
  EXECUTE FUNCTION log_conversation_assignment();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_quick_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_views ENABLE ROW LEVEL SECURITY;

-- Conversations policies
DROP POLICY IF EXISTS inbox_conversations_org_access ON inbox_conversations;
CREATE POLICY inbox_conversations_org_access ON inbox_conversations
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Messages policies
DROP POLICY IF EXISTS inbox_messages_org_access ON inbox_messages;
CREATE POLICY inbox_messages_org_access ON inbox_messages
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Assignments policies
DROP POLICY IF EXISTS inbox_assignments_org_access ON inbox_assignments;
CREATE POLICY inbox_assignments_org_access ON inbox_assignments
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Quick actions policies
DROP POLICY IF EXISTS inbox_quick_actions_org_access ON inbox_quick_actions;
CREATE POLICY inbox_quick_actions_org_access ON inbox_quick_actions
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Views policies (user can see shared views or their own)
DROP POLICY IF EXISTS inbox_views_org_access ON inbox_views;
CREATE POLICY inbox_views_org_access ON inbox_views
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
    AND (is_shared = TRUE OR created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );
