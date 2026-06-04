-- =============================================================================
-- 1. Safe phone-number lookup RPC for Twilio inbound webhook
--    Uses parameterized queries to prevent PostgREST filter injection.
--    Returns at most 1 record (the first match found).
-- =============================================================================
CREATE OR REPLACE FUNCTION find_record_by_phone(
  phone_raw text,
  phone_normalized text
)
RETURNS TABLE(id uuid, org_id uuid, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try indexed phone column first (exact match)
  RETURN QUERY
    SELECT r.id, r.org_id, r.phone
    FROM crm_records r
    WHERE r.phone = phone_normalized
       OR r.phone = phone_raw
    LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Fall back to JSONB data fields
  RETURN QUERY
    SELECT r.id, r.org_id, r.phone
    FROM crm_records r
    WHERE r.data->>'phone' = phone_raw
       OR r.data->>'phone' = phone_normalized
       OR r.data->>'mobile' = phone_raw
       OR r.data->>'mobile' = phone_normalized
    LIMIT 1;
END;
$$;

-- =============================================================================
-- 2. Fix 81 SECURITY DEFINER functions missing SET search_path
--    Without this, a malicious schema could shadow public tables/functions.
-- =============================================================================
ALTER FUNCTION public.accept_team_invitation(p_token text, p_full_name text) SET search_path = public;
ALTER FUNCTION public.archive_old_audit_logs(p_days_to_keep integer) SET search_path = public;
ALTER FUNCTION public.can_user_send_email(p_profile_id uuid) SET search_path = public;
ALTER FUNCTION public.cancel_long_running_queries() SET search_path = public;
ALTER FUNCTION public.check_crm_duplicate(p_org_id uuid, p_module_id uuid, p_email text, p_phone text, p_exclude_id uuid) SET search_path = public;
ALTER FUNCTION public.check_rate_limit(p_identifier text, p_endpoint text, p_max_requests integer, p_window_seconds integer) SET search_path = public;
ALTER FUNCTION public.cleanup_expired_oauth_states() SET search_path = public;
ALTER FUNCTION public.cleanup_rate_limits() SET search_path = public;
ALTER FUNCTION public.cleanup_recent_page_visits() SET search_path = public;
ALTER FUNCTION public.convert_lead_to_member(p_lead_record_id uuid, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.create_activity_log_entry(p_ticket_id uuid, p_action_type text, p_actor_id uuid, p_details jsonb) SET search_path = public;
ALTER FUNCTION public.create_staff_log_notification(p_user_id uuid, p_log_id uuid, p_type text, p_title text, p_message text, p_metadata jsonb) SET search_path = public;
ALTER FUNCTION public.create_team_invitation(p_org_id uuid, p_email text, p_role text, p_expires_in_days integer) SET search_path = public;
ALTER FUNCTION public.deactivate_team_member(p_profile_id uuid) SET search_path = public;
ALTER FUNCTION public.decrypt_token(encrypted_token text, secret text) SET search_path = public;
ALTER FUNCTION public.encrypt_token(token text, secret text) SET search_path = public;
ALTER FUNCTION public.extract_mentions_from_comment() SET search_path = public;
ALTER FUNCTION public.find_ticket_by_number(ticket_number_prefix text) SET search_path = public;
ALTER FUNCTION public.get_age_up_out_summary(p_org_id uuid, p_days_ahead integer) SET search_path = public;
ALTER FUNCTION public.get_agent_sla_performance(p_start_date timestamp with time zone, p_end_date timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_busy_slots(p_owner_id uuid, p_start timestamp with time zone, p_end timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_calendar_events_range(p_owner_id uuid, p_start timestamp with time zone, p_end timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_campaign_stats(p_campaign_id uuid) SET search_path = public;
ALTER FUNCTION public.get_change_feed_stats(p_org_id uuid) SET search_path = public;
ALTER FUNCTION public.get_commission_summary(p_organization_id uuid, p_period_start date, p_period_end date) SET search_path = public;
ALTER FUNCTION public.get_invoice_generation_summary(p_organization_id uuid) SET search_path = public;
ALTER FUNCTION public.get_next_round_robin_agent(p_rule_id uuid) SET search_path = public;
ALTER FUNCTION public.get_payables_summary(p_organization_id uuid, p_start_date date, p_end_date date) SET search_path = public;
ALTER FUNCTION public.get_system_health_trends(p_hours integer) SET search_path = public;
ALTER FUNCTION public.get_team_members(p_org_id uuid) SET search_path = public;
ALTER FUNCTION public.get_ticket_requester_email(p_ticket_id uuid) SET search_path = public;
ALTER FUNCTION public.get_ticket_requester_name(p_ticket_id uuid) SET search_path = public;
ALTER FUNCTION public.get_user_advisor_id() SET search_path = public;
ALTER FUNCTION public.get_user_default_signature(p_profile_id uuid) SET search_path = public;
ALTER FUNCTION public.get_user_organization_id() SET search_path = public;
ALTER FUNCTION public.get_user_profile_id() SET search_path = public;
ALTER FUNCTION public.get_user_role() SET search_path = public;
ALTER FUNCTION public.get_user_sender_addresses(p_profile_id uuid) SET search_path = public;
ALTER FUNCTION public.get_vendor_eligibility_summary(p_org_id uuid, p_vendor_code text) SET search_path = public;
ALTER FUNCTION public.get_vendor_stats(p_org_id uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.health_check() SET search_path = public;
ALTER FUNCTION public.increment_user_email_count(p_profile_id uuid) SET search_path = public;
ALTER FUNCTION public.is_admin_or_owner() SET search_path = public;
ALTER FUNCTION public.is_admin_or_super_admin() SET search_path = public;
ALTER FUNCTION public.is_email_unsubscribed(p_org_id uuid, p_email text) SET search_path = public;
ALTER FUNCTION public.is_session_valid(p_session_token text) SET search_path = public;
ALTER FUNCTION public.log_admin_activity(p_entity_type text, p_entity_id uuid, p_action text, p_description text, p_metadata jsonb) SET search_path = public;
ALTER FUNCTION public.log_advisor_changes() SET search_path = public;
ALTER FUNCTION public.log_appointment_changes() SET search_path = public;
ALTER FUNCTION public.log_auth_event(p_user_id uuid, p_email text, p_event_type text, p_ip_address inet, p_user_agent text, p_metadata jsonb) SET search_path = public;
ALTER FUNCTION public.log_bill_group_changes() SET search_path = public;
ALTER FUNCTION public.log_billing_transaction_changes() SET search_path = public;
ALTER FUNCTION public.log_deal_stage_change() SET search_path = public;
ALTER FUNCTION public.log_eligibility_changes() SET search_path = public;
ALTER FUNCTION public.log_feature_mapping_changes() SET search_path = public;
ALTER FUNCTION public.log_financial_audit() SET search_path = public;
ALTER FUNCTION public.log_license_changes() SET search_path = public;
ALTER FUNCTION public.log_nacha_changes() SET search_path = public;
ALTER FUNCTION public.log_ops_audit(p_org_id uuid, p_event_type text, p_entity_type text, p_entity_id uuid, p_vendor_code text, p_changes jsonb, p_metadata jsonb) SET search_path = public;
ALTER FUNCTION public.log_phi_access(p_user_id uuid, p_org_id uuid, p_action text, p_resource_type text, p_resource_id uuid, p_record_name text, p_phi_fields text[], p_ip_address inet, p_user_agent text, p_session_id text) SET search_path = public;
ALTER FUNCTION public.log_pricing_changes() SET search_path = public;
ALTER FUNCTION public.log_processor_changes() SET search_path = public;
ALTER FUNCTION public.log_product_changes() SET search_path = public;
ALTER FUNCTION public.log_ticket_status_change() SET search_path = public;
ALTER FUNCTION public.log_vendor_change(p_org_id uuid, p_vendor_id uuid, p_file_id uuid, p_change_type text, p_entity_type text, p_entity_id uuid, p_field_changed text, p_old_value text, p_new_value text, p_severity text) SET search_path = public;
ALTER FUNCTION public.notify_assignee_on_assignment() SET search_path = public;
ALTER FUNCTION public.notify_ticket_status_change() SET search_path = public;
ALTER FUNCTION public.preview_round_robin_assignments(p_rule_id uuid, p_count integer) SET search_path = public;
ALTER FUNCTION public.reactivate_team_member(p_profile_id uuid) SET search_path = public;
ALTER FUNCTION public.record_change_event(p_org_id uuid, p_source_type text, p_source_name text, p_change_type text, p_entity_type text, p_entity_id uuid, p_entity_title text, p_title text, p_description text, p_diff jsonb, p_payload jsonb, p_actor_id uuid, p_actor_type text, p_severity text, p_requires_review boolean) SET search_path = public;
ALTER FUNCTION public.record_tracking_event(p_tracking_id uuid, p_event_type text, p_ip_address text, p_user_agent text, p_clicked_url text) SET search_path = public;
ALTER FUNCTION public.reset_daily_email_counts() SET search_path = public;
ALTER FUNCTION public.revoke_team_invitation(p_invitation_id uuid) SET search_path = public;
ALTER FUNCTION public.send_email_notification_on_comment() SET search_path = public;
ALTER FUNCTION public.sync_member_to_crm() SET search_path = public;
ALTER FUNCTION public.sync_member_to_crm_records() SET search_path = public;
ALTER FUNCTION public.trigger_job_definition_audit() SET search_path = public;
ALTER FUNCTION public.trigger_job_run_audit() SET search_path = public;
ALTER FUNCTION public.update_session_activity(p_session_token text) SET search_path = public;
ALTER FUNCTION public.update_team_member_role(p_profile_id uuid, p_new_role text) SET search_path = public;
