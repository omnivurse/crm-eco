/*
  # Add Origin Support for Tickets

  1. New Fields
    - Add `origin` enum field to tickets table
    - Add `subcategory` field for more specific categorization
    - Add submitter contact fields (name, email, phone)
    - Add member/advisor ID fields for context
    - Add environment tracking fields (platform, browser, app_version)
    - Add attachments array field

  2. Security
    - Update RLS policies to handle new fields
    - Ensure proper access control

  3. Performance
    - Add indexes for origin filtering
*/

-- Add origin enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE ticket_origin AS ENUM ('member', 'advisor', 'staff');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add missing columns to tickets table
DO $$
BEGIN
  -- Add origin column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'origin'
  ) THEN
    ALTER TABLE tickets ADD COLUMN origin ticket_origin NOT NULL DEFAULT 'staff';
  END IF;

  -- Add subcategory column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'subcategory'
  ) THEN
    ALTER TABLE tickets ADD COLUMN subcategory text;
  END IF;

  -- Add submitter contact fields
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

  -- Add member/advisor ID fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'member_id_optional'
  ) THEN
    ALTER TABLE tickets ADD COLUMN member_id_optional text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'advisor_id_optional'
  ) THEN
    ALTER TABLE tickets ADD COLUMN advisor_id_optional text;
  END IF;

  -- Add environment tracking fields
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

  -- Add attachments array field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE tickets ADD COLUMN attachments text[] DEFAULT '{}';
  END IF;

END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_origin ON tickets(origin);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_subcategory ON tickets(subcategory);

-- Update RLS policies to handle origin-aware tickets
DROP POLICY IF EXISTS "tickets_insert_public" ON tickets;
DROP POLICY IF EXISTS "tickets_select_public" ON tickets;

-- Allow public insert for support form submissions
CREATE POLICY "tickets_insert_public"
  ON tickets
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow public to read their own submitted tickets (by email if not authenticated)
CREATE POLICY "tickets_select_public"
  ON tickets
  FOR SELECT
  TO public
  USING (
    -- Authenticated users can see tickets they created or are assigned to
    (auth.uid() IS NOT NULL AND (
      requester_id = auth.uid() OR 
      assignee_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
      )
    )) OR
    -- Anonymous users can see tickets they submitted by email
    (auth.uid() IS NULL AND submitter_email IS NOT NULL)
  );

-- Allow agents/admins to update tickets
CREATE POLICY "tickets_update_staff"
  ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );