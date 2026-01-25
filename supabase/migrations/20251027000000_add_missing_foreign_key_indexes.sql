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

-- announcements
CREATE INDEX IF NOT EXISTS idx_announcements_user_id ON announcements(user_id);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);

-- change_tasks
CREATE INDEX IF NOT EXISTS idx_change_tasks_change_id ON change_tasks(change_id);
CREATE INDEX IF NOT EXISTS idx_change_tasks_assigned_to ON change_tasks(assigned_to);

-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);

-- chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- daily_logs
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);

-- files
CREATE INDEX IF NOT EXISTS idx_files_owner_id ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);

-- integration_oauth_tokens
CREATE INDEX IF NOT EXISTS idx_integration_oauth_tokens_user_id ON integration_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_oauth_tokens_integration_id ON integration_oauth_tokens(integration_id);

-- integration_vault_links
CREATE INDEX IF NOT EXISTS idx_integration_vault_links_user_id ON integration_vault_links(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_vault_links_integration_id ON integration_vault_links(integration_id);

-- integrations
CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by);

-- kb_article_attachments
CREATE INDEX IF NOT EXISTS idx_kb_article_attachments_article_id ON kb_article_attachments(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_attachments_uploaded_by ON kb_article_attachments(uploaded_by);

-- kb_article_feedback
CREATE INDEX IF NOT EXISTS idx_kb_article_feedback_article_id ON kb_article_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_feedback_user_id ON kb_article_feedback(user_id);

-- kb_articles
CREATE INDEX IF NOT EXISTS idx_kb_articles_author_id ON kb_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category_id ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_approved_by ON kb_articles(approved_by);

-- kb_categories
CREATE INDEX IF NOT EXISTS idx_kb_categories_parent_id ON kb_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_created_by ON kb_categories(created_by);

-- meeting_attendees
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting_id ON meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user_id ON meeting_attendees(user_id);

-- meetings
CREATE INDEX IF NOT EXISTS idx_meetings_organizer_id ON meetings(organizer_id);

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_project_id ON notes(project_id);

-- password_refs
CREATE INDEX IF NOT EXISTS idx_password_refs_user_id ON password_refs(user_id);

-- problem_tasks
CREATE INDEX IF NOT EXISTS idx_problem_tasks_problem_id ON problem_tasks(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_tasks_assigned_to ON problem_tasks(assigned_to);

-- problems
CREATE INDEX IF NOT EXISTS idx_problems_reporter_id ON problems(reporter_id);
CREATE INDEX IF NOT EXISTS idx_problems_assigned_to ON problems(assigned_to);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- project_assignments
CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_assigned_by ON project_assignments(assigned_by);

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- request_tasks
CREATE INDEX IF NOT EXISTS idx_request_tasks_request_id ON request_tasks(request_id);
CREATE INDEX IF NOT EXISTS idx_request_tasks_assigned_to ON request_tasks(assigned_to);

-- requests
CREATE INDEX IF NOT EXISTS idx_requests_requester_id ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_catalog_item_id ON requests(catalog_item_id);

-- service_catalog_items
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_category_id ON service_catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_owner_id ON service_catalog_items(owner_id);

-- sla_breach_logs
CREATE INDEX IF NOT EXISTS idx_sla_breach_logs_ticket_id ON sla_breach_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_breach_logs_sla_config_id ON sla_breach_logs(sla_config_id);

-- sla_configs
CREATE INDEX IF NOT EXISTS idx_sla_configs_created_by ON sla_configs(created_by);

-- staff_action_logs
CREATE INDEX IF NOT EXISTS idx_staff_action_logs_staff_id ON staff_action_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_action_logs_target_user_id ON staff_action_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_action_logs_target_entity_id ON staff_action_logs(target_entity_id);

-- task_assignments
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user_id ON task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON task_assignments(assigned_by);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- team_members
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_invited_by ON team_members(invited_by);

-- teams
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

-- ticket_attachments
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON ticket_attachments(uploaded_by);

-- ticket_comments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON ticket_comments(author_id);

-- tickets
CREATE INDEX IF NOT EXISTS idx_tickets_requester_id ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_portal_id ON tickets(portal_id);

-- workflow_executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_triggered_by ON workflow_executions(triggered_by);

-- workflow_run_logs
CREATE INDEX IF NOT EXISTS idx_workflow_run_logs_execution_id ON workflow_run_logs(execution_id);

-- workflows
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);
