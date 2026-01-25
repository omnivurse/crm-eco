/*
  # Optimize RLS Policies for Performance

  1. Purpose
    - Replace direct auth function calls with (SELECT auth.function()) pattern
    - Prevent re-evaluation of auth functions for each row
    - Dramatically improve query performance at scale

  2. Changes
    - Drop and recreate all policies that use auth.uid() or auth.jwt()
    - Use subquery pattern: (SELECT auth.uid()) instead of auth.uid()
    - Maintain exact same security logic with better performance

  3. Performance Impact
    - Auth functions evaluated once per query instead of per row
    - Significant improvement on tables with many rows
    - Essential for production scale

  4. Tables Updated
    - ticket_attachments (2 policies)
    - kb_articles (1 policy)
    - ticket_actions (2 policies)
    - agent_messages (1 policy)
    - kb_docs (2 policies)
    - staff_logs (2 policies)
    - staff_log_comments (1 policy)
    - staff_log_attachments (1 policy)
    - staff_log_assignments (1 policy)
    - staff_log_notifications (1 policy)
    - reminders (1 policy)
    - user_profiles (3 policies)
    - response_templates (2 policies)
    - profiles (2 policies)
    - staff_log_templates (2 policies)
    - staff_log_activity (1 policy)
    - staff_log_shares (1 policy)
    - audit_logs (1 policy)
    - satisfaction_surveys (3 policies)
    - satisfaction_responses (1 policy)
    - ticket_watchers (1 policy)
    - satisfaction_config (2 policies)
    - ticket_metrics (4 policies)
    - agent_performance_daily (3 policies)
    - system_metrics_hourly (2 policies)
    - ticket_read_status (1 policy)
    - support_channels (2 policies)
    - channel_messages (3 policies)
    - email_accounts (2 policies)
    - chat_sessions (2 policies)
    - notification_preferences (1 policy)
    - channel_routing_rules (2 policies)
    - ticket_notifications (2 policies)
    - sla_policies (3 policies)
    - ticket_status_history (1 policy)
    - business_hours (2 policies)
    - holidays (1 policy)
    - sla_escalations (2 policies)
    - sla_events (1 policy)
    - teams (2 policies)
    - services (1 policy)
    - sla_timers (1 policy)
    - catalog_categories (1 policy)
    - catalog_items (1 policy)
    - requests (3 policies)
    - request_approvals (2 policies)
    - problems (1 policy)
    - problem_tickets (1 policy)
    - changes (1 policy)
    - change_approvals (2 policies)
    - cmdb_ci (2 policies)
    - ci_relationships (1 policy)
    - assets (2 policies)
    - asset_assignments (1 policy)
    - workflows (1 policy)
    - workflow_steps (1 policy)
    - workflow_executions (1 policy)
    - metrics_daily (1 policy)
    - ticket_events (1 policy)
    - ticket_files (1 policy)
    - ticket_watchers (2 policies)
    - canned_responses (2 policies)
    - workflow_queue (1 policy)
    - sla_metrics (3 policies)
    - team_meetings (4 policies)
    - meeting_participants (3 policies)
    - team_announcements (4 policies)
    - announcement_reads (2 policies)
    - team_presence (3 policies)
    - team_activities (1 policy)
    - chat_quick_responses (4 policies)
    - agent_chat_preferences (2 policies)
    - chat_session_notes (2 policies)
    - system_health_logs (1 policy)
    - system_metrics (1 policy)
    - system_incidents (3 policies)
    - system_alerts (1 policy)
*/

-- ticket_attachments
DROP POLICY IF EXISTS "attachments_ticket_access" ON ticket_attachments;
CREATE POLICY "attachments_ticket_access" ON ticket_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_attachments.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assigned_to = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "attachments_insert" ON ticket_attachments;
CREATE POLICY "attachments_insert" ON ticket_attachments
  FOR INSERT WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_attachments.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assigned_to = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

-- kb_articles
DROP POLICY IF EXISTS "kb_author_all" ON kb_articles;
CREATE POLICY "kb_author_all" ON kb_articles
  FOR ALL USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- ticket_actions
DROP POLICY IF EXISTS "ticket_actions_insert" ON ticket_actions;
CREATE POLICY "ticket_actions_insert" ON ticket_actions
  FOR INSERT WITH CHECK (
    actor_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "ticket_actions_read" ON ticket_actions;
CREATE POLICY "ticket_actions_read" ON ticket_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_actions.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assigned_to = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

-- agent_messages
DROP POLICY IF EXISTS "agent_messages_agent_only" ON agent_messages;
CREATE POLICY "agent_messages_agent_only" ON agent_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'admin', 'super_admin')
    )
  );

-- kb_docs
DROP POLICY IF EXISTS "kb_docs_read_all" ON kb_docs;
CREATE POLICY "kb_docs_read_all" ON kb_docs
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "kb_docs_admin_manage" ON kb_docs;
CREATE POLICY "kb_docs_admin_manage" ON kb_docs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- staff_logs
DROP POLICY IF EXISTS "staff_logs_assigned_read" ON staff_logs;
CREATE POLICY "staff_logs_assigned_read" ON staff_logs
  FOR SELECT USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM staff_log_assignments sla
      WHERE sla.log_id = staff_logs.id
      AND sla.assignee_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "staff_logs_it_full_access" ON staff_logs;
CREATE POLICY "staff_logs_it_full_access" ON staff_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- staff_log_comments
DROP POLICY IF EXISTS "staff_log_comments_access" ON staff_log_comments;
CREATE POLICY "staff_log_comments_access" ON staff_log_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_logs sl
      WHERE sl.id = staff_log_comments.log_id
      AND (
        sl.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM staff_log_assignments sla
          WHERE sla.log_id = sl.id
          AND sla.assignee_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

-- staff_log_attachments
DROP POLICY IF EXISTS "staff_log_attachments_access" ON staff_log_attachments;
CREATE POLICY "staff_log_attachments_access" ON staff_log_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_logs sl
      WHERE sl.id = staff_log_attachments.log_id
      AND (
        sl.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM staff_log_assignments sla
          WHERE sla.log_id = sl.id
          AND sla.assignee_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

-- staff_log_assignments
DROP POLICY IF EXISTS "staff_log_assignments_manage" ON staff_log_assignments;
CREATE POLICY "staff_log_assignments_manage" ON staff_log_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- staff_log_notifications
DROP POLICY IF EXISTS "staff_log_notifications_own" ON staff_log_notifications;
CREATE POLICY "staff_log_notifications_own" ON staff_log_notifications
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- reminders
DROP POLICY IF EXISTS "reminders_self_manage" ON reminders;
CREATE POLICY "reminders_self_manage" ON reminders
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- user_profiles
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

-- response_templates
DROP POLICY IF EXISTS "response_templates_admin_manage" ON response_templates;
CREATE POLICY "response_templates_admin_manage" ON response_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "response_templates_agent_read" ON response_templates;
CREATE POLICY "response_templates_agent_read" ON response_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = (SELECT auth.uid()));

-- staff_log_templates
DROP POLICY IF EXISTS "staff_log_templates_read" ON staff_log_templates;
CREATE POLICY "staff_log_templates_read" ON staff_log_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "staff_log_templates_write" ON staff_log_templates;
CREATE POLICY "staff_log_templates_write" ON staff_log_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- staff_log_activity
DROP POLICY IF EXISTS "staff_log_activity_read" ON staff_log_activity;
CREATE POLICY "staff_log_activity_read" ON staff_log_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_logs sl
      WHERE sl.id = staff_log_activity.log_id
      AND (
        sl.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM staff_log_assignments sla
          WHERE sla.log_id = sl.id
          AND sla.assignee_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

-- staff_log_shares
DROP POLICY IF EXISTS "staff_log_shares_manage" ON staff_log_shares;
CREATE POLICY "staff_log_shares_manage" ON staff_log_shares
  FOR ALL USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- audit_logs
DROP POLICY IF EXISTS "audit_admin_read_all" ON audit_logs;
CREATE POLICY "audit_admin_read_all" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- satisfaction_surveys
DROP POLICY IF EXISTS "surveys_agent_read" ON satisfaction_surveys;
CREATE POLICY "surveys_agent_read" ON satisfaction_surveys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "surveys_agent_insert" ON satisfaction_surveys;
CREATE POLICY "surveys_agent_insert" ON satisfaction_surveys
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "surveys_agent_update" ON satisfaction_surveys;
CREATE POLICY "surveys_agent_update" ON satisfaction_surveys
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- satisfaction_responses
DROP POLICY IF EXISTS "responses_agent_read" ON satisfaction_responses;
CREATE POLICY "responses_agent_read" ON satisfaction_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- ticket_watchers
DROP POLICY IF EXISTS "ticket_watchers_delete" ON ticket_watchers;
CREATE POLICY "ticket_watchers_delete" ON ticket_watchers
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- satisfaction_config
DROP POLICY IF EXISTS "config_admin_read" ON satisfaction_config;
CREATE POLICY "config_admin_read" ON satisfaction_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "config_admin_update" ON satisfaction_config;
CREATE POLICY "config_admin_update" ON satisfaction_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- ticket_metrics
DROP POLICY IF EXISTS "metrics_staff_read" ON ticket_metrics;
CREATE POLICY "metrics_staff_read" ON ticket_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "metrics_agent_read" ON ticket_metrics;
CREATE POLICY "metrics_agent_read" ON ticket_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "metrics_agent_insert" ON ticket_metrics;
CREATE POLICY "metrics_agent_insert" ON ticket_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "metrics_agent_update" ON ticket_metrics;
CREATE POLICY "metrics_agent_update" ON ticket_metrics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- agent_performance_daily
DROP POLICY IF EXISTS "agent_perf_self_read" ON agent_performance_daily;
CREATE POLICY "agent_perf_self_read" ON agent_performance_daily
  FOR SELECT USING (agent_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "agent_perf_admin_read" ON agent_performance_daily;
CREATE POLICY "agent_perf_admin_read" ON agent_performance_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "agent_perf_system_insert" ON agent_performance_daily;
CREATE POLICY "agent_perf_system_insert" ON agent_performance_daily
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- system_metrics_hourly
DROP POLICY IF EXISTS "system_metrics_staff_read" ON system_metrics_hourly;
CREATE POLICY "system_metrics_staff_read" ON system_metrics_hourly
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "system_metrics_admin_insert" ON system_metrics_hourly;
CREATE POLICY "system_metrics_admin_insert" ON system_metrics_hourly
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- ticket_read_status
DROP POLICY IF EXISTS "ticket_read_status_self" ON ticket_read_status;
CREATE POLICY "ticket_read_status_self" ON ticket_read_status
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- support_channels
DROP POLICY IF EXISTS "channels_staff_read" ON support_channels;
CREATE POLICY "channels_staff_read" ON support_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "channels_admin_all" ON support_channels;
CREATE POLICY "channels_admin_all" ON support_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- channel_messages
DROP POLICY IF EXISTS "messages_agent_read" ON channel_messages;
CREATE POLICY "messages_agent_read" ON channel_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "messages_customer_read" ON channel_messages;
CREATE POLICY "messages_customer_read" ON channel_messages
  FOR SELECT USING (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "messages_agent_update" ON channel_messages;
CREATE POLICY "messages_agent_update" ON channel_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- email_accounts
DROP POLICY IF EXISTS "email_accounts_staff_read" ON email_accounts;
CREATE POLICY "email_accounts_staff_read" ON email_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "email_accounts_admin_all" ON email_accounts;
CREATE POLICY "email_accounts_admin_all" ON email_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- chat_sessions
DROP POLICY IF EXISTS "chat_sessions_agent_read" ON chat_sessions;
CREATE POLICY "chat_sessions_agent_read" ON chat_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "chat_sessions_agent_update" ON chat_sessions;
CREATE POLICY "chat_sessions_agent_update" ON chat_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- notification_preferences
DROP POLICY IF EXISTS "notification_preferences_self" ON notification_preferences;
CREATE POLICY "notification_preferences_self" ON notification_preferences
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- channel_routing_rules
DROP POLICY IF EXISTS "routing_rules_staff_read" ON channel_routing_rules;
CREATE POLICY "routing_rules_staff_read" ON channel_routing_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "routing_rules_admin_all" ON channel_routing_rules;
CREATE POLICY "routing_rules_admin_all" ON channel_routing_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- ticket_notifications
DROP POLICY IF EXISTS "ticket_notifications_self_read" ON ticket_notifications;
CREATE POLICY "ticket_notifications_self_read" ON ticket_notifications
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ticket_notifications_self_update" ON ticket_notifications;
CREATE POLICY "ticket_notifications_self_update" ON ticket_notifications
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- sla_policies
DROP POLICY IF EXISTS "sla_policies_staff_read" ON sla_policies;
CREATE POLICY "sla_policies_staff_read" ON sla_policies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_policies_admin_all" ON sla_policies;
CREATE POLICY "sla_policies_admin_all" ON sla_policies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_policies_admin_manage" ON sla_policies;
CREATE POLICY "sla_policies_admin_manage" ON sla_policies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- ticket_status_history
DROP POLICY IF EXISTS "ticket_status_history_view" ON ticket_status_history;
CREATE POLICY "ticket_status_history_view" ON ticket_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_status_history.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assigned_to = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

-- business_hours
DROP POLICY IF EXISTS "business_hours_staff_read" ON business_hours;
CREATE POLICY "business_hours_staff_read" ON business_hours
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "business_hours_admin_all" ON business_hours;
CREATE POLICY "business_hours_admin_all" ON business_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- holidays
DROP POLICY IF EXISTS "holidays_admin_all" ON holidays;
CREATE POLICY "holidays_admin_all" ON holidays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- sla_escalations
DROP POLICY IF EXISTS "sla_escalations_staff_read" ON sla_escalations;
CREATE POLICY "sla_escalations_staff_read" ON sla_escalations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_escalations_admin_all" ON sla_escalations;
CREATE POLICY "sla_escalations_admin_all" ON sla_escalations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- sla_events
DROP POLICY IF EXISTS "sla_events_staff_read" ON sla_events;
CREATE POLICY "sla_events_staff_read" ON sla_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- teams
DROP POLICY IF EXISTS "teams_staff_read" ON teams;
CREATE POLICY "teams_staff_read" ON teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "teams_admin_manage" ON teams;
CREATE POLICY "teams_admin_manage" ON teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- services
DROP POLICY IF EXISTS "services_admin_manage" ON services;
CREATE POLICY "services_admin_manage" ON services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- sla_timers
DROP POLICY IF EXISTS "sla_timers_staff_read" ON sla_timers;
CREATE POLICY "sla_timers_staff_read" ON sla_timers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- catalog_categories
DROP POLICY IF EXISTS "catalog_categories_admin_manage" ON catalog_categories;
CREATE POLICY "catalog_categories_admin_manage" ON catalog_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- catalog_items
DROP POLICY IF EXISTS "catalog_items_admin_manage" ON catalog_items;
CREATE POLICY "catalog_items_admin_manage" ON catalog_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- requests
DROP POLICY IF EXISTS "requests_own_read" ON requests;
CREATE POLICY "requests_own_read" ON requests
  FOR SELECT USING (requester_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "requests_own_insert" ON requests;
CREATE POLICY "requests_own_insert" ON requests
  FOR INSERT WITH CHECK (requester_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "requests_staff_manage" ON requests;
CREATE POLICY "requests_staff_manage" ON requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- request_approvals
DROP POLICY IF EXISTS "request_approvals_read" ON request_approvals;
CREATE POLICY "request_approvals_read" ON request_approvals
  FOR SELECT USING (
    approver_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "request_approvals_update" ON request_approvals;
CREATE POLICY "request_approvals_update" ON request_approvals
  FOR UPDATE USING (approver_id = (SELECT auth.uid()));

-- problems
DROP POLICY IF EXISTS "problems_staff_access" ON problems;
CREATE POLICY "problems_staff_access" ON problems
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- problem_tickets
DROP POLICY IF EXISTS "problem_tickets_staff_access" ON problem_tickets;
CREATE POLICY "problem_tickets_staff_access" ON problem_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- changes
DROP POLICY IF EXISTS "changes_staff_access" ON changes;
CREATE POLICY "changes_staff_access" ON changes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- change_approvals
DROP POLICY IF EXISTS "change_approvals_read" ON change_approvals;
CREATE POLICY "change_approvals_read" ON change_approvals
  FOR SELECT USING (
    approver_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "change_approvals_update" ON change_approvals;
CREATE POLICY "change_approvals_update" ON change_approvals
  FOR UPDATE USING (approver_id = (SELECT auth.uid()));

-- cmdb_ci
DROP POLICY IF EXISTS "cmdb_ci_staff_read" ON cmdb_ci;
CREATE POLICY "cmdb_ci_staff_read" ON cmdb_ci
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "cmdb_ci_it_manage" ON cmdb_ci;
CREATE POLICY "cmdb_ci_it_manage" ON cmdb_ci
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'admin', 'super_admin')
    )
  );

-- ci_relationships
DROP POLICY IF EXISTS "ci_relationships_staff_read" ON ci_relationships;
CREATE POLICY "ci_relationships_staff_read" ON ci_relationships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- assets
DROP POLICY IF EXISTS "assets_staff_read" ON assets;
CREATE POLICY "assets_staff_read" ON assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "assets_it_manage" ON assets;
CREATE POLICY "assets_it_manage" ON assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'admin', 'super_admin')
    )
  );

-- asset_assignments
DROP POLICY IF EXISTS "asset_assignments_read" ON asset_assignments;
CREATE POLICY "asset_assignments_read" ON asset_assignments
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'admin', 'super_admin')
    )
  );

-- workflows
DROP POLICY IF EXISTS "workflows_admin_access" ON workflows;
CREATE POLICY "workflows_admin_access" ON workflows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- workflow_steps
DROP POLICY IF EXISTS "workflow_steps_admin_access" ON workflow_steps;
CREATE POLICY "workflow_steps_admin_access" ON workflow_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- workflow_executions
DROP POLICY IF EXISTS "workflow_executions_admin_read" ON workflow_executions;
CREATE POLICY "workflow_executions_admin_read" ON workflow_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- metrics_daily
DROP POLICY IF EXISTS "metrics_staff_read" ON metrics_daily;
CREATE POLICY "metrics_staff_read" ON metrics_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- ticket_events
DROP POLICY IF EXISTS "ticket_events_access" ON ticket_events;
CREATE POLICY "ticket_events_access" ON ticket_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_events.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assigned_to = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

-- ticket_files
DROP POLICY IF EXISTS "ticket_files_read" ON ticket_files;
CREATE POLICY "ticket_files_read" ON ticket_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_files.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assigned_to = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

-- ticket_watchers (additional policies)
DROP POLICY IF EXISTS "ticket_watchers_view_accessible" ON ticket_watchers;
CREATE POLICY "ticket_watchers_view_accessible" ON ticket_watchers
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "ticket_watchers_insert" ON ticket_watchers;
CREATE POLICY "ticket_watchers_insert" ON ticket_watchers
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- canned_responses
DROP POLICY IF EXISTS "canned_responses_staff_read" ON canned_responses;
CREATE POLICY "canned_responses_staff_read" ON canned_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "canned_responses_staff_all" ON canned_responses;
CREATE POLICY "canned_responses_staff_all" ON canned_responses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- workflow_queue
DROP POLICY IF EXISTS "workflow_queue_admin_access" ON workflow_queue;
CREATE POLICY "workflow_queue_admin_access" ON workflow_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- sla_metrics
DROP POLICY IF EXISTS "sla_metrics_view_all" ON sla_metrics;
CREATE POLICY "sla_metrics_view_all" ON sla_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_metrics_system_insert" ON sla_metrics;
CREATE POLICY "sla_metrics_system_insert" ON sla_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_metrics_system_update" ON sla_metrics;
CREATE POLICY "sla_metrics_system_update" ON sla_metrics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- team_meetings
DROP POLICY IF EXISTS "Staff can view all meetings" ON team_meetings;
CREATE POLICY "Staff can view all meetings" ON team_meetings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Staff can create meetings" ON team_meetings;
CREATE POLICY "Staff can create meetings" ON team_meetings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Meeting creators can update their meetings" ON team_meetings;
CREATE POLICY "Meeting creators can update their meetings" ON team_meetings
  FOR UPDATE USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Meeting creators can delete their meetings" ON team_meetings;
CREATE POLICY "Meeting creators can delete their meetings" ON team_meetings
  FOR DELETE USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- meeting_participants
DROP POLICY IF EXISTS "Staff can view meeting participants" ON meeting_participants;
CREATE POLICY "Staff can view meeting participants" ON meeting_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Meeting creators can add participants" ON meeting_participants;
CREATE POLICY "Meeting creators can add participants" ON meeting_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_meetings tm
      WHERE tm.id = meeting_participants.meeting_id
      AND (
        tm.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('admin', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own participation status" ON meeting_participants;
CREATE POLICY "Users can update their own participation status" ON meeting_participants
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- team_announcements
DROP POLICY IF EXISTS "Staff can view announcements for their role" ON team_announcements;
CREATE POLICY "Staff can view announcements for their role" ON team_announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND (
        target_role IS NULL
        OR p.role = target_role
        OR p.role IN ('admin', 'super_admin')
      )
    )
  );

DROP POLICY IF EXISTS "Admins can create announcements" ON team_announcements;
CREATE POLICY "Admins can create announcements" ON team_announcements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update announcements" ON team_announcements;
CREATE POLICY "Admins can update announcements" ON team_announcements
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete announcements" ON team_announcements;
CREATE POLICY "Admins can delete announcements" ON team_announcements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- announcement_reads
DROP POLICY IF EXISTS "Users can view their own reads" ON announcement_reads;
CREATE POLICY "Users can view their own reads" ON announcement_reads
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can mark announcements as read" ON announcement_reads;
CREATE POLICY "Users can mark announcements as read" ON announcement_reads
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- team_presence
DROP POLICY IF EXISTS "Staff can view team presence" ON team_presence;
CREATE POLICY "Staff can view team presence" ON team_presence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Users can update their own presence" ON team_presence;
CREATE POLICY "Users can update their own presence" ON team_presence
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own presence status" ON team_presence;
CREATE POLICY "Users can update their own presence status" ON team_presence
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- team_activities
DROP POLICY IF EXISTS "Staff can view team activities" ON team_activities;
CREATE POLICY "Staff can view team activities" ON team_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- chat_quick_responses
DROP POLICY IF EXISTS "quick_responses_agent_read" ON chat_quick_responses;
CREATE POLICY "quick_responses_agent_read" ON chat_quick_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "quick_responses_agent_insert" ON chat_quick_responses;
CREATE POLICY "quick_responses_agent_insert" ON chat_quick_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "quick_responses_creator_update" ON chat_quick_responses;
CREATE POLICY "quick_responses_creator_update" ON chat_quick_responses
  FOR UPDATE USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "quick_responses_creator_delete" ON chat_quick_responses;
CREATE POLICY "quick_responses_creator_delete" ON chat_quick_responses
  FOR DELETE USING (created_by = (SELECT auth.uid()));

-- agent_chat_preferences
DROP POLICY IF EXISTS "chat_prefs_agent_all" ON agent_chat_preferences;
CREATE POLICY "chat_prefs_agent_all" ON agent_chat_preferences
  FOR ALL USING (
    agent_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "chat_prefs_admin_read" ON agent_chat_preferences;
CREATE POLICY "chat_prefs_admin_read" ON agent_chat_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- chat_session_notes
DROP POLICY IF EXISTS "session_notes_agent_read" ON chat_session_notes;
CREATE POLICY "session_notes_agent_read" ON chat_session_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "session_notes_agent_insert" ON chat_session_notes;
CREATE POLICY "session_notes_agent_insert" ON chat_session_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

-- system_health_logs
DROP POLICY IF EXISTS "Super admins and admins can read health logs" ON system_health_logs;
CREATE POLICY "Super admins and admins can read health logs" ON system_health_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- system_metrics
DROP POLICY IF EXISTS "Super admins and admins can read metrics" ON system_metrics;
CREATE POLICY "Super admins and admins can read metrics" ON system_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- system_incidents
DROP POLICY IF EXISTS "Super admins and admins can read incidents" ON system_incidents;
CREATE POLICY "Super admins and admins can read incidents" ON system_incidents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Super admins and admins can create incidents" ON system_incidents;
CREATE POLICY "Super admins and admins can create incidents" ON system_incidents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Super admins and admins can update incidents" ON system_incidents;
CREATE POLICY "Super admins and admins can update incidents" ON system_incidents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- system_alerts
DROP POLICY IF EXISTS "Super admins and admins can manage alerts" ON system_alerts;
CREATE POLICY "Super admins and admins can manage alerts" ON system_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );
