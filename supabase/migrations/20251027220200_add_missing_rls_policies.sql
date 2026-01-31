/*
  # Add Missing RLS Policies (Safe Version)

  1. Purpose
    - Add RLS policies for tables that have RLS enabled but no policies
    - Fix column naming issues (use assignee_id for tickets)
    - Only applies to tables that exist
*/

-- Helper function
CREATE OR REPLACE FUNCTION safe_create_policy_v2(
  policy_name text,
  table_name text,
  policy_cmd text,
  policy_def text
)
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE information_schema.tables.table_name = safe_create_policy_v2.table_name AND table_schema = 'public') THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    EXECUTE format('CREATE POLICY %I ON %I %s %s', policy_name, table_name, policy_cmd, policy_def);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- change_tasks policies
SELECT safe_create_policy_v2(
  'change_tasks_staff_read',
  'change_tasks',
  'FOR SELECT TO authenticated',
  'USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''staff'', ''agent'', ''admin'', ''super_admin'')))'
);

SELECT safe_create_policy_v2(
  'change_tasks_staff_manage',
  'change_tasks',
  'FOR ALL TO authenticated',
  'USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''staff'', ''agent'', ''admin'', ''super_admin'')))'
);

SELECT safe_create_policy_v2(
  'change_tasks_assigned_read',
  'change_tasks',
  'FOR SELECT TO authenticated',
  'USING (assigned_to = auth.uid())'
);

-- request_tasks policies
SELECT safe_create_policy_v2(
  'request_tasks_staff_read',
  'request_tasks',
  'FOR SELECT TO authenticated',
  'USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''staff'', ''agent'', ''admin'', ''super_admin'')))'
);

SELECT safe_create_policy_v2(
  'request_tasks_staff_manage',
  'request_tasks',
  'FOR ALL TO authenticated',
  'USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''staff'', ''agent'', ''admin'', ''super_admin'')))'
);

SELECT safe_create_policy_v2(
  'request_tasks_assigned_read',
  'request_tasks',
  'FOR SELECT TO authenticated',
  'USING (assigned_to = auth.uid())'
);

SELECT safe_create_policy_v2(
  'request_tasks_assigned_update',
  'request_tasks',
  'FOR UPDATE TO authenticated',
  'USING (assigned_to = auth.uid())'
);

-- ticket_comments policies
-- Note: Using assignee_id for tickets table, not assigned_to
SELECT safe_create_policy_v2(
  'ticket_comments_read',
  'ticket_comments',
  'FOR SELECT TO authenticated',
  'USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN (''staff'', ''agent'', ''admin'', ''super_admin'')
        )
      )
    )
    AND (
      NOT is_internal
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN (''staff'', ''agent'', ''admin'', ''super_admin'')
      )
    )
  )'
);

SELECT safe_create_policy_v2(
  'ticket_comments_insert',
  'ticket_comments',
  'FOR INSERT TO authenticated',
  'WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN (''staff'', ''agent'', ''admin'', ''super_admin'')
        )
      )
    )
  )'
);

SELECT safe_create_policy_v2(
  'ticket_comments_update',
  'ticket_comments',
  'FOR UPDATE TO authenticated',
  'USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (''admin'', ''super_admin'')
    )
  )'
);

SELECT safe_create_policy_v2(
  'ticket_comments_delete',
  'ticket_comments',
  'FOR DELETE TO authenticated',
  'USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (''admin'', ''super_admin'')
    )
  )'
);

-- Clean up helper function
DROP FUNCTION IF EXISTS safe_create_policy_v2(text, text, text, text);
