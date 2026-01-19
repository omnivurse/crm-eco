-- ============================================================================
-- REPAIR MIGRATION: Ensure inbox and email signature tables exist
-- This migration repairs any issues from previous migrations
-- ============================================================================

-- ============================================================================
-- PART 1: INBOX CONVERSATIONS (repair)
-- ============================================================================

-- Drop and recreate if table exists but is broken
DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inbox_conversations'
  ) THEN
    -- Create conversations table
    CREATE TABLE inbox_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone', 'video', 'chat', 'social', 'support')),
      thread_id TEXT NOT NULL,
      subject TEXT,
      preview TEXT,
      contact_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
      contact_email TEXT,
      contact_phone TEXT,
      contact_name TEXT,
      linked_lead_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
      linked_deal_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
      linked_account_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'snoozed', 'resolved', 'archived')),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
      assigned_at TIMESTAMPTZ,
      unread_count INTEGER NOT NULL DEFAULT 1,
      last_read_at TIMESTAMPTZ,
      last_read_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      first_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      snoozed_until TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      tags TEXT[] NOT NULL DEFAULT '{}',
      labels JSONB NOT NULL DEFAULT '[]',
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(org_id, channel, thread_id)
    );

    -- Create indexes
    CREATE INDEX idx_inbox_conversations_org ON inbox_conversations(org_id);
    CREATE INDEX idx_inbox_conversations_status ON inbox_conversations(org_id, status);
    CREATE INDEX idx_inbox_conversations_channel ON inbox_conversations(org_id, channel);
    CREATE INDEX idx_inbox_conversations_assigned ON inbox_conversations(org_id, assigned_to);
    CREATE INDEX idx_inbox_conversations_last_message ON inbox_conversations(org_id, last_message_at DESC);

    -- Enable RLS
    ALTER TABLE inbox_conversations ENABLE ROW LEVEL SECURITY;

    -- Create policy
    CREATE POLICY inbox_conversations_org_access ON inbox_conversations
      FOR ALL USING (
        org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
      );

    RAISE NOTICE 'Created inbox_conversations table';
  ELSE
    RAISE NOTICE 'inbox_conversations table already exists';
  END IF;
END $$;

-- ============================================================================
-- PART 2: INBOX MESSAGES (repair)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inbox_messages'
  ) THEN
    CREATE TABLE inbox_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone', 'video', 'chat', 'social', 'support')),
      direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
      from_address TEXT,
      from_name TEXT,
      to_address TEXT,
      to_name TEXT,
      subject TEXT,
      body_text TEXT,
      body_html TEXT,
      attachments JSONB NOT NULL DEFAULT '[]',
      external_id TEXT,
      external_provider TEXT,
      status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')),
      opened_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ,
      replied_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}',
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_inbox_messages_conversation ON inbox_messages(conversation_id);
    CREATE INDEX idx_inbox_messages_sent ON inbox_messages(conversation_id, sent_at);

    ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

    CREATE POLICY inbox_messages_org_access ON inbox_messages
      FOR ALL USING (
        org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
      );

    RAISE NOTICE 'Created inbox_messages table';
  ELSE
    RAISE NOTICE 'inbox_messages table already exists';
  END IF;
END $$;

-- ============================================================================
-- PART 3: EMAIL SIGNATURES (repair)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'email_signatures'
  ) THEN
    CREATE TABLE email_signatures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Default',
      content_html TEXT NOT NULL,
      content_text TEXT,
      logo_url TEXT,
      photo_url TEXT,
      social_links JSONB NOT NULL DEFAULT '{}',
      is_default BOOLEAN DEFAULT false,
      include_in_replies BOOLEAN DEFAULT true,
      include_in_new BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(profile_id, name)
    );

    CREATE INDEX idx_email_signatures_profile ON email_signatures(profile_id);
    CREATE INDEX idx_email_signatures_org ON email_signatures(org_id);

    ALTER TABLE email_signatures ENABLE ROW LEVEL SECURITY;

    CREATE POLICY email_signatures_select ON email_signatures
      FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

    CREATE POLICY email_signatures_all ON email_signatures
      FOR ALL TO authenticated
      USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

    RAISE NOTICE 'Created email_signatures table';
  ELSE
    -- Ensure columns exist (add missing columns from enhancement)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'email_signatures' AND column_name = 'logo_url'
    ) THEN
      ALTER TABLE email_signatures ADD COLUMN logo_url TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'email_signatures' AND column_name = 'photo_url'
    ) THEN
      ALTER TABLE email_signatures ADD COLUMN photo_url TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'email_signatures' AND column_name = 'social_links'
    ) THEN
      ALTER TABLE email_signatures ADD COLUMN social_links JSONB NOT NULL DEFAULT '{}';
    END IF;

    RAISE NOTICE 'email_signatures table already exists, columns verified';
  END IF;
END $$;

-- ============================================================================
-- PART 4: Ensure RLS policies are correct
-- ============================================================================

-- Fix inbox_conversations RLS if needed
DO $$
BEGIN
  -- Drop and recreate policy to ensure it's correct
  DROP POLICY IF EXISTS inbox_conversations_org_access ON inbox_conversations;
  CREATE POLICY inbox_conversations_org_access ON inbox_conversations
    FOR ALL TO authenticated
    USING (
      org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'inbox_conversations table does not exist, skipping policy';
END $$;

-- Fix email_signatures RLS if needed
DO $$
BEGIN
  DROP POLICY IF EXISTS email_signatures_select ON email_signatures;
  DROP POLICY IF EXISTS email_signatures_all ON email_signatures;
  DROP POLICY IF EXISTS "Users can view signatures in their org" ON email_signatures;
  DROP POLICY IF EXISTS "Users can manage own signatures" ON email_signatures;

  CREATE POLICY email_signatures_org_view ON email_signatures
    FOR SELECT TO authenticated
    USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

  CREATE POLICY email_signatures_user_manage ON email_signatures
    FOR ALL TO authenticated
    USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'email_signatures table does not exist, skipping policy';
END $$;

-- ============================================================================
-- DONE
-- ============================================================================
