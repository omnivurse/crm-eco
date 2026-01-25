/*
  # Optimize RLS Policies for Performance

  ## Overview
  This migration optimizes all Row Level Security (RLS) policies that use `auth.uid()`
  directly by wrapping them in subqueries `(select auth.uid())`. This prevents the
  auth function from being re-evaluated for each row, significantly improving query
  performance at scale.

  ## Changes
  - Drops and recreates all affected RLS policies with optimized subquery pattern
  - Maintains exact same security logic, only improves performance
  - Affects policies across multiple tables including:
    - ticket_attachments, ticket_actions, agent_messages
    - kb_articles, kb_docs, staff_logs, profiles
    - satisfaction_surveys, response_templates, reminders
    - team collaboration tables, chat system tables
    - system health and metrics tables
    - And many more

  ## Performance Impact
  - Reduces query execution time for tables with many rows
  - Eliminates redundant auth.uid() evaluations per row
  - Maintains security without compromising on access control
*/

-- ==========================================
-- TICKET ATTACHMENTS
-- ==========================================

DROP POLICY IF EXISTS "attachments_ticket_access" ON public.ticket_attachments;
CREATE POLICY "attachments_ticket_access" ON public.ticket_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_attachments.ticket_id
      AND (
        tickets.requester_id = (SELECT auth.uid())
        OR tickets.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "attachments_insert" ON public.ticket_attachments;
CREATE POLICY "attachments_insert" ON public.ticket_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- KB ARTICLES
-- ==========================================

DROP POLICY IF EXISTS "kb_author_all" ON public.kb_articles;
CREATE POLICY "kb_author_all" ON public.kb_articles
  FOR ALL
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- TICKET ACTIONS
-- ==========================================

DROP POLICY IF EXISTS "ticket_actions_insert" ON public.ticket_actions;
CREATE POLICY "ticket_actions_insert" ON public.ticket_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "ticket_actions_read" ON public.ticket_actions;
CREATE POLICY "ticket_actions_read" ON public.ticket_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_actions.ticket_id
      AND (
        tickets.requester_id = (SELECT auth.uid())
        OR tickets.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

-- ==========================================
-- AGENT MESSAGES
-- ==========================================

DROP POLICY IF EXISTS "agent_messages_agent_only" ON public.agent_messages;
CREATE POLICY "agent_messages_agent_only" ON public.agent_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- KB DOCS
-- ==========================================

DROP POLICY IF EXISTS "kb_docs_read_all" ON public.kb_docs;
CREATE POLICY "kb_docs_read_all" ON public.kb_docs
  FOR SELECT
  TO authenticated
  USING (
    published = true
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "kb_docs_admin_manage" ON public.kb_docs;
CREATE POLICY "kb_docs_admin_manage" ON public.kb_docs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- STAFF LOGS
-- ==========================================

DROP POLICY IF EXISTS "staff_logs_assigned_read" ON public.staff_logs;
CREATE POLICY "staff_logs_assigned_read" ON public.staff_logs
  FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM staff_log_assignments
      WHERE staff_log_assignments.log_id = staff_logs.id
      AND staff_log_assignments.assignee_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "staff_logs_it_full_access" ON public.staff_logs;
CREATE POLICY "staff_logs_it_full_access" ON public.staff_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- STAFF LOG COMMENTS
-- ==========================================

DROP POLICY IF EXISTS "staff_log_comments_access" ON public.staff_log_comments;
CREATE POLICY "staff_log_comments_access" ON public.staff_log_comments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_logs
      WHERE staff_logs.id = staff_log_comments.log_id
      AND (
        staff_logs.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM staff_log_assignments
          WHERE staff_log_assignments.log_id = staff_logs.id
          AND staff_log_assignments.assignee_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

-- ==========================================
-- STAFF LOG ATTACHMENTS
-- ==========================================

DROP POLICY IF EXISTS "staff_log_attachments_access" ON public.staff_log_attachments;
CREATE POLICY "staff_log_attachments_access" ON public.staff_log_attachments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_logs
      WHERE staff_logs.id = staff_log_attachments.log_id
      AND (
        staff_logs.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM staff_log_assignments
          WHERE staff_log_assignments.log_id = staff_logs.id
          AND staff_log_assignments.assignee_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

-- ==========================================
-- STAFF LOG ASSIGNMENTS
-- ==========================================

DROP POLICY IF EXISTS "staff_log_assignments_manage" ON public.staff_log_assignments;
CREATE POLICY "staff_log_assignments_manage" ON public.staff_log_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_logs
      WHERE staff_logs.id = staff_log_assignments.log_id
      AND staff_logs.created_by = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- STAFF LOG NOTIFICATIONS
-- ==========================================

DROP POLICY IF EXISTS "staff_log_notifications_own" ON public.staff_log_notifications;
CREATE POLICY "staff_log_notifications_own" ON public.staff_log_notifications
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ==========================================
-- REMINDERS
-- ==========================================

DROP POLICY IF EXISTS "reminders_self_manage" ON public.reminders;
CREATE POLICY "reminders_self_manage" ON public.reminders
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ==========================================
-- USER PROFILES
-- ==========================================

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- ==========================================
-- RESPONSE TEMPLATES
-- ==========================================

DROP POLICY IF EXISTS "response_templates_admin_manage" ON public.response_templates;
CREATE POLICY "response_templates_admin_manage" ON public.response_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "response_templates_agent_read" ON public.response_templates;
CREATE POLICY "response_templates_agent_read" ON public.response_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- PROFILES (MAIN TABLE)
-- ==========================================

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ==========================================
-- STAFF LOG TEMPLATES
-- ==========================================

DROP POLICY IF EXISTS "staff_log_templates_read" ON public.staff_log_templates;
CREATE POLICY "staff_log_templates_read" ON public.staff_log_templates
  FOR SELECT
  TO authenticated
  USING (
    is_global = true
    OR created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "staff_log_templates_write" ON public.staff_log_templates;
CREATE POLICY "staff_log_templates_write" ON public.staff_log_templates
  FOR ALL
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- STAFF LOG ACTIVITY
-- ==========================================

DROP POLICY IF EXISTS "staff_log_activity_read" ON public.staff_log_activity;
CREATE POLICY "staff_log_activity_read" ON public.staff_log_activity
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_logs
      WHERE staff_logs.id = staff_log_activity.log_id
      AND (
        staff_logs.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM staff_log_assignments
          WHERE staff_log_assignments.log_id = staff_logs.id
          AND staff_log_assignments.assignee_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

-- ==========================================
-- STAFF LOG SHARES
-- ==========================================

DROP POLICY IF EXISTS "staff_log_shares_manage" ON public.staff_log_shares;
CREATE POLICY "staff_log_shares_manage" ON public.staff_log_shares
  FOR ALL
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR shared_with_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM staff_logs
      WHERE staff_logs.id = staff_log_shares.log_id
      AND staff_logs.created_by = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- AUDIT LOGS
-- ==========================================

DROP POLICY IF EXISTS "audit_admin_read_all" ON public.audit_logs;
CREATE POLICY "audit_admin_read_all" ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SATISFACTION SURVEYS
-- ==========================================

DROP POLICY IF EXISTS "surveys_agent_read" ON public.satisfaction_surveys;
CREATE POLICY "surveys_agent_read" ON public.satisfaction_surveys
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "surveys_agent_insert" ON public.satisfaction_surveys;
CREATE POLICY "surveys_agent_insert" ON public.satisfaction_surveys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "surveys_agent_update" ON public.satisfaction_surveys;
CREATE POLICY "surveys_agent_update" ON public.satisfaction_surveys
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- SATISFACTION RESPONSES
-- ==========================================

DROP POLICY IF EXISTS "responses_agent_read" ON public.satisfaction_responses;
CREATE POLICY "responses_agent_read" ON public.satisfaction_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- TICKET WATCHERS
-- ==========================================

DROP POLICY IF EXISTS "ticket_watchers_delete" ON public.ticket_watchers;
CREATE POLICY "ticket_watchers_delete" ON public.ticket_watchers
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "ticket_watchers_view_accessible" ON public.ticket_watchers;
CREATE POLICY "ticket_watchers_view_accessible" ON public.ticket_watchers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_watchers.ticket_id
      AND (
        tickets.requester_id = (SELECT auth.uid())
        OR tickets.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "ticket_watchers_insert" ON public.ticket_watchers;
CREATE POLICY "ticket_watchers_insert" ON public.ticket_watchers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- SATISFACTION CONFIG
-- ==========================================

DROP POLICY IF EXISTS "config_admin_read" ON public.satisfaction_config;
CREATE POLICY "config_admin_read" ON public.satisfaction_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "config_admin_update" ON public.satisfaction_config;
CREATE POLICY "config_admin_update" ON public.satisfaction_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- TICKET METRICS
-- ==========================================

DROP POLICY IF EXISTS "metrics_staff_read" ON public.ticket_metrics;
CREATE POLICY "metrics_staff_read" ON public.ticket_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "metrics_agent_read" ON public.ticket_metrics;
CREATE POLICY "metrics_agent_read" ON public.ticket_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_metrics.ticket_id
      AND tickets.assignee_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "metrics_agent_insert" ON public.ticket_metrics;
CREATE POLICY "metrics_agent_insert" ON public.ticket_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "metrics_agent_update" ON public.ticket_metrics;
CREATE POLICY "metrics_agent_update" ON public.ticket_metrics
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- AGENT PERFORMANCE DAILY
-- ==========================================

DROP POLICY IF EXISTS "agent_perf_self_read" ON public.agent_performance_daily;
CREATE POLICY "agent_perf_self_read" ON public.agent_performance_daily
  FOR SELECT
  TO authenticated
  USING (agent_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "agent_perf_admin_read" ON public.agent_performance_daily;
CREATE POLICY "agent_perf_admin_read" ON public.agent_performance_daily
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "agent_perf_system_insert" ON public.agent_performance_daily;
CREATE POLICY "agent_perf_system_insert" ON public.agent_performance_daily
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SYSTEM METRICS HOURLY
-- ==========================================

DROP POLICY IF EXISTS "system_metrics_staff_read" ON public.system_metrics_hourly;
CREATE POLICY "system_metrics_staff_read" ON public.system_metrics_hourly
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "system_metrics_admin_insert" ON public.system_metrics_hourly;
CREATE POLICY "system_metrics_admin_insert" ON public.system_metrics_hourly
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- TICKET READ STATUS
-- ==========================================

DROP POLICY IF EXISTS "ticket_read_status_self" ON public.ticket_read_status;
CREATE POLICY "ticket_read_status_self" ON public.ticket_read_status
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ==========================================
-- SUPPORT CHANNELS
-- ==========================================

DROP POLICY IF EXISTS "channels_staff_read" ON public.support_channels;
CREATE POLICY "channels_staff_read" ON public.support_channels
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "channels_admin_all" ON public.support_channels;
CREATE POLICY "channels_admin_all" ON public.support_channels
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- CHANNEL MESSAGES
-- ==========================================

DROP POLICY IF EXISTS "messages_agent_read" ON public.channel_messages;
CREATE POLICY "messages_agent_read" ON public.channel_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "messages_customer_read" ON public.channel_messages;
CREATE POLICY "messages_customer_read" ON public.channel_messages
  FOR SELECT
  TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = channel_messages.ticket_id
      AND tickets.requester_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_agent_update" ON public.channel_messages;
CREATE POLICY "messages_agent_update" ON public.channel_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- EMAIL ACCOUNTS
-- ==========================================

DROP POLICY IF EXISTS "email_accounts_staff_read" ON public.email_accounts;
CREATE POLICY "email_accounts_staff_read" ON public.email_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "email_accounts_admin_all" ON public.email_accounts;
CREATE POLICY "email_accounts_admin_all" ON public.email_accounts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- CHAT SESSIONS
-- ==========================================

DROP POLICY IF EXISTS "chat_sessions_agent_read" ON public.chat_sessions;
CREATE POLICY "chat_sessions_agent_read" ON public.chat_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "chat_sessions_agent_update" ON public.chat_sessions;
CREATE POLICY "chat_sessions_agent_update" ON public.chat_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- NOTIFICATION PREFERENCES
-- ==========================================

DROP POLICY IF EXISTS "notification_preferences_self" ON public.notification_preferences;
CREATE POLICY "notification_preferences_self" ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ==========================================
-- CHANNEL ROUTING RULES
-- ==========================================

DROP POLICY IF EXISTS "routing_rules_staff_read" ON public.channel_routing_rules;
CREATE POLICY "routing_rules_staff_read" ON public.channel_routing_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "routing_rules_admin_all" ON public.channel_routing_rules;
CREATE POLICY "routing_rules_admin_all" ON public.channel_routing_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- TICKET NOTIFICATIONS
-- ==========================================

DROP POLICY IF EXISTS "ticket_notifications_self_read" ON public.ticket_notifications;
CREATE POLICY "ticket_notifications_self_read" ON public.ticket_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ticket_notifications_self_update" ON public.ticket_notifications;
CREATE POLICY "ticket_notifications_self_update" ON public.ticket_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ==========================================
-- SLA POLICIES
-- ==========================================

DROP POLICY IF EXISTS "sla_policies_staff_read" ON public.sla_policies;
CREATE POLICY "sla_policies_staff_read" ON public.sla_policies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_policies_admin_all" ON public.sla_policies;
CREATE POLICY "sla_policies_admin_all" ON public.sla_policies
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_policies_admin_manage" ON public.sla_policies;
CREATE POLICY "sla_policies_admin_manage" ON public.sla_policies
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- TICKET STATUS HISTORY
-- ==========================================

DROP POLICY IF EXISTS "ticket_status_history_view" ON public.ticket_status_history;
CREATE POLICY "ticket_status_history_view" ON public.ticket_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_status_history.ticket_id
      AND (
        tickets.requester_id = (SELECT auth.uid())
        OR tickets.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

-- ==========================================
-- BUSINESS HOURS
-- ==========================================

DROP POLICY IF EXISTS "business_hours_staff_read" ON public.business_hours;
CREATE POLICY "business_hours_staff_read" ON public.business_hours
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "business_hours_admin_all" ON public.business_hours;
CREATE POLICY "business_hours_admin_all" ON public.business_hours
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- HOLIDAYS
-- ==========================================

DROP POLICY IF EXISTS "holidays_admin_all" ON public.holidays;
CREATE POLICY "holidays_admin_all" ON public.holidays
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SLA ESCALATIONS
-- ==========================================

DROP POLICY IF EXISTS "sla_escalations_staff_read" ON public.sla_escalations;
CREATE POLICY "sla_escalations_staff_read" ON public.sla_escalations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_escalations_admin_all" ON public.sla_escalations;
CREATE POLICY "sla_escalations_admin_all" ON public.sla_escalations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SLA EVENTS
-- ==========================================

DROP POLICY IF EXISTS "sla_events_staff_read" ON public.sla_events;
CREATE POLICY "sla_events_staff_read" ON public.sla_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- TEAMS
-- ==========================================

DROP POLICY IF EXISTS "teams_staff_read" ON public.teams;
CREATE POLICY "teams_staff_read" ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "teams_admin_manage" ON public.teams;
CREATE POLICY "teams_admin_manage" ON public.teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- TICKET COMMENTS
-- ==========================================

DROP POLICY IF EXISTS "ticket_comments_read" ON public.ticket_comments;
CREATE POLICY "ticket_comments_read" ON public.ticket_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.requester_id = (SELECT auth.uid())
        OR tickets.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
    OR (is_internal = false)
  );

DROP POLICY IF EXISTS "ticket_comments_insert" ON public.ticket_comments;
CREATE POLICY "ticket_comments_insert" ON public.ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.requester_id = (SELECT auth.uid())
        OR tickets.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "ticket_comments_update_own" ON public.ticket_comments;
CREATE POLICY "ticket_comments_update_own" ON public.ticket_comments
  FOR UPDATE
  TO authenticated
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ticket_comments_delete_own" ON public.ticket_comments;
CREATE POLICY "ticket_comments_delete_own" ON public.ticket_comments
  FOR DELETE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SERVICES
-- ==========================================

DROP POLICY IF EXISTS "services_admin_manage" ON public.services;
CREATE POLICY "services_admin_manage" ON public.services
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SLA TIMERS
-- ==========================================

DROP POLICY IF EXISTS "sla_timers_staff_read" ON public.sla_timers;
CREATE POLICY "sla_timers_staff_read" ON public.sla_timers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- CATALOG CATEGORIES
-- ==========================================

DROP POLICY IF EXISTS "catalog_categories_admin_manage" ON public.catalog_categories;
CREATE POLICY "catalog_categories_admin_manage" ON public.catalog_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- CATALOG ITEMS
-- ==========================================

DROP POLICY IF EXISTS "catalog_items_admin_manage" ON public.catalog_items;
CREATE POLICY "catalog_items_admin_manage" ON public.catalog_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- REQUESTS
-- ==========================================

DROP POLICY IF EXISTS "requests_own_read" ON public.requests;
CREATE POLICY "requests_own_read" ON public.requests
  FOR SELECT
  TO authenticated
  USING (requester_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "requests_own_insert" ON public.requests;
CREATE POLICY "requests_own_insert" ON public.requests
  FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "requests_staff_manage" ON public.requests;
CREATE POLICY "requests_staff_manage" ON public.requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- REQUEST APPROVALS
-- ==========================================

DROP POLICY IF EXISTS "request_approvals_read" ON public.request_approvals;
CREATE POLICY "request_approvals_read" ON public.request_approvals
  FOR SELECT
  TO authenticated
  USING (
    approver_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_approvals.request_id
      AND requests.requester_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "request_approvals_update" ON public.request_approvals;
CREATE POLICY "request_approvals_update" ON public.request_approvals
  FOR UPDATE
  TO authenticated
  USING (approver_id = (SELECT auth.uid()))
  WITH CHECK (approver_id = (SELECT auth.uid()));

-- ==========================================
-- PROBLEMS
-- ==========================================

DROP POLICY IF EXISTS "problems_staff_access" ON public.problems;
CREATE POLICY "problems_staff_access" ON public.problems
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- PROBLEM TICKETS
-- ==========================================

DROP POLICY IF EXISTS "problem_tickets_staff_access" ON public.problem_tickets;
CREATE POLICY "problem_tickets_staff_access" ON public.problem_tickets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- CHANGES
-- ==========================================

DROP POLICY IF EXISTS "changes_staff_access" ON public.changes;
CREATE POLICY "changes_staff_access" ON public.changes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- CHANGE APPROVALS
-- ==========================================

DROP POLICY IF EXISTS "change_approvals_read" ON public.change_approvals;
CREATE POLICY "change_approvals_read" ON public.change_approvals
  FOR SELECT
  TO authenticated
  USING (
    approver_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM changes
      WHERE changes.id = change_approvals.change_id
      AND changes.requester_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "change_approvals_update" ON public.change_approvals;
CREATE POLICY "change_approvals_update" ON public.change_approvals
  FOR UPDATE
  TO authenticated
  USING (approver_id = (SELECT auth.uid()))
  WITH CHECK (approver_id = (SELECT auth.uid()));

-- ==========================================
-- CMDB CI
-- ==========================================

DROP POLICY IF EXISTS "cmdb_ci_staff_read" ON public.cmdb_ci;
CREATE POLICY "cmdb_ci_staff_read" ON public.cmdb_ci
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "cmdb_ci_it_manage" ON public.cmdb_ci;
CREATE POLICY "cmdb_ci_it_manage" ON public.cmdb_ci
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- CI RELATIONSHIPS
-- ==========================================

DROP POLICY IF EXISTS "ci_relationships_staff_read" ON public.ci_relationships;
CREATE POLICY "ci_relationships_staff_read" ON public.ci_relationships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- ASSETS
-- ==========================================

DROP POLICY IF EXISTS "assets_staff_read" ON public.assets;
CREATE POLICY "assets_staff_read" ON public.assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "assets_it_manage" ON public.assets;
CREATE POLICY "assets_it_manage" ON public.assets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- ASSET ASSIGNMENTS
-- ==========================================

DROP POLICY IF EXISTS "asset_assignments_read" ON public.asset_assignments;
CREATE POLICY "asset_assignments_read" ON public.asset_assignments
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- WORKFLOWS
-- ==========================================

DROP POLICY IF EXISTS "workflows_admin_access" ON public.workflows;
CREATE POLICY "workflows_admin_access" ON public.workflows
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- WORKFLOW STEPS
-- ==========================================

DROP POLICY IF EXISTS "workflow_steps_admin_access" ON public.workflow_steps;
CREATE POLICY "workflow_steps_admin_access" ON public.workflow_steps
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- WORKFLOW EXECUTIONS
-- ==========================================

DROP POLICY IF EXISTS "workflow_executions_admin_read" ON public.workflow_executions;
CREATE POLICY "workflow_executions_admin_read" ON public.workflow_executions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- METRICS DAILY
-- ==========================================

DROP POLICY IF EXISTS "metrics_staff_read" ON public.metrics_daily;
CREATE POLICY "metrics_staff_read" ON public.metrics_daily
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- TICKET EVENTS
-- ==========================================

DROP POLICY IF EXISTS "ticket_events_access" ON public.ticket_events;
CREATE POLICY "ticket_events_access" ON public.ticket_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_events.ticket_id
      AND (
        tickets.requester_id = (SELECT auth.uid())
        OR tickets.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

-- ==========================================
-- TICKET FILES
-- ==========================================

DROP POLICY IF EXISTS "ticket_files_read" ON public.ticket_files;
CREATE POLICY "ticket_files_read" ON public.ticket_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_files.ticket_id
      AND (
        tickets.requester_id = (SELECT auth.uid())
        OR tickets.assignee_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
        )
      )
    )
  );

-- ==========================================
-- CANNED RESPONSES
-- ==========================================

DROP POLICY IF EXISTS "canned_responses_staff_read" ON public.canned_responses;
CREATE POLICY "canned_responses_staff_read" ON public.canned_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "canned_responses_staff_all" ON public.canned_responses;
CREATE POLICY "canned_responses_staff_all" ON public.canned_responses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- WORKFLOW QUEUE
-- ==========================================

DROP POLICY IF EXISTS "workflow_queue_admin_access" ON public.workflow_queue;
CREATE POLICY "workflow_queue_admin_access" ON public.workflow_queue
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SLA METRICS
-- ==========================================

DROP POLICY IF EXISTS "sla_metrics_view_all" ON public.sla_metrics;
CREATE POLICY "sla_metrics_view_all" ON public.sla_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_metrics_system_insert" ON public.sla_metrics;
CREATE POLICY "sla_metrics_system_insert" ON public.sla_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_metrics_system_update" ON public.sla_metrics;
CREATE POLICY "sla_metrics_system_update" ON public.sla_metrics
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- TEAM MEETINGS
-- ==========================================

DROP POLICY IF EXISTS "Staff can view all meetings" ON public.team_meetings;
CREATE POLICY "Staff can view all meetings" ON public.team_meetings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Staff can create meetings" ON public.team_meetings;
CREATE POLICY "Staff can create meetings" ON public.team_meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Meeting creators can update their meetings" ON public.team_meetings;
CREATE POLICY "Meeting creators can update their meetings" ON public.team_meetings
  FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Meeting creators can delete their meetings" ON public.team_meetings;
CREATE POLICY "Meeting creators can delete their meetings" ON public.team_meetings
  FOR DELETE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- MEETING PARTICIPANTS
-- ==========================================

DROP POLICY IF EXISTS "Staff can view meeting participants" ON public.meeting_participants;
CREATE POLICY "Staff can view meeting participants" ON public.meeting_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Meeting creators can add participants" ON public.meeting_participants;
CREATE POLICY "Meeting creators can add participants" ON public.meeting_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_meetings
      WHERE team_meetings.id = meeting_participants.meeting_id
      AND team_meetings.created_by = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Users can update their own participation status" ON public.meeting_participants;
CREATE POLICY "Users can update their own participation status" ON public.meeting_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ==========================================
-- TEAM ANNOUNCEMENTS
-- ==========================================

DROP POLICY IF EXISTS "Staff can view announcements for their role" ON public.team_announcements;
CREATE POLICY "Staff can view announcements for their role" ON public.team_announcements
  FOR SELECT
  TO authenticated
  USING (
    target_audience = 'all'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role::text = team_announcements.target_audience
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can create announcements" ON public.team_announcements;
CREATE POLICY "Admins can create announcements" ON public.team_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update announcements" ON public.team_announcements;
CREATE POLICY "Admins can update announcements" ON public.team_announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete announcements" ON public.team_announcements;
CREATE POLICY "Admins can delete announcements" ON public.team_announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- ANNOUNCEMENT READS
-- ==========================================

DROP POLICY IF EXISTS "Users can view their own reads" ON public.announcement_reads;
CREATE POLICY "Users can view their own reads" ON public.announcement_reads
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can mark announcements as read" ON public.announcement_reads;
CREATE POLICY "Users can mark announcements as read" ON public.announcement_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ==========================================
-- TEAM PRESENCE
-- ==========================================

DROP POLICY IF EXISTS "Staff can view team presence" ON public.team_presence;
CREATE POLICY "Staff can view team presence" ON public.team_presence
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Users can update their own presence" ON public.team_presence;
CREATE POLICY "Users can update their own presence" ON public.team_presence
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own presence status" ON public.team_presence;
CREATE POLICY "Users can update their own presence status" ON public.team_presence
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ==========================================
-- TEAM ACTIVITIES
-- ==========================================

DROP POLICY IF EXISTS "Staff can view team activities" ON public.team_activities;
CREATE POLICY "Staff can view team activities" ON public.team_activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- CHAT QUICK RESPONSES
-- ==========================================

DROP POLICY IF EXISTS "quick_responses_agent_read" ON public.chat_quick_responses;
CREATE POLICY "quick_responses_agent_read" ON public.chat_quick_responses
  FOR SELECT
  TO authenticated
  USING (
    is_global = true
    OR created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "quick_responses_agent_insert" ON public.chat_quick_responses;
CREATE POLICY "quick_responses_agent_insert" ON public.chat_quick_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "quick_responses_creator_update" ON public.chat_quick_responses;
CREATE POLICY "quick_responses_creator_update" ON public.chat_quick_responses
  FOR UPDATE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "quick_responses_creator_delete" ON public.chat_quick_responses;
CREATE POLICY "quick_responses_creator_delete" ON public.chat_quick_responses
  FOR DELETE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- AGENT CHAT PREFERENCES
-- ==========================================

DROP POLICY IF EXISTS "chat_prefs_agent_all" ON public.agent_chat_preferences;
CREATE POLICY "chat_prefs_agent_all" ON public.agent_chat_preferences
  FOR ALL
  TO authenticated
  USING (agent_id = (SELECT auth.uid()))
  WITH CHECK (agent_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chat_prefs_admin_read" ON public.agent_chat_preferences;
CREATE POLICY "chat_prefs_admin_read" ON public.agent_chat_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- CHAT SESSION NOTES
-- ==========================================

DROP POLICY IF EXISTS "session_notes_agent_read" ON public.chat_session_notes;
CREATE POLICY "session_notes_agent_read" ON public.chat_session_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "session_notes_agent_insert" ON public.chat_session_notes;
CREATE POLICY "session_notes_agent_insert" ON public.chat_session_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- ==========================================
-- SYSTEM HEALTH LOGS
-- ==========================================

DROP POLICY IF EXISTS "Super admins and admins can read health logs" ON public.system_health_logs;
CREATE POLICY "Super admins and admins can read health logs" ON public.system_health_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SYSTEM METRICS
-- ==========================================

DROP POLICY IF EXISTS "Super admins and admins can read metrics" ON public.system_metrics;
CREATE POLICY "Super admins and admins can read metrics" ON public.system_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SYSTEM INCIDENTS
-- ==========================================

DROP POLICY IF EXISTS "Super admins and admins can read incidents" ON public.system_incidents;
CREATE POLICY "Super admins and admins can read incidents" ON public.system_incidents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Super admins and admins can create incidents" ON public.system_incidents;
CREATE POLICY "Super admins and admins can create incidents" ON public.system_incidents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Super admins and admins can update incidents" ON public.system_incidents;
CREATE POLICY "Super admins and admins can update incidents" ON public.system_incidents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- SYSTEM ALERTS
-- ==========================================

DROP POLICY IF EXISTS "Super admins and admins can manage alerts" ON public.system_alerts;
CREATE POLICY "Super admins and admins can manage alerts" ON public.system_alerts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- CHANGE TASKS
-- ==========================================

DROP POLICY IF EXISTS "change_tasks_staff_access" ON public.change_tasks;
CREATE POLICY "change_tasks_staff_access" ON public.change_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

-- ==========================================
-- REQUEST TASKS
-- ==========================================

DROP POLICY IF EXISTS "request_tasks_staff_access" ON public.request_tasks;
CREATE POLICY "request_tasks_staff_access" ON public.request_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('staff', 'admin', 'agent', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "request_tasks_requester_read" ON public.request_tasks;
CREATE POLICY "request_tasks_requester_read" ON public.request_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_tasks.request_id
      AND requests.requester_id = (SELECT auth.uid())
    )
  );
