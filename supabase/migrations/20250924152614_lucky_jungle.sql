/*
  # Championship IT Ticketing System Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `full_name` (text, optional)
      - `role` (text, check constraint: requester/agent/admin)
      - `created_at` (timestamp)
    - `tickets`
      - `id` (uuid, primary key)
      - `requester_id` (uuid, foreign key to profiles)
      - `assignee_id` (uuid, foreign key to profiles, optional)
      - `origin` (text, check constraint: member/advisor/staff)
      - `subject` (text, required)
      - `description` (text, required)
      - `status` (enum: new/open/pending/resolved/closed)
      - `priority` (enum: low/medium/high/urgent)
      - `category` (text, optional)
      - `subcategory` (text, optional)
      - `submitter_email` (text, optional)
      - `submitter_name` (text, optional)
      - `submitter_phone` (text, optional)
      - `member_id_optional` (text, optional)
      - `advisor_id_optional` (text, optional)
      - `platform` (text, optional)
      - `browser` (text, optional)
      - `app_version` (text, optional)
      - `attachments` (text array, optional)
      - `sla_due_at` (timestamp, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `ticket_comments`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to tickets)
      - `author_id` (uuid, foreign key to profiles)
      - `body` (text, required)
      - `is_internal` (boolean)
      - `created_at` (timestamp)
    - `ticket_attachments`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to tickets)
      - `filename` (text)
      - `url` (text)
      - `size_bytes` (integer, optional)
      - `created_at` (timestamp)
    - `kb_articles`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `body` (text, required)
      - `tags` (text array, optional)
      - `is_published` (boolean)
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each role
    - Users can read their own data
    - Agents/Admins have elevated permissions

  3. Indexes
    - Performance indexes on commonly queried fields
    - Foreign key indexes
    - Status and priority indexes for filtering

  4. Functions
    - Updated timestamp trigger function
*/

-- Create custom types
CREATE TYPE ticket_status AS ENUM ('new', 'open', 'pending', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  email text UNIQUE NOT NULL,
  full_name text,
  role text DEFAULT 'requester' CHECK (role IN ('requester', 'agent', 'admin')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT TO public
  USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  origin text NOT NULL CHECK (origin IN ('member', 'advisor', 'staff')),
  subject text NOT NULL,
  description text,
  status ticket_status DEFAULT 'new',
  priority ticket_priority DEFAULT 'medium',
  category text,
  subcategory text,
  submitter_email text,
  submitter_name text,
  submitter_phone text,
  member_id_optional text,
  advisor_id_optional text,
  platform text,
  browser text,
  app_version text,
  attachments text[],
  sla_due_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Tickets policies
CREATE POLICY "tickets_requester_insert" ON tickets
  FOR INSERT TO public
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "tickets_requester_read" ON tickets
  FOR SELECT TO public
  USING (
    requester_id = auth.uid() OR 
    assignee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

CREATE POLICY "tickets_agent_all" ON tickets
  FOR ALL TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_origin ON tickets(origin);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

-- Tickets updated_at trigger
CREATE TRIGGER set_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Ticket comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- Comments policies
CREATE POLICY "comments_ticket_access" ON ticket_comments
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM tickets t 
      WHERE t.id = ticket_comments.ticket_id AND (
        t.requester_id = auth.uid() OR 
        t.assignee_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
        )
      )
    )
  );

CREATE POLICY "comments_insert" ON ticket_comments
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets t 
      WHERE t.id = ticket_comments.ticket_id AND (
        t.requester_id = auth.uid() OR 
        t.assignee_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
        )
      )
    ) AND author_id = auth.uid()
  );

-- Comments index
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- Ticket attachments table
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  filename text NOT NULL,
  url text NOT NULL,
  size_bytes integer,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Attachments policies
CREATE POLICY "attachments_ticket_access" ON ticket_attachments
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM tickets t 
      WHERE t.id = ticket_attachments.ticket_id AND (
        t.requester_id = auth.uid() OR 
        t.assignee_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
        )
      )
    )
  );

CREATE POLICY "attachments_insert" ON ticket_attachments
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets t 
      WHERE t.id = ticket_attachments.ticket_id AND (
        t.requester_id = auth.uid() OR 
        t.assignee_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
        )
      )
    )
  );

-- Attachments index
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);

-- Knowledge base articles table
CREATE TABLE IF NOT EXISTS kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  tags text[],
  is_published boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

-- KB articles policies
CREATE POLICY "kb_public_read" ON kb_articles
  FOR SELECT TO public
  USING (is_published = true);

CREATE POLICY "kb_author_all" ON kb_articles
  FOR ALL TO public
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

-- KB articles indexes
CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON kb_articles(is_published);

-- KB articles updated_at trigger
CREATE TRIGGER set_kb_articles_updated_at
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();