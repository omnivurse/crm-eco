/*
  # Fix Critical RLS Performance Issues

  ## Overview
  This migration optimizes Row Level Security policies by wrapping `auth.uid()`
  in subqueries to prevent re-evaluation for each row.

  ## Changes
  - Optimizes the most critical RLS policies with high query volume
  - Uses (SELECT auth.uid()) pattern for better performance
  - Maintains identical security logic

  ## Performance Impact
  - Eliminates redundant auth.uid() evaluations
  - Significantly improves query performance at scale
*/

-- ticket_attachments
DROP POLICY IF EXISTS "attachments_ticket_access" ON public.ticket_attachments;
CREATE POLICY "attachments_ticket_access" ON public.ticket_attachments
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_attachments.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role = ANY (ARRAY['agent'::text, 'admin'::text, 'staff'::text, 'super_admin'::text])
        )
      )
    )
  );

DROP POLICY IF EXISTS "attachments_insert" ON public.ticket_attachments;
CREATE POLICY "attachments_insert" ON public.ticket_attachments
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_attachments.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role = ANY (ARRAY['agent'::text, 'admin'::text, 'staff'::text, 'super_admin'::text])
        )
      )
    )
  );

-- kb_articles
DROP POLICY IF EXISTS "kb_author_all" ON public.kb_articles;
CREATE POLICY "kb_author_all" ON public.kb_articles
  FOR ALL
  TO public
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = ANY (ARRAY['agent'::text, 'admin'::text, 'super_admin'::text])
    )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = ANY (ARRAY['agent'::text, 'admin'::text, 'super_admin'::text])
    )
  );

-- ticket_actions
DROP POLICY IF EXISTS "ticket_actions_read" ON public.ticket_actions;
CREATE POLICY "ticket_actions_read" ON public.ticket_actions
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = ANY (ARRAY['agent'::text, 'admin'::text, 'staff'::text, 'super_admin'::text])
    )
  );

DROP POLICY IF EXISTS "ticket_actions_insert" ON public.ticket_actions;
CREATE POLICY "ticket_actions_insert" ON public.ticket_actions
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- agent_messages
DROP POLICY IF EXISTS "agent_messages_agent_only" ON public.agent_messages;
CREATE POLICY "agent_messages_agent_only" ON public.agent_messages
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = ANY (ARRAY['agent'::text, 'admin'::text, 'super_admin'::text])
    )
  );

-- kb_docs
DROP POLICY IF EXISTS "kb_docs_read_all" ON public.kb_docs;
CREATE POLICY "kb_docs_read_all" ON public.kb_docs
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "kb_docs_admin_manage" ON public.kb_docs;
CREATE POLICY "kb_docs_admin_manage" ON public.kb_docs
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'::text
    )
  );