-- ============================================================================
-- DB Health Sweep — Part 1: Duplicate Indexes + Function search_path
--
-- Targets two advisor-reported categories that are safe to fix in bulk:
--
--   • duplicate_index (136 advisor pairs) → drop every duplicate except the
--     canonical (alphabetically first) one. Both indexes in a duplicate pair
--     have identical definitions, so dropping either has no query-plan impact.
--     Removes wasted disk + write amplification on every INSERT/UPDATE.
--
--   • function_search_path_mutable (52) → bulk ALTER FUNCTION SET
--     search_path = public, pg_catalog. Without this, a SECURITY DEFINER
--     function inherits the caller's search_path and can be tricked into
--     resolving to a malicious table in their own schema (CVE-2007-6600
--     pattern). Locking the search_path makes resolution deterministic.
--
-- All operations are guarded with IF EXISTS / explicit existence checks so
-- the migration is fully idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop duplicate indexes (keep alphabetically-first; drop the rest)
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_admin_activity_log_created_at; -- dup of idx_admin_activity_log_created on admin_activity_log
DROP INDEX IF EXISTS public.idx_admin_activity_log_organization_id; -- dup of idx_admin_activity_log_org on admin_activity_log
DROP INDEX IF EXISTS public.idx_admin_settings_organization_id; -- dup of idx_admin_settings_org on admin_settings
DROP INDEX IF EXISTS public.idx_advisor_playbooks_organization_id; -- dup of idx_advisor_playbooks_org on advisor_playbooks
DROP INDEX IF EXISTS public.idx_advisor_scorecards_advisor_id; -- dup of idx_advisor_scorecards_advisor on advisor_scorecards
DROP INDEX IF EXISTS public.idx_advisor_scorecards_organization_id; -- dup of idx_advisor_scorecards_org on advisor_scorecards
DROP INDEX IF EXISTS public.idx_agent_messages_user_id; -- dup of idx_agent_messages_user on agent_messages
DROP INDEX IF EXISTS public.idx_analytics_snapshots_organization_id; -- dup of idx_analytics_snapshots_org on analytics_snapshots
DROP INDEX IF EXISTS public.idx_announcement_reads_user_id; -- dup of idx_announcement_reads_user on announcement_reads
DROP INDEX IF EXISTS public.idx_audit_logs_actor_id; -- dup of idx_audit_logs_actor_fk on audit_logs
DROP INDEX IF EXISTS public.idx_audit_logs_target_user_id; -- dup of idx_audit_logs_target_fk on audit_logs
DROP INDEX IF EXISTS public.idx_billing_failures_member_id; -- dup of idx_billing_failures_member on billing_failures
DROP INDEX IF EXISTS public.idx_billing_failures_organization_id; -- dup of idx_billing_failures_org on billing_failures
DROP INDEX IF EXISTS public.idx_billing_schedules_member_id; -- dup of idx_billing_schedules_member on billing_schedules
DROP INDEX IF EXISTS public.idx_billing_schedules_organization_id; -- dup of idx_billing_schedules_org on billing_schedules
DROP INDEX IF EXISTS public.idx_billing_transactions_created_at; -- dup of idx_billing_transactions_created on billing_transactions
DROP INDEX IF EXISTS public.idx_billing_transactions_member_id; -- dup of idx_billing_transactions_member on billing_transactions
DROP INDEX IF EXISTS public.idx_billing_transactions_organization_id; -- dup of idx_billing_transactions_org on billing_transactions
DROP INDEX IF EXISTS public.idx_call_participants_profile_id; -- dup of idx_call_participants_profile on call_participants
DROP INDEX IF EXISTS public.idx_change_events_org_date; -- dup of idx_change_events_org_created on change_events
DROP INDEX IF EXISTS public.idx_change_subscriptions_user_id; -- dup of idx_change_subscriptions_user on change_subscriptions
DROP INDEX IF EXISTS public.idx_commission_payouts_advisor_id; -- dup of idx_commission_payouts_advisor on commission_payouts
DROP INDEX IF EXISTS public.idx_commission_payouts_organization_id; -- dup of idx_commission_payouts_org on commission_payouts
DROP INDEX IF EXISTS public.idx_commission_tiers_organization_id; -- dup of idx_commission_tiers_org on commission_tiers
DROP INDEX IF EXISTS public.idx_commission_transactions_advisor_id; -- dup of idx_commission_transactions_advisor on commission_transactions
DROP INDEX IF EXISTS public.idx_commission_transactions_organization_id; -- dup of idx_commission_transactions_org on commission_transactions
DROP INDEX IF EXISTS public.idx_commissions_period; -- dup of idx_commissions_commission_period on commissions
DROP INDEX IF EXISTS public.idx_crm_approval_actions_created_at; -- dup of idx_crm_approval_actions_created on crm_approval_actions
DROP INDEX IF EXISTS public.idx_crm_approval_decisions_created_at; -- dup of idx_crm_approval_decisions_created on crm_approval_decisions
DROP INDEX IF EXISTS public.idx_crm_approval_decisions_org_id; -- dup of idx_crm_approval_decisions_org on crm_approval_decisions
DROP INDEX IF EXISTS public.idx_crm_approval_processes_org_id; -- dup of idx_crm_approval_processes_org on crm_approval_processes
DROP INDEX IF EXISTS public.idx_crm_approval_rules_org_id; -- dup of idx_crm_approval_rules_org on crm_approval_rules
DROP INDEX IF EXISTS public.idx_crm_approvals_created_at; -- dup of idx_crm_approvals_created on crm_approvals
DROP INDEX IF EXISTS public.idx_crm_approvals_org_id; -- dup of idx_crm_approvals_org on crm_approvals
DROP INDEX IF EXISTS public.idx_crm_assignment_rules_org_id; -- dup of idx_crm_assignment_rules_org on crm_assignment_rules
DROP INDEX IF EXISTS public.idx_crm_audit_log_created_at; -- dup of idx_crm_audit_created on crm_audit_log
DROP INDEX IF EXISTS public.idx_crm_audit_org; -- dup of idx_crm_audit_log_org_id on crm_audit_log
DROP INDEX IF EXISTS public.idx_crm_automation_runs_org_id; -- dup of idx_crm_automation_runs_org on crm_automation_runs
DROP INDEX IF EXISTS public.idx_crm_blueprints_org_id; -- dup of idx_crm_blueprints_org on crm_blueprints
DROP INDEX IF EXISTS public.idx_crm_cadence_enrollments_org_id; -- dup of idx_crm_cadence_enrollments_org on crm_cadence_enrollments
DROP INDEX IF EXISTS public.idx_crm_cadences_org_id; -- dup of idx_crm_cadences_org on crm_cadences
DROP INDEX IF EXISTS public.idx_crm_contact_preferences_org_id; -- dup of idx_crm_contact_preferences_org on crm_contact_preferences
DROP INDEX IF EXISTS public.idx_crm_deal_stage_history_created_at; -- dup of idx_crm_deal_stage_history_created on crm_deal_stage_history
DROP INDEX IF EXISTS public.idx_crm_deal_stage_history_org_id; -- dup of idx_crm_deal_stage_history_org on crm_deal_stage_history
DROP INDEX IF EXISTS public.idx_crm_deal_stages_org_id; -- dup of idx_crm_deal_stages_org on crm_deal_stages
DROP INDEX IF EXISTS public.idx_crm_fields_org_id; -- dup of idx_crm_fields_org on crm_fields
DROP INDEX IF EXISTS public.idx_crm_import_jobs_created_at; -- dup of idx_crm_import_jobs_created on crm_import_jobs
DROP INDEX IF EXISTS public.idx_crm_import_jobs_org_id; -- dup of idx_crm_import_jobs_org on crm_import_jobs
DROP INDEX IF EXISTS public.idx_crm_import_sources_org_id; -- dup of idx_crm_import_sources_org on crm_import_sources
DROP INDEX IF EXISTS public.idx_crm_macro_runs_org_id; -- dup of idx_crm_macro_runs_org on crm_macro_runs
DROP INDEX IF EXISTS public.idx_crm_macros_org_id; -- dup of idx_crm_macros_org on crm_macros
DROP INDEX IF EXISTS public.idx_crm_message_events_created_at; -- dup of idx_crm_message_events_created on crm_message_events
DROP INDEX IF EXISTS public.idx_crm_message_providers_org_id; -- dup of idx_crm_message_providers_org on crm_message_providers
DROP INDEX IF EXISTS public.idx_crm_message_templates_org_id; -- dup of idx_crm_message_templates_org on crm_message_templates
DROP INDEX IF EXISTS public.idx_crm_message_threads_org_id; -- dup of idx_crm_message_threads_org on crm_message_threads
DROP INDEX IF EXISTS public.idx_crm_messages_created_at; -- dup of idx_crm_messages_created on crm_messages
DROP INDEX IF EXISTS public.idx_crm_messages_org_id; -- dup of idx_crm_messages_org on crm_messages
DROP INDEX IF EXISTS public.idx_crm_modules_org_id; -- dup of idx_crm_modules_org on crm_modules
DROP INDEX IF EXISTS public.idx_crm_notes_record_created; -- dup of idx_crm_notes_created_at on crm_notes
DROP INDEX IF EXISTS public.idx_crm_notifications_user_id; -- dup of idx_crm_notifications_user on crm_notifications
DROP INDEX IF EXISTS public.idx_crm_record_links_org_id; -- dup of idx_crm_record_links_org on crm_record_links
DROP INDEX IF EXISTS public.idx_crm_records_org_module_date; -- dup of idx_crm_records_module_created on crm_records
DROP INDEX IF EXISTS public.idx_fk_crm_reports_created_by; -- dup of idx_crm_reports_created_by on crm_reports
DROP INDEX IF EXISTS public.idx_crm_reports_organization_id; -- dup of idx_crm_reports_org on crm_reports
DROP INDEX IF EXISTS public.idx_crm_scheduler_jobs_org_id; -- dup of idx_crm_scheduler_jobs_org on crm_scheduler_jobs
DROP INDEX IF EXISTS public.idx_crm_scoring_rules_org_id; -- dup of idx_crm_scoring_rules_org on crm_scoring_rules
DROP INDEX IF EXISTS public.idx_crm_sla_policies_org_id; -- dup of idx_crm_sla_policies_org on crm_sla_policies
DROP INDEX IF EXISTS public.idx_crm_stage_history_created_at; -- dup of idx_crm_stage_history_created on crm_stage_history
DROP INDEX IF EXISTS public.idx_crm_stage_history_org_id; -- dup of idx_crm_stage_history_org on crm_stage_history
DROP INDEX IF EXISTS public.idx_crm_validation_rule_runs_created_at; -- dup of idx_crm_validation_rule_runs_created on crm_validation_rule_runs
DROP INDEX IF EXISTS public.idx_crm_validation_rule_runs_org_id; -- dup of idx_crm_validation_rule_runs_org on crm_validation_rule_runs
DROP INDEX IF EXISTS public.idx_crm_validation_rules_org_id; -- dup of idx_crm_validation_rules_org on crm_validation_rules
DROP INDEX IF EXISTS public.idx_crm_webforms_org_id; -- dup of idx_crm_webforms_org on crm_webforms
DROP INDEX IF EXISTS public.idx_crm_workflows_org_id; -- dup of idx_crm_workflows_org on crm_workflows
DROP INDEX IF EXISTS public.idx_custom_reports_organization_id; -- dup of idx_custom_reports_org on custom_reports
DROP INDEX IF EXISTS public.idx_dependents_member_id; -- dup of idx_dependents_member on dependents
DROP INDEX IF EXISTS public.idx_dependents_organization_id; -- dup of idx_dependents_organization on dependents
DROP INDEX IF EXISTS public.idx_email_assets_org_id; -- dup of idx_email_assets_org on email_assets
DROP INDEX IF EXISTS public.idx_email_attachments_org_id; -- dup of idx_email_attachments_org on email_attachments
DROP INDEX IF EXISTS public.idx_email_campaigns_org_id; -- dup of idx_email_campaigns_org on email_campaigns
DROP INDEX IF EXISTS public.idx_email_domains_org_id; -- dup of idx_email_domains_org on email_domains
DROP INDEX IF EXISTS public.idx_sender_addresses_domain; -- dup of idx_email_sender_addresses_domain on email_sender_addresses
DROP INDEX IF EXISTS public.idx_email_sender_addresses_org_id; -- dup of idx_email_sender_addresses_org on email_sender_addresses
DROP INDEX IF EXISTS public.idx_sender_addresses_org; -- dup of idx_email_sender_addresses_org on email_sender_addresses
DROP INDEX IF EXISTS public.idx_email_signatures_org_id; -- dup of idx_email_signatures_org on email_signatures
DROP INDEX IF EXISTS public.idx_email_signatures_profile_id; -- dup of idx_email_signatures_profile on email_signatures
DROP INDEX IF EXISTS public.idx_unsubscribes_org; -- dup of idx_email_unsubscribes_org_id on email_unsubscribes
DROP INDEX IF EXISTS public.idx_engagement_events_advisor_id; -- dup of idx_engagement_events_advisor on engagement_events
DROP INDEX IF EXISTS public.idx_engagement_events_organization_id; -- dup of idx_engagement_events_org on engagement_events
DROP INDEX IF EXISTS public.idx_enrollment_audit_log_created_at; -- dup of idx_enrollment_audit_created_at on enrollment_audit_log
DROP INDEX IF EXISTS public.idx_enrollments_advisor_id; -- dup of idx_enrollments_advisor on enrollments
DROP INDEX IF EXISTS public.idx_enrollments_organization_id; -- dup of idx_enrollments_org on enrollments
DROP INDEX IF EXISTS public.idx_field_mappings_organization_id; -- dup of idx_field_mappings_org on field_mappings
DROP INDEX IF EXISTS public.idx_import_jobs_created_at; -- dup of idx_import_jobs_created on import_jobs
DROP INDEX IF EXISTS public.idx_import_jobs_organization_id; -- dup of idx_import_jobs_org on import_jobs
DROP INDEX IF EXISTS public.idx_import_snapshots_organization_id; -- dup of idx_import_snapshots_org on import_snapshots
DROP INDEX IF EXISTS public.idx_inbox_conversations_org_id; -- dup of idx_inbox_conversations_org on inbox_conversations
DROP INDEX IF EXISTS public.idx_inbox_views_org_id; -- dup of idx_inbox_views_org on inbox_views
DROP INDEX IF EXISTS public.idx_integration_connections_organization_id; -- dup of idx_integration_connections_org on integration_connections
DROP INDEX IF EXISTS public.idx_integration_connections_user_id; -- dup of idx_integration_connections_user on integration_connections
DROP INDEX IF EXISTS public.idx_invoices_organization_id; -- dup of idx_invoices_org on invoices
DROP INDEX IF EXISTS public.idx_landing_pages_organization_id; -- dup of idx_landing_pages_org on landing_pages
DROP INDEX IF EXISTS public.idx_meeting_participants_user_id; -- dup of idx_meeting_participants_user on meeting_participants
DROP INDEX IF EXISTS public.idx_memberships_advisor_id; -- dup of idx_memberships_advisor on memberships
DROP INDEX IF EXISTS public.idx_memberships_member_id; -- dup of idx_memberships_member on memberships
DROP INDEX IF EXISTS public.idx_memberships_organization_id; -- dup of idx_memberships_org on memberships
DROP INDEX IF EXISTS public.idx_need_pricing_org; -- dup of idx_need_pricing_estimates_organization_id on need_pricing_estimates
DROP INDEX IF EXISTS public.idx_oauth_states_org_id; -- dup of idx_oauth_states_org on oauth_states
DROP INDEX IF EXISTS public.idx_payment_profiles_member_id; -- dup of idx_payment_profiles_member on payment_profiles
DROP INDEX IF EXISTS public.idx_payment_profiles_organization_id; -- dup of idx_payment_profiles_org on payment_profiles
DROP INDEX IF EXISTS public.idx_pipeline_stages_organization_id; -- dup of idx_pipeline_stages_org on pipeline_stages
DROP INDEX IF EXISTS public.idx_plans_organization_id; -- dup of idx_plans_org on plans
DROP INDEX IF EXISTS public.idx_presentation_templates_organization_id; -- dup of idx_presentation_templates_org on presentation_templates
DROP INDEX IF EXISTS public.idx_presentations_organization_id; -- dup of idx_presentations_org on presentations
DROP INDEX IF EXISTS public.idx_procedure_pricing_organization_id; -- dup of idx_procedure_pricing_org on procedure_pricing
DROP INDEX IF EXISTS public.idx_product_benefit_types_organization_id; -- dup of idx_product_benefit_types_org on product_benefit_types
DROP INDEX IF EXISTS public.idx_products_organization_id; -- dup of idx_products_org on products
DROP INDEX IF EXISTS public.idx_profiles_user_id_simple; -- dup of idx_profiles_user_id on profiles
DROP INDEX IF EXISTS public.idx_quotes_organization_id; -- dup of idx_quotes_org on quotes
DROP INDEX IF EXISTS public.idx_requests_item; -- dup of idx_requests_catalog_item_id on requests
DROP INDEX IF EXISTS public.idx_requests_requester_id; -- dup of idx_requests_requester on requests
DROP INDEX IF EXISTS public.idx_super_admin_sessions_profile_id; -- dup of idx_super_admin_sessions_profile on super_admin_sessions
DROP INDEX IF EXISTS public.idx_system_health_logs_status; -- dup of idx_health_logs_status on system_health_logs
DROP INDEX IF EXISTS public.idx_system_incidents_status; -- dup of idx_incidents_status on system_incidents
DROP INDEX IF EXISTS public.idx_team_activities_created_at; -- dup of idx_team_activities_created on team_activities
DROP INDEX IF EXISTS public.idx_team_activities_user_id; -- dup of idx_team_activities_user on team_activities
DROP INDEX IF EXISTS public.idx_team_announcements_created_at; -- dup of idx_team_announcements_created on team_announcements
DROP INDEX IF EXISTS public.idx_team_presence_user_id; -- dup of idx_team_presence_user on team_presence
DROP INDEX IF EXISTS public.idx_ticket_notifications_user_id; -- dup of idx_ticket_notifications_user on ticket_notifications
DROP INDEX IF EXISTS public.idx_ticket_read_status_user_id; -- dup of idx_ticket_read_status_user on ticket_read_status
DROP INDEX IF EXISTS public.idx_ticket_watchers_ticket_id; -- dup of idx_ticket_watchers_ticket on ticket_watchers
DROP INDEX IF EXISTS public.idx_ticket_watchers_user_id; -- dup of idx_ticket_watchers_user on ticket_watchers
DROP INDEX IF EXISTS public.idx_user_domain_assignments_org_id; -- dup of idx_user_domain_assignments_org on user_domain_assignments
DROP INDEX IF EXISTS public.idx_user_domain_assignments_profile_id; -- dup of idx_user_domain_assignments_profile on user_domain_assignments
DROP INDEX IF EXISTS public.idx_user_email_settings_org_id; -- dup of idx_user_email_settings_org on user_email_settings
DROP INDEX IF EXISTS public.idx_user_email_settings_profile_id; -- dup of idx_user_email_settings_profile on user_email_settings
DROP INDEX IF EXISTS public.idx_workflow_executions_workflow_id; -- dup of idx_workflow_executions_workflow on workflow_executions

-- ----------------------------------------------------------------------------
-- 2. Lock function search_path for advisor-flagged functions
--    Loops via pg_proc so we don't need to hand-write each signature.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_fn  text;
  v_sig text;
  v_target_fns text[] := ARRAY[
    'approve_payout_batch',
    'auto_create_weekly_batches',
    'calculate_net_premium',
    'classify_market_type',
    'create_payout_batch',
    'create_payout_clawback',
    'create_payout_reversal',
    'crm_feature_flags_touch_updated_at',
    'crm_records_search_update',
    'detect_payout_anomalies',
    'execute_payout_batch',
    'filter_records_by_related',
    'fn_crm_advisors_deprecation_notice',
    'generate_record_title',
    'get_advisor_achievements',
    'get_advisor_analytics',
    'get_agency_analytics',
    'get_agency_members',
    'get_agency_scoped_analytics',
    'get_growth_metrics',
    'get_leaderboard',
    'get_my_agencies',
    'get_my_ranking',
    'get_org_dashboard_analytics',
    'get_payout_compliance_config',
    'get_score_config',
    'log_payout_export',
    'mark_payout_failed',
    'mark_payout_paid',
    'prevent_audit_mutation',
    'prevent_batch_immutable_field_change',
    'prevent_financial_delete',
    'prevent_ledger_immutable_field_change',
    'prevent_provider_txn_immutable_field_change',
    'reconcile_payouts',
    'record_provider_result',
    'refresh_advisor_commission_summary',
    'refresh_advisor_rankings',
    'refresh_reporting_views',
    'resolve_fraud_flag',
    'set_record_title',
    'sync_enrollment_to_crm_records',
    'sync_member_to_crm',
    'sync_member_to_crm_records',
    'trg_auto_create_agency',
    'trg_commission_to_ledger',
    'trg_enrollment_commission_auto_fire',
    'trg_financial_change_capture',
    'trg_validate_commission_capacity',
    'update_inbox_drafts_updated_at',
    'update_inbox_message_search_vector',
    'upsert_contacts_batch'
  ];
  v_count int := 0;
BEGIN
  FOREACH v_fn IN ARRAY v_target_fns LOOP
    FOR v_sig IN
      SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_fn
    LOOP
      BEGIN
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', v_sig);
        v_count := v_count + 1;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'could not alter %: %', v_sig, SQLERRM;
      END;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'function search_path locked on % function signatures', v_count;
END $$;

NOTIFY pgrst, 'reload schema';
