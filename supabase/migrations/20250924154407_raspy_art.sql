/*
  # Champion Charlie Database Schema

  This migration sets up the complete database schema for Champion Charlie AI agent:
  
  1. Tables
    - profiles (user management)
    - tickets (support tickets with origin awareness)
    - ticket_comments (threaded comments)
    - agent_messages (AI conversation logs)
    - kb_docs (knowledge base with vector embeddings)
    - reminders (scheduled tasks)
    - audit_log (activity tracking)
    
  2. Extensions
    - Enable pgvector for embeddings
    
  3. Security
    - Row Level Security policies
    - Role-based access control
    
  4. Indexes
    - Performance indexes for common queries
    - Vector similarity index
*/

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Create custom types
DO $$ BEGIN
  CREATE TYPE ticket_origin AS ENUM ('member', 'advisor', 'staff');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  email text UNIQUE NOT NULL,
  full_name text,
  role user_role NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now()
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  origin ticket_origin NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  priority ticket_priority DEFAULT 'normal',
  status ticket_status DEFAULT 'open',
  requester_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  category text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Ticket comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_origin ON tickets(origin);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_user ON agent_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_ticket ON agent_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_reminders_run_at ON reminders(run_at);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- Vector similarity index (IVFFlat for better performance)
CREATE INDEX IF NOT EXISTS idx_kb_docs_embedding ON kb_docs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read/update own profile, agents/admins can read all
CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Tickets: Role-based access
CREATE POLICY "tickets_read" ON tickets
  FOR SELECT USING (
    -- Own tickets
    requester_id = auth.uid() OR
    assignee_id = auth.uid() OR
    -- Staff/agents/admins can see all
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('staff', 'agent', 'admin')
    )
  );

CREATE POLICY "tickets_create" ON tickets
  FOR INSERT WITH CHECK (
    requester_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('staff', 'agent', 'admin')
    )
  );

CREATE POLICY "tickets_update" ON tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

-- Comments: Can read/write comments on tickets you have access to
CREATE POLICY "comments_read" ON ticket_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id AND (
        t.requester_id = auth.uid() OR
        t.assignee_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() AND p.role IN ('staff', 'agent', 'admin')
        )
      )
    )
  );

CREATE POLICY "comments_create" ON ticket_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id AND (
        t.requester_id = auth.uid() OR
        t.assignee_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() AND p.role IN ('staff', 'agent', 'admin')
        )
      )
    )
  );

-- Agent messages: Only accessible to agents/admins
CREATE POLICY "agent_messages_agent_only" ON agent_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

-- KB docs: Read-only for all authenticated users
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

-- Audit log: Read-only for admins
CREATE POLICY "audit_log_admin_read" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "audit_log_system_insert" ON audit_log
  FOR INSERT WITH CHECK (true);