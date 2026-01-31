/*
  # Add Remaining Foreign Key Indexes (Safe Version)

  1. Purpose
    - Add indexes to all remaining unindexed foreign key columns
    - Only adds indexes if both table and column exist
    - Prevents errors on missing objects
*/

-- Create helper function to safely add indexes to tables that may not exist
CREATE OR REPLACE FUNCTION safe_create_index_v2(p_index_name text, p_table_name text, p_column_name text)
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table_name AND table_schema = 'public')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = p_table_name AND column_name = p_column_name AND table_schema = 'public') THEN
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(%I)', p_index_name, p_table_name, p_column_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- asset_assignments
SELECT safe_create_index_v2('idx_asset_assignments_assigned_by', 'asset_assignments', 'assigned_by');

-- canned_responses
SELECT safe_create_index_v2('idx_canned_responses_created_by', 'canned_responses', 'created_by');

-- catalog_categories
SELECT safe_create_index_v2('idx_catalog_categories_parent_id', 'catalog_categories', 'parent_id');

-- change_approvals
SELECT safe_create_index_v2('idx_change_approvals_approver_id', 'change_approvals', 'approver_id');
SELECT safe_create_index_v2('idx_change_approvals_change_id', 'change_approvals', 'change_id');

-- change_tasks
SELECT safe_create_index_v2('idx_change_tasks_assigned_to', 'change_tasks', 'assigned_to');
SELECT safe_create_index_v2('idx_change_tasks_change_id', 'change_tasks', 'change_id');

-- changes
SELECT safe_create_index_v2('idx_changes_affected_service_id', 'changes', 'affected_service_id');
SELECT safe_create_index_v2('idx_changes_requester_id', 'changes', 'requester_id');

-- channel_messages
SELECT safe_create_index_v2('idx_channel_messages_sender_id', 'channel_messages', 'sender_id');

-- chat_quick_responses
SELECT safe_create_index_v2('idx_chat_quick_responses_created_by', 'chat_quick_responses', 'created_by');

-- chat_sessions
SELECT safe_create_index_v2('idx_chat_sessions_ticket_id', 'chat_sessions', 'ticket_id');

-- kb_articles
SELECT safe_create_index_v2('idx_kb_articles_created_by', 'kb_articles', 'created_by');

-- problems
SELECT safe_create_index_v2('idx_problems_assigned_team_id', 'problems', 'assigned_team_id');

-- reminders
SELECT safe_create_index_v2('idx_reminders_ticket_id', 'reminders', 'ticket_id');
SELECT safe_create_index_v2('idx_reminders_user_id', 'reminders', 'user_id');

-- request_approvals
SELECT safe_create_index_v2('idx_request_approvals_approver_id', 'request_approvals', 'approver_id');
SELECT safe_create_index_v2('idx_request_approvals_request_id', 'request_approvals', 'request_id');

-- request_tasks
SELECT safe_create_index_v2('idx_request_tasks_assigned_to', 'request_tasks', 'assigned_to');
SELECT safe_create_index_v2('idx_request_tasks_request_id', 'request_tasks', 'request_id');

-- requests
SELECT safe_create_index_v2('idx_requests_assigned_to', 'requests', 'assigned_to');

-- sla_events
SELECT safe_create_index_v2('idx_sla_events_sla_policy_id', 'sla_events', 'sla_policy_id');

-- sla_metrics
SELECT safe_create_index_v2('idx_sla_metrics_first_response_by', 'sla_metrics', 'first_response_by');
SELECT safe_create_index_v2('idx_sla_metrics_resolved_by', 'sla_metrics', 'resolved_by');

-- staff_log_assignments
SELECT safe_create_index_v2('idx_staff_log_assignments_assigned_by', 'staff_log_assignments', 'assigned_by');

-- staff_log_attachments
SELECT safe_create_index_v2('idx_staff_log_attachments_previous_version_id', 'staff_log_attachments', 'previous_version_id');
SELECT safe_create_index_v2('idx_staff_log_attachments_uploaded_by', 'staff_log_attachments', 'uploaded_by');

-- staff_log_notifications
SELECT safe_create_index_v2('idx_staff_log_notifications_comment_id', 'staff_log_notifications', 'comment_id');
SELECT safe_create_index_v2('idx_staff_log_notifications_log_id', 'staff_log_notifications', 'log_id');

-- staff_log_shares
SELECT safe_create_index_v2('idx_staff_log_shares_created_by', 'staff_log_shares', 'created_by');
SELECT safe_create_index_v2('idx_staff_log_shares_log_id', 'staff_log_shares', 'log_id');

-- staff_log_templates
SELECT safe_create_index_v2('idx_staff_log_templates_created_by', 'staff_log_templates', 'created_by');

-- staff_logs
SELECT safe_create_index_v2('idx_staff_logs_last_modified_by', 'staff_logs', 'last_modified_by');
SELECT safe_create_index_v2('idx_staff_logs_parent_log_id', 'staff_logs', 'parent_log_id');

-- system_alerts
SELECT safe_create_index_v2('idx_system_alerts_created_by', 'system_alerts', 'created_by');

-- system_incidents
SELECT safe_create_index_v2('idx_system_incidents_acknowledged_by', 'system_incidents', 'acknowledged_by');
SELECT safe_create_index_v2('idx_system_incidents_resolved_by', 'system_incidents', 'resolved_by');

-- team_announcements
SELECT safe_create_index_v2('idx_team_announcements_created_by', 'team_announcements', 'created_by');

-- team_meetings
SELECT safe_create_index_v2('idx_team_meetings_created_by', 'team_meetings', 'created_by');

-- ticket_actions
SELECT safe_create_index_v2('idx_ticket_actions_actor_id', 'ticket_actions', 'actor_id');

-- ticket_comments
SELECT safe_create_index_v2('idx_ticket_comments_author_id', 'ticket_comments', 'author_id');

-- ticket_events
SELECT safe_create_index_v2('idx_ticket_events_actor_id', 'ticket_events', 'actor_id');

-- ticket_files
SELECT safe_create_index_v2('idx_ticket_files_uploaded_by', 'ticket_files', 'uploaded_by');

-- ticket_status_history
SELECT safe_create_index_v2('idx_ticket_status_history_changed_by', 'ticket_status_history', 'changed_by');

-- tickets
SELECT safe_create_index_v2('idx_tickets_service_id', 'tickets', 'service_id');
SELECT safe_create_index_v2('idx_tickets_submitted_by_concierge', 'tickets', 'submitted_by_concierge');

-- workflows
SELECT safe_create_index_v2('idx_workflows_created_by', 'workflows', 'created_by');

-- Clean up helper function
DROP FUNCTION IF EXISTS safe_create_index_v2(text, text, text);
