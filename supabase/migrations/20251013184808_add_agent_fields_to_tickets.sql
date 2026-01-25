/*
  # Add Agent Fields to Tickets

  1. Changes
    - Add `agent_name` text field to store the name of the agent submitting the ticket
    - Add `agent_id` text field to store the agent's identifier
    - Add `related_urls` text array field to store multiple URLs related to the ticket
    
  2. Notes
    - These fields are optional to maintain backward compatibility
    - agent_name and agent_id are useful for tracking which agent submitted tickets on behalf of users
    - related_urls allows linking to relevant external resources, screenshots, or documentation
*/

DO $$ 
BEGIN
  -- Add agent_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'agent_name'
  ) THEN
    ALTER TABLE tickets ADD COLUMN agent_name text;
  END IF;

  -- Add agent_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN agent_id text;
  END IF;

  -- Add related_urls column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'related_urls'
  ) THEN
    ALTER TABLE tickets ADD COLUMN related_urls text[];
  END IF;
END $$;
