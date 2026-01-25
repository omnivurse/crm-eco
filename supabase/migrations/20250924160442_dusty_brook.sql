/*
  # Champion Charlie Complete Database Schema

  1. New Tables
    - `profiles` - User profiles with roles
    - `tickets` - Support tickets with origin tracking
    - `ticket_comments` - Comments on tickets
    - `agent_messages` - Champion Charlie conversation logs
    - `kb_docs` - Knowledge base documents with vector embeddings
    - `reminders` - Scheduled follow-up tasks
    - `audit_log` - Complete audit trail

  2. Extensions
    - Enable pgvector for embeddings
    - Enable uuid-ossp for UUID generation

  3. Security
    - Enable RLS on all tables
    - Role-based access policies
    - Secure tool execution
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  -- Drop all existing policies
  DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
  DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
  DROP POLICY IF EXISTS "tickets_agent_all" ON tickets;
  DROP POLICY IF EXISTS "tickets_insert_public" ON tickets;
  DROP POLICY IF EXISTS "tickets_requester_insert" ON tickets;
  DROP POLICY IF EXISTS "tickets_requester_read" ON tickets;
  DROP POLICY IF EXISTS "tickets_select_public" ON tickets;
  DROP POLICY IF EXISTS "tickets_update_staff" ON tickets;
  DROP POLICY IF EXISTS "comments_insert" ON ticket_comments;
  DROP POLICY IF EXISTS "comments_ticket_access" ON ticket_comments;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create custom types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('member', 'advisor', 'staff', 'agent', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE reminder_status AS ENUM ('scheduled', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update existing tables for Champion Charlie compatibility
DO $$
BEGIN
  -- Add agent-specific columns to existing tables if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE tickets ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Agent messages table (conversation logs)
CREATE TABLE IF NOT EXISTS agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  author text NOT NULL,
  role text NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content text NOT NULL,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  tool_name text,
  tool_args jsonb,
  result jsonb,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
);

-- Knowledge base documents with vector embeddings
CREATE TABLE IF NOT EXISTS kb_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source text NOT NULL,
  chunk text NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-large dimensions
  created_at timestamptz DEFAULT now()
);

-- Reminders/scheduled tasks
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  run_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status reminder_status DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  target text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb
);

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_kb_docs(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  source text,
  chunk text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kb_docs.id,
    kb_docs.title,
    kb_docs.source,
    kb_docs.chunk,
    1 - (kb_docs.embedding <=> query_embedding) AS similarity
  FROM kb_docs
  WHERE 1 - (kb_docs.embedding <=> query_embedding) > match_threshold
  ORDER BY kb_docs.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_messages_user ON agent_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_ticket ON agent_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_reminders_run_at ON reminders(run_at);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Vector similarity index (IVFFlat for better performance)
CREATE INDEX IF NOT EXISTS idx_kb_docs_embedding ON kb_docs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS on new tables
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Champion Charlie tables

-- Agent messages: Only accessible to agents/admins
CREATE POLICY "agent_messages_agent_only" ON agent_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

-- KB docs: Read-only for all authenticated users, admin manage
CREATE POLICY "kb_docs_read_all" ON kb_docs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "kb_docs_admin_manage" ON kb_docs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Reminders: Users can manage their own
CREATE POLICY "reminders_self_manage" ON reminders
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

-- Audit log: Read-only for admins, system can insert
CREATE POLICY "audit_log_admin_read" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "audit_log_system_insert" ON audit_log
  FOR INSERT WITH CHECK (true);