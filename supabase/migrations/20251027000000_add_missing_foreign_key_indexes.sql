/*
  # Add Missing Foreign Key Indexes

  1. Purpose
    - Add indexes to all foreign key columns to improve JOIN performance
    - Prevent performance degradation on tables with foreign key constraints
    - Optimize query execution plans for related data lookups

  2. Tables Updated
    - announcements: user_id
    - audit_logs: user_id, entity_id
    - change_tasks: change_id, assigned_to
    - chat_messages: session_id, sender_id
    - chat_sessions: user_id
    - daily_logs: user_id
    - files: owner_id, uploaded_by
    - integration_oauth_tokens: user_id, integration_id
    - integration_vault_links: user_id, integration_id
    - integrations: created_by
    - kb_article_attachments: article_id, uploaded_by
    - kb_article_feedback: article_id, user_id
    - kb_articles: author_id, category_id, approved_by
    - kb_categories: parent_id, created_by
    - meeting_attendees: meeting_id, user_id
    - meetings: organizer_id
    - notes: user_id, project_id
    - password_refs: user_id
    - problem_tasks: problem_id, assigned_to
    - problems: reporter_id, assigned_to
    - profiles: id
    - project_assignments: project_id, user_id, assigned_by
    - projects: owner_id, created_by
    - request_tasks: request_id, assigned_to
    - requests: requester_id, assigned_to, catalog_item_id
    - service_catalog_items: category_id, owner_id
    - sla_breach_logs: ticket_id, sla_config_id
    - sla_configs: created_by
    - staff_action_logs: staff_id, target_user_id, target_entity_id
    - task_assignments: task_id, user_id, assigned_by
    - tasks: project_id, created_by, assigned_to
    - team_members: team_id, user_id, invited_by
    - teams: created_by
    - ticket_attachments: ticket_id, uploaded_by
    - ticket_comments: ticket_id, author_id
    - tickets: requester_id, assigned_to, portal_id
    - workflow_executions: workflow_id, triggered_by
    - workflow_run_logs: execution_id
    - workflows: created_by

  3. Performance Impact
    - Dramatically improves JOIN query performance
    - Reduces table scan operations
    - Optimizes foreign key constraint validation
    - Essential for tables with high row counts

  4. Notes
    - All indexes use IF NOT EXISTS to prevent errors on re-run
    - Index names follow pattern: idx_{table}_{column}
    - Composite indexes may be needed in the future for specific query patterns
*/

-- Create helper function to safely add indexes to tables that may not exist
CREATE OR REPLACE FUNCTION safe_create_index(p_index_name text, p_table_name text, p_column_name text)
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table_name AND table_schema = 'public')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = p_table_name AND column_name = p_column_name AND table_schema = 'public') THEN
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(%I)', p_index_name, p_table_name, p_column_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create all indexes (safely - only if table and column exist)
SELECT safe_create_index('idx_announcements_user_id', 'announcements', 'user_id');
SELECT safe_create_index('idx_audit_logs_user_id', 'audit_logs', 'user_id');
SELECT safe_create_index('idx_audit_logs_entity_id', 'audit_logs', 'entity_id');
SELECT safe_create_index('idx_change_tasks_change_id', 'change_tasks', 'change_id');
SELECT safe_create_index('idx_change_tasks_assigned_to', 'change_tasks', 'assigned_to');
SELECT safe_create_index('idx_chat_messages_session_id', 'chat_messages', 'session_id');
SELECT safe_create_index('idx_chat_messages_sender_id', 'chat_messages', 'sender_id');
SELECT safe_create_index('idx_chat_sessions_user_id', 'chat_sessions', 'user_id');
SELECT safe_create_index('idx_daily_logs_user_id', 'daily_logs', 'user_id');
SELECT safe_create_index('idx_files_owner_id', 'files', 'owner_id');
SELECT safe_create_index('idx_files_uploaded_by', 'files', 'uploaded_by');
SELECT safe_create_index('idx_integration_oauth_tokens_user_id', 'integration_oauth_tokens', 'user_id');
SELECT safe_create_index('idx_integration_oauth_tokens_integration_id', 'integration_oauth_tokens', 'integration_id');
SELECT safe_create_index('idx_integration_vault_links_user_id', 'integration_vault_links', 'user_id');
SELECT safe_create_index('idx_integration_vault_links_integration_id', 'integration_vault_links', 'integration_id');
SELECT safe_create_index('idx_integrations_created_by', 'integrations', 'created_by');
SELECT safe_create_index('idx_kb_article_attachments_article_id', 'kb_article_attachments', 'article_id');
SELECT safe_create_index('idx_kb_article_attachments_uploaded_by', 'kb_article_attachments', 'uploaded_by');
SELECT safe_create_index('idx_kb_article_feedback_article_id', 'kb_article_feedback', 'article_id');
SELECT safe_create_index('idx_kb_article_feedback_user_id', 'kb_article_feedback', 'user_id');
SELECT safe_create_index('idx_kb_articles_author_id', 'kb_articles', 'author_id');
SELECT safe_create_index('idx_kb_articles_category_id', 'kb_articles', 'category_id');
SELECT safe_create_index('idx_kb_articles_approved_by', 'kb_articles', 'approved_by');
SELECT safe_create_index('idx_kb_categories_parent_id', 'kb_categories', 'parent_id');
SELECT safe_create_index('idx_kb_categories_created_by', 'kb_categories', 'created_by');
SELECT safe_create_index('idx_meeting_attendees_meeting_id', 'meeting_attendees', 'meeting_id');
SELECT safe_create_index('idx_meeting_attendees_user_id', 'meeting_attendees', 'user_id');
SELECT safe_create_index('idx_meetings_organizer_id', 'meetings', 'organizer_id');
SELECT safe_create_index('idx_notes_user_id', 'notes', 'user_id');
SELECT safe_create_index('idx_notes_project_id', 'notes', 'project_id');
SELECT safe_create_index('idx_password_refs_user_id', 'password_refs', 'user_id');
SELECT safe_create_index('idx_problem_tasks_problem_id', 'problem_tasks', 'problem_id');
SELECT safe_create_index('idx_problem_tasks_assigned_to', 'problem_tasks', 'assigned_to');
SELECT safe_create_index('idx_problems_reporter_id', 'problems', 'reporter_id');
SELECT safe_create_index('idx_problems_assigned_to', 'problems', 'assigned_to');
SELECT safe_create_index('idx_profiles_id', 'profiles', 'id');
SELECT safe_create_index('idx_project_assignments_project_id', 'project_assignments', 'project_id');
SELECT safe_create_index('idx_project_assignments_user_id', 'project_assignments', 'user_id');
SELECT safe_create_index('idx_project_assignments_assigned_by', 'project_assignments', 'assigned_by');
SELECT safe_create_index('idx_projects_owner_id', 'projects', 'owner_id');
SELECT safe_create_index('idx_projects_created_by', 'projects', 'created_by');
SELECT safe_create_index('idx_request_tasks_request_id', 'request_tasks', 'request_id');
SELECT safe_create_index('idx_request_tasks_assigned_to', 'request_tasks', 'assigned_to');
SELECT safe_create_index('idx_requests_requester_id', 'requests', 'requester_id');
SELECT safe_create_index('idx_requests_assigned_to', 'requests', 'assigned_to');
SELECT safe_create_index('idx_requests_catalog_item_id', 'requests', 'catalog_item_id');
SELECT safe_create_index('idx_service_catalog_items_category_id', 'service_catalog_items', 'category_id');
SELECT safe_create_index('idx_service_catalog_items_owner_id', 'service_catalog_items', 'owner_id');
SELECT safe_create_index('idx_sla_breach_logs_ticket_id', 'sla_breach_logs', 'ticket_id');
SELECT safe_create_index('idx_sla_breach_logs_sla_config_id', 'sla_breach_logs', 'sla_config_id');
SELECT safe_create_index('idx_sla_configs_created_by', 'sla_configs', 'created_by');
SELECT safe_create_index('idx_staff_action_logs_staff_id', 'staff_action_logs', 'staff_id');
SELECT safe_create_index('idx_staff_action_logs_target_user_id', 'staff_action_logs', 'target_user_id');
SELECT safe_create_index('idx_staff_action_logs_target_entity_id', 'staff_action_logs', 'target_entity_id');
SELECT safe_create_index('idx_task_assignments_task_id', 'task_assignments', 'task_id');
SELECT safe_create_index('idx_task_assignments_user_id', 'task_assignments', 'user_id');
SELECT safe_create_index('idx_task_assignments_assigned_by', 'task_assignments', 'assigned_by');
SELECT safe_create_index('idx_tasks_project_id', 'tasks', 'project_id');
SELECT safe_create_index('idx_tasks_created_by', 'tasks', 'created_by');
SELECT safe_create_index('idx_tasks_assigned_to', 'tasks', 'assigned_to');
SELECT safe_create_index('idx_team_members_team_id', 'team_members', 'team_id');
SELECT safe_create_index('idx_team_members_user_id', 'team_members', 'user_id');
SELECT safe_create_index('idx_team_members_invited_by', 'team_members', 'invited_by');
SELECT safe_create_index('idx_teams_created_by', 'teams', 'created_by');
SELECT safe_create_index('idx_ticket_attachments_ticket_id', 'ticket_attachments', 'ticket_id');
SELECT safe_create_index('idx_ticket_attachments_uploaded_by', 'ticket_attachments', 'uploaded_by');
SELECT safe_create_index('idx_ticket_comments_ticket_id', 'ticket_comments', 'ticket_id');
SELECT safe_create_index('idx_ticket_comments_author_id', 'ticket_comments', 'author_id');
SELECT safe_create_index('idx_tickets_requester_id', 'tickets', 'requester_id');
SELECT safe_create_index('idx_tickets_assigned_to', 'tickets', 'assigned_to');
SELECT safe_create_index('idx_tickets_portal_id', 'tickets', 'portal_id');
SELECT safe_create_index('idx_workflow_executions_workflow_id', 'workflow_executions', 'workflow_id');
SELECT safe_create_index('idx_workflow_executions_triggered_by', 'workflow_executions', 'triggered_by');
SELECT safe_create_index('idx_workflow_run_logs_execution_id', 'workflow_run_logs', 'execution_id');
SELECT safe_create_index('idx_workflows_created_by', 'workflows', 'created_by');

-- Clean up helper function (optional)
DROP FUNCTION IF EXISTS safe_create_index(text, text, text);
