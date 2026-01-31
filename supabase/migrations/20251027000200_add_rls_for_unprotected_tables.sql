/*
  # Add RLS Policies for Unprotected Tables (Safe Version)

  1. Purpose
    - Add Row Level Security policies to tables that currently lack them
    - Only applies policies to tables that exist
*/

-- Helper function to check if table exists
CREATE OR REPLACE FUNCTION table_exists_fn(p_table_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = p_table_name 
    AND table_schema = 'public'
  );
END;
$$ LANGUAGE plpgsql;

-- change_tasks RLS (only if table exists)
DO $$ BEGIN
IF table_exists_fn('change_tasks') THEN
  ALTER TABLE change_tasks ENABLE ROW LEVEL SECURITY;
  
  -- Simple policy - allow authenticated users to see tasks they're assigned to
  DROP POLICY IF EXISTS "Users can view their change_tasks" ON change_tasks;
  CREATE POLICY "Users can view their change_tasks"
    ON change_tasks FOR SELECT TO authenticated
    USING (assigned_to = auth.uid());
  
  DROP POLICY IF EXISTS "Users can manage their change_tasks" ON change_tasks;
  CREATE POLICY "Users can manage their change_tasks"
    ON change_tasks FOR ALL TO authenticated
    USING (assigned_to = auth.uid())
    WITH CHECK (assigned_to = auth.uid());
END IF;
END $$;

-- request_tasks RLS (only if table exists)
DO $$ BEGIN
IF table_exists_fn('request_tasks') THEN
  ALTER TABLE request_tasks ENABLE ROW LEVEL SECURITY;
  
  DROP POLICY IF EXISTS "Users can view their request_tasks" ON request_tasks;
  CREATE POLICY "Users can view their request_tasks"
    ON request_tasks FOR SELECT TO authenticated
    USING (assigned_to = auth.uid());
  
  DROP POLICY IF EXISTS "Users can manage their request_tasks" ON request_tasks;
  CREATE POLICY "Users can manage their request_tasks"
    ON request_tasks FOR ALL TO authenticated
    USING (assigned_to = auth.uid())
    WITH CHECK (assigned_to = auth.uid());
END IF;
END $$;

-- ticket_comments RLS (only if table exists)
DO $$ BEGIN
IF table_exists_fn('ticket_comments') THEN
  -- Table already has RLS enabled from earlier migrations
  -- Just add/update policies for comment authors
  DROP POLICY IF EXISTS "Comment authors can view comments" ON ticket_comments;
  CREATE POLICY "Comment authors can view comments"
    ON ticket_comments FOR SELECT TO authenticated
    USING (author_id = auth.uid());
  
  DROP POLICY IF EXISTS "Comment authors can manage their comments" ON ticket_comments;
  CREATE POLICY "Comment authors can manage their comments"
    ON ticket_comments FOR ALL TO authenticated
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());
END IF;
END $$;

-- Clean up helper function
DROP FUNCTION IF EXISTS table_exists_fn(text);
