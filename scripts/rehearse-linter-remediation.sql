-- REHEARSAL ONLY — run on STAGING first, then production
-- Expected: NOTICE counts; zero persistent changes after ROLLBACK

BEGIN;



DO $$
DECLARE
  v_fn text;
  v_sig text;
  v_count int := 0;
  v_target_fns text[] := ARRAY[
    '_crm_jsonb_value_is_blank',
    '_parse_import_date',
    'auto_link_email_thread',
    'cancel_future_billing_on_enrollment_cancelled',
    'check_approval_required',
    'complete_job',
    'compute_first_billing_date',
    'create_enrollment_tx',
    'create_signup_commission_on_enrollment',
    'crm_records_init_stage_updated_at',
    'crm_records_set_stage_updated_at',
    'emit_integration_event',
    'find_or_create_contact_by_email',
    'generate_billing_schedule_on_enrollment_active',
    'get_pending_jobs',
    'notify_member_on_need_status_change',
    'queue_integration_job',
    'recompute_advisor_tier_on_membership_change',
    'set_updated_at',
    'set_updated_at_member_portal',
    'sync_billing_schedule_on_enrollment_update',
    'sync_org_tenant_key',
    'update_billing_automation_config_updated_at',
    'update_email_thread_stats'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_target_fns LOOP
    FOR v_sig IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_fn
    LOOP
      BEGIN
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', v_sig);
        v_count := v_count + 1;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'search_path: could not alter %: %', v_sig, SQLERRM;
      END;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Phase 1: locked search_path on % function signatures', v_count;
END $$;




REVOKE ALL ON TABLE public.mv_org_monthly_dashboard FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_advisor_monthly_performance FROM anon, authenticated;
REVOKE ALL ON TABLE public.executive_top_advisor_mv FROM anon, authenticated;
REVOKE ALL ON TABLE public.executive_kpi_mv FROM anon, authenticated;

-- Preserve service_role / postgres access for refresh jobs and RPCs
GRANT SELECT ON TABLE public.mv_org_monthly_dashboard TO service_role;
GRANT SELECT ON TABLE public.mv_advisor_monthly_performance TO service_role;
GRANT SELECT ON TABLE public.executive_top_advisor_mv TO service_role;
GRANT SELECT ON TABLE public.executive_kpi_mv TO service_role;




DO $$
DECLARE
  v_fn text;
  v_sig text;
  v_count int := 0;
  v_target_fns text[] := ARRAY[
    '_actuarial_age_bands',
    '_actuarial_contributions',
    '_actuarial_exposure_dev',
    '_actuarial_monthly',
    '_actuarial_needs_by_type',
    '_actuarial_summary',
    '_demographics_agents',
    '_demographics_enrollments',
    '_demographics_health',
    '_demographics_members',
    '_sync_profile_to_org_member',
    'apply_role_from_groups',
    'apply_sla_to_ticket',
    'archive_old_audit_logs',
    'audit_log_hash_chain_trigger',
    'audit_staff_log_changes',
    'bump_knowledge_version',
    'cancel_future_billing_on_enrollment_cancelled',
    'cancel_long_running_queries',
    'check_rate_limit',
    'cleanup_expired_oauth_states',
    'cleanup_old_events',
    'cleanup_old_health_logs',
    'cleanup_rate_limits',
    'cleanup_recent_page_visits',
    'cleanup_report_results_cache',
    'cleanup_stale_presence',
    'commission_to_crm_sync_trigger',
    'create_signup_commission_on_enrollment',
    'decrypt_token',
    'drop_old_activity_log_partitions',
    'emit_integration_event',
    'emit_system_event',
    'encrypt_token',
    'enforce_no_phi',
    'ensure_activity_log_partitions',
    'extract_mentions_from_comment',
    'fn_audit_developer_hub_changes',
    'fn_audit_insurance_carriers',
    'fn_audit_lifecycle_events',
    'fn_audit_marketplace_changes',
    'fn_audit_provider_networks',
    'fn_audit_security_changes',
    'fn_audit_system_settings',
    'fn_authenticate_api_key',
    'fn_check_api_scope',
    'fn_cleanup_api_logs',
    'fn_get_matching_webhooks',
    'fn_record_webhook_delivery',
    'fn_update_extension_rating',
    'generate_billing_schedule_on_enrollment_active',
    'get_change_feed_stats',
    'get_child_org_ids',
    'get_component_status_summary',
    'get_daily_log_entry_count',
    'get_org_by_slug',
    'get_parent_org_ids',
    'get_super_admin_active_org',
    'handle_new_user',
    'health_check',
    'increment_user_email_count',
    'insert_audit_log',
    'log_activity',
    'log_advisor_changes',
    'log_appointment_changes',
    'log_audit_event',
    'log_auth_event',
    'log_bill_group_changes',
    'log_billing_transaction_changes',
    'log_crm_record_changes',
    'log_deal_stage_change',
    'log_eligibility_changes',
    'log_feature_mapping_changes',
    'log_financial_audit',
    'log_license_changes',
    'log_nacha_changes',
    'log_phi_access',
    'log_pricing_changes',
    'log_processor_changes',
    'log_product_changes',
    'log_profile_role_change',
    'log_report_run',
    'log_ticket_status_change',
    'log_validation_run',
    'log_vendor_change',
    'mark_file_for_onedrive_sync',
    'notify_assignee_on_assignment',
    'notify_staff_log_assignment',
    'notify_staff_log_mentions',
    'notify_staff_log_status_change',
    'notify_ticket_status_change',
    'notify_workflow_on_request_submitted',
    'notify_workflow_on_ticket_created',
    'notify_workflow_on_ticket_updated',
    'queue_daily_log_report',
    'queue_integration_job',
    'recompute_advisor_tier_on_membership_change',
    'recompute_network_coverage_zip',
    'record_tracking_event',
    'recover_zoho_notes_for_org',
    'refresh_advisor_rankings',
    'refresh_executive_views',
    'refresh_pricing_mv',
    'reset_daily_email_counts',
    'rls_auto_enable',
    'seed_default_deal_stages',
    'seed_default_extensions',
    'send_email_notification_on_comment',
    'set_super_admin_active_org',
    'sync_billing_schedule_on_enrollment_update',
    'sync_enrollment_to_crm_records',
    'sync_member_to_crm',
    'sync_member_to_crm_records',
    'trg_achievement_event',
    'trg_auto_create_agency',
    'trg_commission_ledger_event',
    'trg_commission_to_ledger',
    'trg_enrollment_commission_auto_fire',
    'trg_financial_change_capture',
    'trg_payout_batch_event',
    'trg_ranking_event',
    'trigger_calculate_sla_metrics',
    'trigger_calculate_sla_on_comment',
    'trigger_job_definition_audit',
    'trigger_job_run_audit',
    'trigger_refresh_pricing_mv',
    'trigger_workflows_for_event',
    'update_ticket_last_message',
    'update_user_presence',
    'upsert_leads_batch',
    'validate_free_text',
    'verify_audit_chain'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_target_fns LOOP
    FOR v_sig IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_fn
        AND p.prosecdef = true
    LOOP
      BEGIN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
        v_count := v_count + 1;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'revoke: could not alter %: %', v_sig, SQLERRM;
      END;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Phase 3: revoked API execute on % SECURITY DEFINER signatures', v_count;
END $$;



DO $$
DECLARE v_remaining int;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public'
    AND p.proname = ANY(ARRAY['_crm_jsonb_value_is_blank', '_parse_import_date', 'auto_link_email_thread', 'cancel_future_billing_on_enrollment_cancelled', 'check_approval_required', 'complete_job', 'compute_first_billing_date', 'create_enrollment_tx', 'create_signup_commission_on_enrollment', 'crm_records_init_stage_updated_at', 'crm_records_set_stage_updated_at', 'emit_integration_event', 'find_or_create_contact_by_email', 'generate_billing_schedule_on_enrollment_active', 'get_pending_jobs', 'notify_member_on_need_status_change', 'queue_integration_job', 'recompute_advisor_tier_on_membership_change', 'set_updated_at', 'set_updated_at_member_portal', 'sync_billing_schedule_on_enrollment_update', 'sync_org_tenant_key', 'update_billing_automation_config_updated_at', 'update_email_thread_stats'])
    AND (p.proconfig IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
    ));
  RAISE NOTICE 'Rehearsal check: functions still missing search_path: %', v_remaining;
END $$;

ROLLBACK;
