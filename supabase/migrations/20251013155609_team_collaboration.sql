/*
  # Team Collaboration System
  
  REORDERED: Create all tables first, then add policies to avoid forward references.
*/

-- ============================================================================
-- 1. CREATE ALL TABLES FIRST (before policies)
-- ============================================================================

-- Chat Channels Table
CREATE TABLE IF NOT EXISTS chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'private', 'direct')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'system', 'file')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Channel Members Table
CREATE TABLE IF NOT EXISTS channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  last_read_at timestamptz DEFAULT now(),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);

ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- Message Reactions Table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. CREATE ALL POLICIES (after all tables exist)
-- ============================================================================

-- Chat Channels Policies
DROP POLICY IF EXISTS "Users can view channels they are members of" ON chat_channels;
CREATE POLICY "Users can view channels they are members of"
  ON chat_channels FOR SELECT
  TO authenticated
  USING (
    type = 'public' OR
    id IN (
      SELECT channel_id FROM channel_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create channels" ON chat_channels;
CREATE POLICY "Authenticated users can create channels"
  ON chat_channels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Channel creators can update their channels" ON chat_channels;
CREATE POLICY "Channel creators can update their channels"
  ON chat_channels FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Chat Messages Policies
DROP POLICY IF EXISTS "Users can view messages in their channels" ON chat_messages;
CREATE POLICY "Users can view messages in their channels"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    channel_id IN (
      SELECT id FROM chat_channels WHERE type = 'public'
      UNION
      SELECT channel_id FROM channel_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their channels" ON chat_messages;
CREATE POLICY "Users can send messages to their channels"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND
    channel_id IN (
      SELECT id FROM chat_channels WHERE type = 'public'
      UNION
      SELECT channel_id FROM channel_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;
CREATE POLICY "Users can update their own messages"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;
CREATE POLICY "Users can delete their own messages"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- Channel Members Policies
DROP POLICY IF EXISTS "Users can view members of their channels" ON channel_members;
CREATE POLICY "Users can view members of their channels"
  ON channel_members FOR SELECT
  TO authenticated
  USING (
    channel_id IN (
      SELECT id FROM chat_channels WHERE type = 'public'
      UNION
      SELECT cm.channel_id FROM channel_members cm WHERE cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Channel owners can add members" ON channel_members;
CREATE POLICY "Channel owners can add members"
  ON channel_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
    ) OR NOT EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = channel_members.channel_id) -- Allow first member
  );

DROP POLICY IF EXISTS "Users can leave channels" ON channel_members;
CREATE POLICY "Users can leave channels"
  ON channel_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Message Reactions Policies
DROP POLICY IF EXISTS "Users can view reactions in their channels" ON message_reactions;
CREATE POLICY "Users can view reactions in their channels"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    message_id IN (
      SELECT id FROM chat_messages WHERE channel_id IN (
        SELECT id FROM chat_channels WHERE type = 'public'
        UNION
        SELECT channel_id FROM channel_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
CREATE POLICY "Users can add reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their reactions" ON message_reactions;
CREATE POLICY "Users can remove their reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create default channels
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM chat_channels WHERE name = 'general') THEN
    INSERT INTO chat_channels (name, description, type)
    VALUES
      ('general', 'General team discussion', 'public'),
      ('it-support', 'IT Support team channel', 'public'),
      ('urgent-issues', 'High priority and urgent matters', 'public'),
      ('announcements', 'Important team announcements', 'public');
  END IF;
END $$;
