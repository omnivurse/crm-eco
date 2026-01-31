/*
  # Fix Function Search Paths for Security (Safe Version)

  1. Purpose
    - Set explicit search_path on all functions to prevent schema injection attacks
    - Only alters functions that exist

  2. Security Impact
    - Critical security fix for all database functions
    - Prevents privilege escalation attacks
*/

-- Helper function to safely set search_path on functions that exist
CREATE OR REPLACE FUNCTION safe_set_search_path(func_signature text)
RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', func_signature);
EXCEPTION
  WHEN undefined_function THEN NULL;
END;
$$ LANGUAGE plpgsql;

-- Set search_path for functions (only if they exist)
SELECT safe_set_search_path('get_agent_workload(uuid)');
SELECT safe_set_search_path('get_least_busy_agent(text)');
SELECT safe_set_search_path('trigger_workflows_for_event(text, jsonb)');
SELECT safe_set_search_path('notify_workflow_on_ticket_created()');
SELECT safe_set_search_path('notify_workflow_on_ticket_updated()');
SELECT safe_set_search_path('notify_workflow_on_request_submitted()');
SELECT safe_set_search_path('public.log_profile_role_change()');
SELECT safe_set_search_path('public.map_role_from_groups(text[])');
SELECT safe_set_search_path('public.apply_role_from_groups(uuid, text[])');
SELECT safe_set_search_path('public.sync_email_from_auth()');
SELECT safe_set_search_path('public.handle_new_user()');
SELECT safe_set_search_path('public.has_role(uuid, user_role)');
SELECT safe_set_search_path('public.role_rank(user_role)');
SELECT safe_set_search_path('public.role_at_least(uuid, user_role)');
SELECT safe_set_search_path('update_updated_at_column()');
SELECT safe_set_search_path('set_updated_at()');
SELECT safe_set_search_path('increment_quick_response_usage()');
SELECT safe_set_search_path('match_kb_docs(vector, double precision, int)');
SELECT safe_set_search_path('public.has_role(text)');
SELECT safe_set_search_path('public.match_knowledge_articles(vector, integer)');
SELECT safe_set_search_path('public.validate_free_text(text)');
SELECT safe_set_search_path('public.enforce_no_phi()');
SELECT safe_set_search_path('update_ticket_last_message()');
SELECT safe_set_search_path('track_ticket_status_change()');
SELECT safe_set_search_path('create_ticket_notification()');
SELECT safe_set_search_path('create_ticket_from_message()');
SELECT safe_set_search_path('sync_message_to_comment()');
SELECT safe_set_search_path('public.staff_logs_search_vector_update()');
SELECT safe_set_search_path('public.create_staff_log_notification(uuid, text, text)');
SELECT safe_set_search_path('public.notify_staff_log_assignment()');
SELECT safe_set_search_path('public.notify_staff_log_mentions()');
SELECT safe_set_search_path('public.notify_staff_log_status_change()');
SELECT safe_set_search_path('public.audit_staff_log_changes()');
SELECT safe_set_search_path('public.insert_audit_log(text, text, uuid, text, jsonb, jsonb)');
SELECT safe_set_search_path('public.encrypt_token(text, text)');
SELECT safe_set_search_path('public.decrypt_token(text, text)');
SELECT safe_set_search_path('match_sla_policy(jsonb)');
SELECT safe_set_search_path('apply_sla_to_ticket()');
SELECT safe_set_search_path('public.calculate_sla_metrics(uuid)');
SELECT safe_set_search_path('public.trigger_calculate_sla_metrics()');
SELECT safe_set_search_path('public.trigger_calculate_sla_on_comment()');
SELECT safe_set_search_path('public.get_sla_compliance_percentage(timestamp with time zone, timestamp with time zone)');
SELECT safe_set_search_path('public.get_agent_sla_performance(uuid, timestamp with time zone, timestamp with time zone)');
SELECT safe_set_search_path('update_user_presence()');
SELECT safe_set_search_path('cleanup_stale_presence()');
SELECT safe_set_search_path('bump_knowledge_version()');
SELECT safe_set_search_path('calculate_system_uptime(text, timestamp with time zone, timestamp with time zone)');
SELECT safe_set_search_path('get_system_health_trends(text, timestamp with time zone, timestamp with time zone)');
SELECT safe_set_search_path('cleanup_old_health_logs()');
SELECT safe_set_search_path('get_component_status_summary()');
SELECT safe_set_search_path('update_system_incidents_updated_at()');

-- Clean up helper function
DROP FUNCTION IF EXISTS safe_set_search_path(text);
