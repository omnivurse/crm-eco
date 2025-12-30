-- ============================================================================
-- Add ticket_id and need_id foreign keys to activities table
-- This enables tracking activities per ticket and need
-- ============================================================================

-- Add ticket_id column
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL;

-- Add need_id column
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS need_id uuid REFERENCES needs(id) ON DELETE SET NULL;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_activities_ticket_id ON activities(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_need_id ON activities(need_id) WHERE need_id IS NOT NULL;

-- Create composite index for common activity queries
CREATE INDEX IF NOT EXISTS idx_activities_org_occurred 
  ON activities(organization_id, occurred_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN activities.ticket_id IS 'Reference to ticket if this activity is related to a ticket';
COMMENT ON COLUMN activities.need_id IS 'Reference to need if this activity is related to a need';

