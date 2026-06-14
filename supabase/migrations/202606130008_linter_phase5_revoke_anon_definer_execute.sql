-- Phase 5: Supabase linter — revoke anon EXECUTE on all public SECURITY DEFINER functions
-- Linter: anon_security_definer_function_executable
-- Strategy: remove PUBLIC/anon API access; keep authenticated + service_role on approved RPCs.
-- Internal / admin-only DEFINER functions get service_role only.
-- Rollback: GRANT EXECUTE ON FUNCTION ... TO anon; (not recommended)

BEGIN;

DO $$
DECLARE
  r record;
  v_keep text[] := ARRAY[
    'accept_team_invitation',
    'apply_age_65_auto_cancellation',
    'approve_payout_batch',
    'auto_cancel_expired_records',
    'auto_create_weekly_batches',
    'bulk_auto_merge_duplicates',
    'calculate_premium',
    'calculate_system_uptime',
    'can_access_organization',
    'can_user_send_email',
    'check_approval_required',
    'check_crm_duplicate',
    'check_org_plan_feature',
    'check_org_seat_capacity',
    'claim_scheduler_job',
    'compare_network_coverage',
    'compare_premiums',
    'complete_scheduler_job',
    'convert_lead_to_contact',
    'convert_lead_to_member',
    'count_org_active_seats',
    'create_activity_log_entry',
    'create_enrollment_tx',
    'create_franchise_relationship',
    'create_payout_batch',
    'create_payout_clawback',
    'create_payout_reversal',
    'create_staff_log_notification',
    'create_team_invitation',
    'create_ticket_notification',
    'current_profile_id',
    'deactivate_team_member',
    'detect_payout_anomalies',
    'dismiss_duplicate_pair',
    'execute_payout_batch',
    'execute_report_aggregation',
    'execute_report_query',
    'filter_records_by_related',
    'filter_records_by_system_preset',
    'find_cheapest_in_network_provider',
    'find_or_create_contact_by_email',
    'find_record_by_phone',
    'find_ticket_by_number',
    'fn_install_extension',
    'fn_uninstall_extension',
    'generate_warehouse_snapshot',
    'get_actuarial_experience',
    'get_admin_console_stats',
    'get_advisor_achievements',
    'get_advisor_analytics',
    'get_advisor_upline',
    'get_advisors_by_capacity',
    'get_age_up_out_summary',
    'get_agency_analytics',
    'get_agency_members',
    'get_agency_scoped_analytics',
    'get_agent_sla_performance',
    'get_agent_workload',
    'get_approval_detail',
    'get_approval_inbox',
    'get_approval_rules_for_module',
    'get_available_services',
    'get_billing_summary',
    'get_busy_slots',
    'get_calendar_events_range',
    'get_campaign_stats',
    'get_command_console_stats',
    'get_commission_summary',
    'get_commission_summary_by_product_type',
    'get_dashboard_hero_stats',
    'get_deal_stages',
    'get_executive_kpis',
    'get_franchise_analytics',
    'get_franchise_child_analytics',
    'get_group_demographics',
    'get_growth_metrics',
    'get_invoice_generation_summary',
    'get_leaderboard',
    'get_least_busy_agent',
    'get_linked_records',
    'get_module_blueprint',
    'get_module_stats',
    'get_my_advisor_id',
    'get_my_agencies',
    'get_my_ranking',
    'get_nearby_locations',
    'get_network_coverage_score',
    'get_next_round_robin_agent',
    'get_onedrive_pending_files',
    'get_org_dashboard_analytics',
    'get_payables_summary',
    'get_payout_compliance_config',
    'get_pending_approvals_count',
    'get_pending_scheduler_jobs',
    'get_record_stage_history',
    'get_revenue_share_rules',
    'get_score_config',
    'get_sla_compliance_percentage',
    'get_stage_validation_rules',
    'get_system_health_trends',
    'get_team_members',
    'get_ticket_requester_email',
    'get_ticket_requester_name',
    'get_user_advisor_id',
    'get_user_crm_role',
    'get_user_default_signature',
    'get_user_organization_id',
    'get_user_profile_id',
    'get_user_role',
    'get_user_sender_addresses',
    'get_validation_rules_for_module',
    'get_vendor_eligibility_summary',
    'get_vendor_stats',
    'has_crm_permission',
    'has_crm_role',
    'has_delegation',
    'has_pending_approval',
    'has_permission',
    'has_role',
    'increment_landing_page_views',
    'increment_recently_viewed_count',
    'increment_report_run_count',
    'increment_sequence_completed',
    'increment_template_usage',
    'increment_webform_submit_count',
    'is_admin',
    'is_admin_or_owner',
    'is_admin_or_super_admin',
    'is_crm_member',
    'is_email_unsubscribed',
    'is_in_my_downline',
    'is_session_valid',
    'is_staff_or_admin',
    'is_super_admin',
    'log_admin_activity',
    'log_ops_audit',
    'log_payout_export',
    'mark_payout_failed',
    'mark_payout_paid',
    'merge_crm_records',
    'preview_round_robin_assignments',
    'purge_expired_idempotency_keys',
    'reactivate_team_member',
    'recalc_crm_commission_summary',
    'reconcile_payouts',
    'record_change_event',
    'record_provider_result',
    'refresh_advisor_commission_summary',
    'refresh_reporting_views',
    'replace_plan_fees',
    'replace_plan_rate_entries',
    'resolve_fraud_flag',
    'revoke_franchise_relationship',
    'revoke_team_invitation',
    'search_in_network_providers',
    'search_procedure_prices',
    'shift_sequence_steps',
    'sync_member_active_plan_type',
    'undismiss_duplicate_pair',
    'update_delegation_permissions',
    'update_onedrive_sync_status',
    'update_session_activity',
    'update_team_member_role',
    'user_can_access_ticket',
    'user_organization_ids',
    'user_role_in',
    'validate_advisor_capacity'
  ];
  v_anon_revoked int := 0;
  v_auth_granted int := 0;
BEGIN
  FOR r IN
    SELECT
      format(
        '%I.%I(%s)',
        n.nspname,
        p.proname,
        pg_get_function_identity_arguments(p.oid)
      ) AS fq,
      p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.fq);
      v_anon_revoked := v_anon_revoked + 1;

      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fq);

      IF r.proname = ANY (v_keep) THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.fq);
        v_auth_granted := v_auth_granted + 1;
      ELSE
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.fq);
      END IF;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'phase5: could not alter %: %', r.fq, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Phase 5: stripped anon/PUBLIC execute on % DEFINER signatures; authenticated kept on %',
    v_anon_revoked, v_auth_granted;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
