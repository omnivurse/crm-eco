/*
  # Fix Function Search Paths for Security

  1. Purpose
    - Set explicit search_path on all functions to prevent schema injection attacks
    - Ensures functions always reference the correct schema objects
    - Prevents malicious users from creating objects in other schemas to hijack function calls

  2. Security Impact
    - Critical security fix for all database functions
    - Prevents privilege escalation attacks
    - Ensures function behavior is predictable and secure

  3. Functions Updated
    - All functions without explicit SECURITY DEFINER or search_path settings
    - Sets search_path = pg_catalog, public for all functions

  4. Notes
    - This is a non-breaking change - functions will continue to work as expected
    - pg_catalog is included first to prevent shadowing of built-in functions
    - public schema is included second for application tables
*/

-- Set search_path for workflow functions
ALTER FUNCTION get_agent_workload(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION get_least_busy_agent(text) SET search_path = pg_catalog, public;
ALTER FUNCTION trigger_workflows_for_event(text, jsonb) SET search_path = pg_catalog, public;
ALTER FUNCTION notify_workflow_on_ticket_created() SET search_path = pg_catalog, public;
ALTER FUNCTION notify_workflow_on_ticket_updated() SET search_path = pg_catalog, public;
ALTER FUNCTION notify_workflow_on_request_submitted() SET search_path = pg_catalog, public;

-- Set search_path for auth/profile functions
ALTER FUNCTION public.log_profile_role_change() SET search_path = pg_catalog, public;
ALTER FUNCTION public.map_role_from_groups(text[]) SET search_path = pg_catalog, public;
ALTER FUNCTION public.apply_role_from_groups(uuid, text[]) SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_email_from_auth() SET search_path = pg_catalog, public;
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public;
ALTER FUNCTION public.has_role(uuid, user_role) SET search_path = pg_catalog, public;
ALTER FUNCTION public.role_rank(user_role) SET search_path = pg_catalog, public;
ALTER FUNCTION public.role_at_least(uuid, user_role) SET search_path = pg_catalog, public;

-- Set search_path for utility functions
ALTER FUNCTION update_updated_at_column() SET search_path = pg_catalog, public;
ALTER FUNCTION set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION increment_quick_response_usage() SET search_path = pg_catalog, public;

-- Set search_path for search/matching functions
ALTER FUNCTION match_kb_docs(vector, double precision, int) SET search_path = pg_catalog, public;
ALTER FUNCTION public.has_role(text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.match_knowledge_articles(vector, integer) SET search_path = pg_catalog, public;

-- Set search_path for validation functions
ALTER FUNCTION public.validate_free_text(text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.enforce_no_phi() SET search_path = pg_catalog, public;

-- Set search_path for ticket/messaging functions
ALTER FUNCTION update_ticket_last_message() SET search_path = pg_catalog, public;
ALTER FUNCTION track_ticket_status_change() SET search_path = pg_catalog, public;
ALTER FUNCTION create_ticket_notification() SET search_path = pg_catalog, public;
ALTER FUNCTION create_ticket_from_message() SET search_path = pg_catalog, public;
ALTER FUNCTION sync_message_to_comment() SET search_path = pg_catalog, public;

-- Set search_path for staff logs functions
ALTER FUNCTION public.staff_logs_search_vector_update() SET search_path = pg_catalog, public;
ALTER FUNCTION public.create_staff_log_notification(uuid, text, text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.notify_staff_log_assignment() SET search_path = pg_catalog, public;
ALTER FUNCTION public.notify_staff_log_mentions() SET search_path = pg_catalog, public;
ALTER FUNCTION public.notify_staff_log_status_change() SET search_path = pg_catalog, public;
ALTER FUNCTION public.audit_staff_log_changes() SET search_path = pg_catalog, public;

-- Set search_path for audit functions
ALTER FUNCTION public.insert_audit_log(text, text, uuid, text, jsonb, jsonb) SET search_path = pg_catalog, public;

-- Set search_path for encryption functions
ALTER FUNCTION public.encrypt_token(text, text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.decrypt_token(text, text) SET search_path = pg_catalog, public;

-- Set search_path for SLA functions
ALTER FUNCTION match_sla_policy(jsonb) SET search_path = pg_catalog, public;
ALTER FUNCTION apply_sla_to_ticket() SET search_path = pg_catalog, public;
ALTER FUNCTION public.calculate_sla_metrics(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.trigger_calculate_sla_metrics() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trigger_calculate_sla_on_comment() SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_sla_compliance_percentage(timestamp with time zone, timestamp with time zone) SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_agent_sla_performance(uuid, timestamp with time zone, timestamp with time zone) SET search_path = pg_catalog, public;

-- Set search_path for presence functions
ALTER FUNCTION update_user_presence() SET search_path = pg_catalog, public;
ALTER FUNCTION cleanup_stale_presence() SET search_path = pg_catalog, public;

-- Set search_path for knowledge functions
ALTER FUNCTION bump_knowledge_version() SET search_path = pg_catalog, public;

-- Set search_path for health monitoring functions
ALTER FUNCTION calculate_system_uptime(text, timestamp with time zone, timestamp with time zone) SET search_path = pg_catalog, public;
ALTER FUNCTION get_system_health_trends(text, timestamp with time zone, timestamp with time zone) SET search_path = pg_catalog, public;
ALTER FUNCTION cleanup_old_health_logs() SET search_path = pg_catalog, public;
ALTER FUNCTION get_component_status_summary() SET search_path = pg_catalog, public;
ALTER FUNCTION update_system_incidents_updated_at() SET search_path = pg_catalog, public;
