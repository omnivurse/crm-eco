/*
  # Multi-Portal Ticket System Schema Updates

  ## Overview
  This migration extends the existing ticket system to support multiple portal types:
  member, concierge, advisor, and staff portals with role-specific fields and categories.

  ## 1. Enum Updates
    - Add 'concierge' to ticket_origin enum
    - Add 'concierge' to user_role enum if not exists

  ## 2. Tickets Table Updates
    - Add `member_id` field for member identification (optional)
    - Add `advisor_id` field for advisor identification (optional)
    - Add `subcategory` field for detailed categorization
    - Add `submitter_email` for non-authenticated submissions
    - Add `submitter_name` for non-authenticated submissions
    - Add `submitter_phone` for contact information
    - Add `urls` array field for relevant URLs
    - Add `platform` field for technical details
    - Add `browser` field for technical details
    - Add `app_version` field for technical details
    - Add `submitted_by_concierge` to track concierge submissions

  ## 3. New Tables
    - `ticket_files` - Enhanced file attachment handling
      - Supports both authenticated and anonymous uploads
      - Links to tickets with cascade delete
      - Stores file metadata for proper handling

  ## 4. Security Updates
    - Update RLS policies to allow anonymous ticket creation
    - Add policies for concierge role access
    - Ensure ticket files follow ticket access patterns

  ## 5. Indexes
    - Add indexes on new fields for optimal query performance
*/

-- Add concierge to ticket_origin enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ticket_origin' AND e.enumlabel = 'concierge'
  ) THEN
    ALTER TYPE ticket_origin ADD VALUE 'concierge';
  END IF;
END $$;

-- Add concierge to user_role enum if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'concierge'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'concierge';
    END IF;
  END IF;
END $$;

-- Add new columns to tickets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN member_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'advisor_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN advisor_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'subcategory'
  ) THEN
    ALTER TABLE tickets ADD COLUMN subcategory text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'submitter_email'
  ) THEN
    ALTER TABLE tickets ADD COLUMN submitter_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'submitter_name'
  ) THEN
    ALTER TABLE tickets ADD COLUMN submitter_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'submitter_phone'
  ) THEN
    ALTER TABLE tickets ADD COLUMN submitter_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'urls'
  ) THEN
    ALTER TABLE tickets ADD COLUMN urls text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'platform'
  ) THEN
    ALTER TABLE tickets ADD COLUMN platform text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'browser'
  ) THEN
    ALTER TABLE tickets ADD COLUMN browser text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'app_version'
  ) THEN
    ALTER TABLE tickets ADD COLUMN app_version text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'submitted_by_concierge'
  ) THEN
    ALTER TABLE tickets ADD COLUMN submitted_by_concierge uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create ticket_files table
CREATE TABLE IF NOT EXISTS ticket_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_member_id ON tickets(member_id);
CREATE INDEX IF NOT EXISTS idx_tickets_advisor_id ON tickets(advisor_id);
CREATE INDEX IF NOT EXISTS idx_tickets_submitter_email ON tickets(submitter_email);
CREATE INDEX IF NOT EXISTS idx_ticket_files_ticket_id ON ticket_files(ticket_id);

-- Enable RLS on ticket_files
ALTER TABLE ticket_files ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow anonymous and authenticated ticket creation
DROP POLICY IF EXISTS "tickets_public_insert" ON tickets;
CREATE POLICY "tickets_public_insert" ON tickets
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Ticket files follow ticket access
DROP POLICY IF EXISTS "ticket_files_read" ON ticket_files;
CREATE POLICY "ticket_files_read" ON ticket_files
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.submitted_by_concierge = auth.uid()
        OR auth.uid() IS NULL
        OR EXISTS(
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('agent', 'admin', 'staff', 'concierge')
        )
      )
    )
  );

-- RLS Policy: Allow file upload for ticket creators and anonymous
DROP POLICY IF EXISTS "ticket_files_insert" ON ticket_files;
CREATE POLICY "ticket_files_insert" ON ticket_files
  FOR INSERT
  WITH CHECK (true);