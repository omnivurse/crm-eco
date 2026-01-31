-- Add additional columns to tickets table
-- These columns enhance the original tickets schema with origin tracking and additional metadata

DO $$
BEGIN
  -- Add origin column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'origin') THEN
    ALTER TABLE tickets ADD COLUMN origin text NOT NULL DEFAULT 'member' CHECK (origin IN ('member','advisor','staff'));
  END IF;
  
  -- Add subcategory column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'subcategory') THEN
    ALTER TABLE tickets ADD COLUMN subcategory text;
  END IF;
  
  -- Add submitter fields for anonymous tickets
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'submitter_email') THEN
    ALTER TABLE tickets ADD COLUMN submitter_email text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'submitter_name') THEN
    ALTER TABLE tickets ADD COLUMN submitter_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'submitter_phone') THEN
    ALTER TABLE tickets ADD COLUMN submitter_phone text;
  END IF;
  
  -- Add optional reference IDs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'member_id_optional') THEN
    ALTER TABLE tickets ADD COLUMN member_id_optional text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'advisor_id_optional') THEN
    ALTER TABLE tickets ADD COLUMN advisor_id_optional text;
  END IF;
  
  -- Add device/context info
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'platform') THEN
    ALTER TABLE tickets ADD COLUMN platform text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'browser') THEN
    ALTER TABLE tickets ADD COLUMN browser text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'app_version') THEN
    ALTER TABLE tickets ADD COLUMN app_version text;
  END IF;
  
  -- Add attachments array
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'attachments') THEN
    ALTER TABLE tickets ADD COLUMN attachments text[];
  END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tickets_origin ON tickets(origin);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);