/*
  # Add Remaining Foreign Key Indexes

  1. Purpose
    - Add indexes to all remaining unindexed foreign key columns
    - Improve JOIN performance across all ServiceOps tables
    - Prevent performance degradation from missing indexes

  2. Tables Updated
    - asset_assignments: assigned_by
    - canned_responses: created_by
    - catalog_categories: parent_id
    - change_approvals: approver_id, change_id
    - change_tasks: assigned_to, change_id
    - changes: affected_service_id, requester_id
    - channel_messages: sender_id
    - chat_quick_responses: created_by
    - chat_sessions: ticket_id
    - kb_articles: created_by
    - problems: assigned_team_id
    - reminders: ticket_id, user_id
    - request_approvals: approver_id, request_id
    - request_tasks: assigned_to, request_id
    - requests: assigned_to
    - sla_events: sla_policy_id
    - sla_metrics: first_response_by, resolved_by
    - staff_log_assignments: assigned_by
    - staff_log_attachments: previous_version_id, uploaded_by
    - staff_log_notifications: comment_id, log_id
    - staff_log_shares: created_by, log_id
    - staff_log_templates: created_by
    - staff_logs: last_modified_by, parent_log_id
    - system_alerts: created_by
    - system_incidents: acknowledged_by, resolved_by
    - team_announcements: created_by
    - team_meetings: created_by
    - ticket_actions: actor_id
    - ticket_comments: author_id
    - ticket_events: actor_id
    - ticket_files: uploaded_by
    - ticket_status_history: changed_by
    - tickets: service_id, submitted_by_concierge
    - workflows: created_by

  3. Performance Impact
    - Essential for optimal query performance at scale
    - Reduces full table scans on foreign key lookups
    - Improves constraint validation performance
*/

-- asset_assignments
CREATE INDEX IF NOT EXISTS idx_asset_assignments_assigned_by ON asset_assignments(assigned_by);

-- canned_responses
CREATE INDEX IF NOT EXISTS idx_canned_responses_created_by ON canned_responses(created_by);

-- catalog_categories
CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent_id ON catalog_categories(parent_id);

-- change_approvals
CREATE INDEX IF NOT EXISTS idx_change_approvals_approver_id ON change_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_change_approvals_change_id ON change_approvals(change_id);

-- change_tasks
CREATE INDEX IF NOT EXISTS idx_change_tasks_assigned_to ON change_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_change_tasks_change_id ON change_tasks(change_id);

-- changes
CREATE INDEX IF NOT EXISTS idx_changes_affected_service_id ON changes(affected_service_id);
CREATE INDEX IF NOT EXISTS idx_changes_requester_id ON changes(requester_id);

-- channel_messages
CREATE INDEX IF NOT EXISTS idx_channel_messages_sender_id ON channel_messages(sender_id);

-- chat_quick_responses
CREATE INDEX IF NOT EXISTS idx_chat_quick_responses_created_by ON chat_quick_responses(created_by);

-- chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_ticket_id ON chat_sessions(ticket_id);

-- kb_articles
CREATE INDEX IF NOT EXISTS idx_kb_articles_created_by ON kb_articles(created_by);

-- problems
CREATE INDEX IF NOT EXISTS idx_problems_assigned_team_id ON problems(assigned_team_id);

-- reminders
CREATE INDEX IF NOT EXISTS idx_reminders_ticket_id ON reminders(ticket_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);

-- request_approvals
CREATE INDEX IF NOT EXISTS idx_request_approvals_approver_id ON request_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_request_approvals_request_id ON request_approvals(request_id);

-- request_tasks
CREATE INDEX IF NOT EXISTS idx_request_tasks_assigned_to ON request_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_request_tasks_request_id ON request_tasks(request_id);

-- requests
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to);

-- sla_events
CREATE INDEX IF NOT EXISTS idx_sla_events_sla_policy_id ON sla_events(sla_policy_id);

-- sla_metrics
CREATE INDEX IF NOT EXISTS idx_sla_metrics_first_response_by ON sla_metrics(first_response_by);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_resolved_by ON sla_metrics(resolved_by);

-- staff_log_assignments
CREATE INDEX IF NOT EXISTS idx_staff_log_assignments_assigned_by ON staff_log_assignments(assigned_by);

-- staff_log_attachments
CREATE INDEX IF NOT EXISTS idx_staff_log_attachments_previous_version_id ON staff_log_attachments(previous_version_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_attachments_uploaded_by ON staff_log_attachments(uploaded_by);

-- staff_log_notifications
CREATE INDEX IF NOT EXISTS idx_staff_log_notifications_comment_id ON staff_log_notifications(comment_id);
CREATE INDEX IF NOT EXISTS idx_staff_log_notifications_log_id ON staff_log_notifications(log_id);

-- staff_log_shares
CREATE INDEX IF NOT EXISTS idx_staff_log_shares_created_by ON staff_log_shares(created_by);
CREATE INDEX IF NOT EXISTS idx_staff_log_shares_log_id ON staff_log_shares(log_id);

-- staff_log_templates
CREATE INDEX IF NOT EXISTS idx_staff_log_templates_created_by ON staff_log_templates(created_by);

-- staff_logs
CREATE INDEX IF NOT EXISTS idx_staff_logs_last_modified_by ON staff_logs(last_modified_by);
CREATE INDEX IF NOT EXISTS idx_staff_logs_parent_log_id ON staff_logs(parent_log_id);

-- system_alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_by ON system_alerts(created_by);

-- system_incidents
CREATE INDEX IF NOT EXISTS idx_system_incidents_acknowledged_by ON system_incidents(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_system_incidents_resolved_by ON system_incidents(resolved_by);

-- team_announcements
CREATE INDEX IF NOT EXISTS idx_team_announcements_created_by ON team_announcements(created_by);

-- team_meetings
CREATE INDEX IF NOT EXISTS idx_team_meetings_created_by ON team_meetings(created_by);

-- ticket_actions
CREATE INDEX IF NOT EXISTS idx_ticket_actions_actor_id ON ticket_actions(actor_id);

-- ticket_comments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON ticket_comments(author_id);

-- ticket_events
CREATE INDEX IF NOT EXISTS idx_ticket_events_actor_id ON ticket_events(actor_id);

-- ticket_files
CREATE INDEX IF NOT EXISTS idx_ticket_files_uploaded_by ON ticket_files(uploaded_by);

-- ticket_status_history
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_changed_by ON ticket_status_history(changed_by);

-- tickets
CREATE INDEX IF NOT EXISTS idx_tickets_service_id ON tickets(service_id);
CREATE INDEX IF NOT EXISTS idx_tickets_submitted_by_concierge ON tickets(submitted_by_concierge);

-- workflows
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);
