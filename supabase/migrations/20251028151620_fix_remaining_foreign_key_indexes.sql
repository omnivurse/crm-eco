/*
  # Add Missing Foreign Key Indexes - Part 2
  
  1. Performance Optimization
    - Adds indexes for all remaining unindexed foreign keys
    - Improves JOIN performance and referential integrity checks
    - Covers tables: asset_assignments, canned_responses, catalog_categories, 
      change_approvals, change_tasks, changes, channel_messages, chat_quick_responses,
      chat_sessions, kb_articles, problems, reminders, request_approvals, request_tasks,
      requests, sla_events, sla_metrics, staff_log_*, system_*, team_*, ticket_*, workflows
  
  2. Security Enhancement
    - Eliminates performance bottlenecks in foreign key lookups
    - Prevents slow queries that could lead to timeout vulnerabilities
*/

-- Asset Management Indexes
CREATE INDEX IF NOT EXISTS idx_asset_assignments_assigned_by 
  ON asset_assignments(assigned_by);

-- Canned Responses
CREATE INDEX IF NOT EXISTS idx_canned_responses_created_by 
  ON canned_responses(created_by);

-- Catalog Categories
CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent_id 
  ON catalog_categories(parent_id);

-- Change Management
CREATE INDEX IF NOT EXISTS idx_change_approvals_approver_id 
  ON change_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_change_approvals_change_id 
  ON change_approvals(change_id);
CREATE INDEX IF NOT EXISTS idx_change_tasks_assigned_to 
  ON change_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_change_tasks_change_id 
  ON change_tasks(change_id);
CREATE INDEX IF NOT EXISTS idx_changes_affected_service_id 
  ON changes(affected_service_id);
CREATE INDEX IF NOT EXISTS idx_changes_requester_id 
  ON changes(requester_id);

-- Channel and Chat
CREATE INDEX IF NOT EXISTS idx_channel_messages_sender_id 
  ON channel_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_quick_responses_created_by 
  ON chat_quick_responses(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_ticket_id 
  ON chat_sessions(ticket_id);

-- Knowledge Base
CREATE INDEX IF NOT EXISTS idx_kb_articles_created_by 
  ON kb_articles(created_by);

-- Problems
CREATE INDEX IF NOT EXISTS idx_problems_assigned_team_id 
  ON problems(assigned_team_id);

-- Reminders
CREATE INDEX IF NOT EXISTS idx_reminders_ticket_id 
  ON reminders(ticket_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id 
  ON reminders(user_id);

-- Request Management
CREATE INDEX IF NOT EXISTS idx_request_approvals_approver_id 
  ON request_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_request_approvals_request_id 
  ON request_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_request_tasks_assigned_to 
  ON request_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_request_tasks_request_id 
  ON request_tasks(request_id);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to 
  ON requests(assigned_to);

-- SLA Management
CREATE INDEX IF NOT EXISTS idx_sla_events_sla_policy_id 
  ON sla_events(sla_policy_id);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_first_response_by 
  ON sla_metrics(first_response_by);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_resolved_by 
  ON sla_metrics(resolved_by);

-- Staff Logs
CREATE INDEX IF NOT EXISTS idx_staff_log_assignments_assigned_by 
  ON staff_log_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_staff_log_attachments_previous_version_id 
  ON staff_log_attachments(previous_version_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_attachments_uploaded_by 
  ON staff_log_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_staff_log_notifications_comment_id 
  ON staff_log_notifications(comment_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_notifications_log_id 
  ON staff_log_notifications(log_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_shares_created_by 
  ON staff_log_shares(created_by);
CREATE INDEX IF NOT EXISTS idx_staff_log_shares_log_id 
  ON staff_log_shares(log_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_templates_created_by 
  ON staff_log_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_staff_logs_last_modified_by 
  ON staff_logs(last_modified_by);
CREATE INDEX IF NOT EXISTS idx_staff_logs_parent_log_id 
  ON staff_logs(parent_log_id);

-- System Management
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_by 
  ON system_alerts(created_by);
CREATE INDEX IF NOT EXISTS idx_system_incidents_acknowledged_by 
  ON system_incidents(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_system_incidents_resolved_by 
  ON system_incidents(resolved_by);

-- Team Collaboration
CREATE INDEX IF NOT EXISTS idx_team_announcements_created_by 
  ON team_announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_team_meetings_created_by 
  ON team_meetings(created_by);

-- Ticket Management
CREATE INDEX IF NOT EXISTS idx_ticket_actions_actor_id 
  ON ticket_actions(actor_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id 
  ON ticket_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_ticket_events_actor_id 
  ON ticket_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_ticket_files_uploaded_by 
  ON ticket_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_changed_by 
  ON ticket_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_tickets_service_id 
  ON tickets(service_id);
CREATE INDEX IF NOT EXISTS idx_tickets_submitted_by_concierge 
  ON tickets(submitted_by_concierge);

-- Workflows
CREATE INDEX IF NOT EXISTS idx_workflows_created_by 
  ON workflows(created_by);