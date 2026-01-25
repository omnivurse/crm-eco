/*
  # Championship IT Database Schema

  This migration creates the complete database schema for the Championship IT ticketing system.

  ## 1. New Tables
  - `profiles` - User accounts and roles
    - `id` (uuid, primary key)
    - `email` (text, unique)
    - `full_name` (text)
    - `role` (enum: requester, agent, admin)
    - `created_at` (timestamptz)
  
  - `tickets` - Support tickets
    - `id` (uuid, primary key)
    - `requester_id` (uuid, references profiles)
    - `assignee_id` (uuid, references profiles)
    - `subject` (text, required)
    - `description` (text)
    - `status` (enum: new, open, pending, resolved, closed)
    - `priority` (enum: low, medium, high, urgent)
    - `category` (text)
    - `sla_due_at` (timestamptz)
    - `created_at`, `updated_at` (timestamptz)
  
  - `ticket_comments` - Comments on tickets
    - `id` (uuid, primary key)
    - `ticket_id` (uuid, references tickets)
    - `author_id` (uuid, references profiles)
    - `body` (text, required)
    - `is_internal` (boolean)
    - `created_at` (timestamptz)
  
  - `ticket_attachments` - File attachments on tickets
    - `id` (uuid, primary key)
    - `ticket_id` (uuid, references tickets)
    - `filename` (text, required)
    - `url` (text, required)
    - `size_bytes` (int)
    - `created_at` (timestamptz)
  
  - `kb_articles` - Knowledge base articles
    - `id` (uuid, primary key)
    - `title` (text, required)
    - `body` (text, required)
    - `tags` (text array)
    - `is_published` (boolean)
    - `created_by` (uuid, references profiles)
    - `created_at`, `updated_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Add policies for role-based access control
  - Profiles: users can read their own + agents/admins can read all
  - Tickets: requesters see own, agents/admins see all
  - Comments/Attachments: follow ticket access rules
  - KB Articles: public read, admin/agent write

  ## 3. Indexes
  - Performance indexes on commonly queried fields
  - Status, assignee, requester for tickets
  - Ticket relationships for comments/attachments
*/

-- Create custom types
CREATE TYPE ticket_status AS ENUM ('new', 'open', 'pending', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  email text UNIQUE NOT NULL,
  full_name text,
  role text CHECK (role IN ('requester', 'agent', 'admin')) DEFAULT 'requester',
  created_at timestamptz DEFAULT now()
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text,
  status ticket_status DEFAULT 'new',
  priority ticket_priority DEFAULT 'medium',
  category text,
  sla_due_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ticket comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Ticket attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  filename text NOT NULL,
  url text NOT NULL,
  size_bytes int,
  created_at timestamptz DEFAULT now()
);

-- Knowledge base articles
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON kb_articles(is_published);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read their own profile, agents/admins can read all
CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT 
  USING (
    auth.uid() = id 
    OR EXISTS(
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('agent', 'admin')
    )
  );

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Tickets: Requesters see own, agents/admins see all
CREATE POLICY "tickets_requester_read" ON tickets
  FOR SELECT 
  USING (
    requester_id = auth.uid()
    OR assignee_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('agent', 'admin')
    )
  );

CREATE POLICY "tickets_requester_insert" ON tickets
  FOR INSERT 
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "tickets_agent_all" ON tickets
  FOR ALL
  USING (
    EXISTS(
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('agent', 'admin')
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('agent', 'admin')
    )
  );

-- Ticket comments: Follow ticket access rules
CREATE POLICY "comments_ticket_access" ON ticket_comments
  FOR SELECT 
  USING (
    EXISTS(
      SELECT 1 FROM tickets t 
      WHERE t.id = ticket_id 
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS(
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() 
          AND p.role IN ('agent', 'admin')
        )
      )
    )
  );

CREATE POLICY "comments_insert" ON ticket_comments
  FOR INSERT 
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM tickets t 
      WHERE t.id = ticket_id 
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS(
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() 
          AND p.role IN ('agent', 'admin')
        )
      )
    )
    AND author_id = auth.uid()
  );

-- Ticket attachments: Follow ticket access rules
CREATE POLICY "attachments_ticket_access" ON ticket_attachments
  FOR SELECT 
  USING (
    EXISTS(
      SELECT 1 FROM tickets t 
      WHERE t.id = ticket_id 
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS(
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() 
          AND p.role IN ('agent', 'admin')
        )
      )
    )
  );

CREATE POLICY "attachments_insert" ON ticket_attachments
  FOR INSERT 
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM tickets t 
      WHERE t.id = ticket_id 
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS(
          SELECT 1 FROM profiles p 
          WHERE p.id = auth.uid() 
          AND p.role IN ('agent', 'admin')
        )
      )
    )
  );

-- KB Articles: Public read, admin/agent write
CREATE POLICY "kb_public_read" ON kb_articles
  FOR SELECT 
  USING (is_published = true);

CREATE POLICY "kb_author_all" ON kb_articles
  FOR ALL
  USING (
    created_by = auth.uid()
    OR EXISTS(
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('agent', 'admin')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS(
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('agent', 'admin')
    )
  );

-- Function to automatically set updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS set_tickets_updated_at ON tickets;
CREATE TRIGGER set_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_kb_articles_updated_at ON kb_articles;
CREATE TRIGGER set_kb_articles_updated_at
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();