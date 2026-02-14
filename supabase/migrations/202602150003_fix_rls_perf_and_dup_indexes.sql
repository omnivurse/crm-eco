-- Migration: Fix RLS policy performance (auth_rls_initplan) and drop duplicate indexes
-- 
-- Part 1: Dynamically fix all RLS policies in the public schema that use bare
--   auth.uid(), auth.jwt(), or auth.role() calls (without the (SELECT ...) wrapper).
--   Wrapping these in a subselect prevents per-row re-evaluation and improves performance.
--   See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Part 2: Drop redundant duplicate indexes identified by Supabase database linter.
--   For each pair of identical indexes, one is dropped (the shorter/abbreviated name).

-- ============================================================================
-- PART 1: Fix auth_rls_initplan - Wrap auth.<function>() in (SELECT ...)
-- ============================================================================

DO $fix_rls$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_with_check TEXT;
  needs_fix BOOLEAN;
  create_sql TEXT;
  role_list TEXT;
  fixed_count INT := 0;
BEGIN
  FOR pol IN
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_qual := pol.qual;
    new_with_check := pol.with_check;
    needs_fix := FALSE;

    -- ---- Fix qual (USING clause) ----
    IF new_qual IS NOT NULL THEN
      -- Protect already-wrapped instances with placeholders
      new_qual := replace(new_qual, '( SELECT auth.uid())', '##SEL_AUTH_UID##');
      new_qual := replace(new_qual, '(SELECT auth.uid())',  '##SEL_AUTH_UID##');
      new_qual := replace(new_qual, '( SELECT auth.jwt())', '##SEL_AUTH_JWT##');
      new_qual := replace(new_qual, '(SELECT auth.jwt())',  '##SEL_AUTH_JWT##');
      new_qual := replace(new_qual, '( SELECT auth.role())', '##SEL_AUTH_ROLE##');
      new_qual := replace(new_qual, '(SELECT auth.role())',  '##SEL_AUTH_ROLE##');

      -- Wrap bare auth function calls
      IF position('auth.uid()' in new_qual) > 0 THEN
        new_qual := replace(new_qual, 'auth.uid()', '(SELECT auth.uid())');
        needs_fix := TRUE;
      END IF;
      IF position('auth.jwt()' in new_qual) > 0 THEN
        new_qual := replace(new_qual, 'auth.jwt()', '(SELECT auth.jwt())');
        needs_fix := TRUE;
      END IF;
      IF position('auth.role()' in new_qual) > 0 THEN
        new_qual := replace(new_qual, 'auth.role()', '(SELECT auth.role())');
        needs_fix := TRUE;
      END IF;

      -- Restore placeholders
      new_qual := replace(new_qual, '##SEL_AUTH_UID##',  '(SELECT auth.uid())');
      new_qual := replace(new_qual, '##SEL_AUTH_JWT##',  '(SELECT auth.jwt())');
      new_qual := replace(new_qual, '##SEL_AUTH_ROLE##', '(SELECT auth.role())');
    END IF;

    -- ---- Fix with_check (WITH CHECK clause) ----
    IF new_with_check IS NOT NULL THEN
      new_with_check := replace(new_with_check, '( SELECT auth.uid())', '##SEL_AUTH_UID##');
      new_with_check := replace(new_with_check, '(SELECT auth.uid())',  '##SEL_AUTH_UID##');
      new_with_check := replace(new_with_check, '( SELECT auth.jwt())', '##SEL_AUTH_JWT##');
      new_with_check := replace(new_with_check, '(SELECT auth.jwt())',  '##SEL_AUTH_JWT##');
      new_with_check := replace(new_with_check, '( SELECT auth.role())', '##SEL_AUTH_ROLE##');
      new_with_check := replace(new_with_check, '(SELECT auth.role())',  '##SEL_AUTH_ROLE##');

      IF position('auth.uid()' in new_with_check) > 0 THEN
        new_with_check := replace(new_with_check, 'auth.uid()', '(SELECT auth.uid())');
        needs_fix := TRUE;
      END IF;
      IF position('auth.jwt()' in new_with_check) > 0 THEN
        new_with_check := replace(new_with_check, 'auth.jwt()', '(SELECT auth.jwt())');
        needs_fix := TRUE;
      END IF;
      IF position('auth.role()' in new_with_check) > 0 THEN
        new_with_check := replace(new_with_check, 'auth.role()', '(SELECT auth.role())');
        needs_fix := TRUE;
      END IF;

      new_with_check := replace(new_with_check, '##SEL_AUTH_UID##',  '(SELECT auth.uid())');
      new_with_check := replace(new_with_check, '##SEL_AUTH_JWT##',  '(SELECT auth.jwt())');
      new_with_check := replace(new_with_check, '##SEL_AUTH_ROLE##', '(SELECT auth.role())');
    END IF;

    -- ---- Rebuild the policy if changes were needed ----
    IF needs_fix THEN
      -- Drop the existing policy
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
        pol.policyname, pol.schemaname, pol.tablename);

      -- Build role list from the roles array
      SELECT string_agg(r::text, ', ')
        INTO role_list
        FROM unnest(pol.roles) AS r;

      -- Build CREATE POLICY statement
      create_sql := format('CREATE POLICY %I ON %I.%I',
        pol.policyname, pol.schemaname, pol.tablename);

      -- AS PERMISSIVE/RESTRICTIVE (default is PERMISSIVE, only add if RESTRICTIVE)
      IF pol.permissive = 'RESTRICTIVE' THEN
        create_sql := create_sql || ' AS RESTRICTIVE';
      END IF;

      -- FOR command
      create_sql := create_sql || format(' FOR %s', pol.cmd);

      -- TO roles
      create_sql := create_sql || format(' TO %s', role_list);

      -- USING clause
      IF new_qual IS NOT NULL THEN
        create_sql := create_sql || format(' USING (%s)', new_qual);
      END IF;

      -- WITH CHECK clause
      IF new_with_check IS NOT NULL THEN
        create_sql := create_sql || format(' WITH CHECK (%s)', new_with_check);
      END IF;

      EXECUTE create_sql;
      fixed_count := fixed_count + 1;

      RAISE NOTICE 'Fixed RLS policy [%/%]: %.% - %',
        fixed_count, 163, pol.schemaname, pol.tablename, pol.policyname;
    END IF;
  END LOOP;

  RAISE NOTICE 'RLS initplan fix complete. Total policies fixed: %', fixed_count;
END;
$fix_rls$;


-- ============================================================================
-- PART 2: Drop duplicate indexes
-- ============================================================================
-- For each pair of identical indexes, we drop the shorter/abbreviated name
-- and keep the more descriptive one.

-- admin_activity_log
DROP INDEX IF EXISTS idx_admin_activity_log_created;
DROP INDEX IF EXISTS idx_admin_activity_log_org;

-- admin_settings
DROP INDEX IF EXISTS idx_admin_settings_org;

-- advisor_playbooks
DROP INDEX IF EXISTS idx_advisor_playbooks_org;

-- advisor_scorecards
DROP INDEX IF EXISTS idx_advisor_scorecards_advisor;
DROP INDEX IF EXISTS idx_advisor_scorecards_org;

-- agent_messages
DROP INDEX IF EXISTS idx_agent_messages_user;

-- analytics_snapshots
DROP INDEX IF EXISTS idx_analytics_snapshots_org;

-- announcement_reads
DROP INDEX IF EXISTS idx_announcement_reads_user;

-- audit_logs
DROP INDEX IF EXISTS idx_audit_logs_actor_fk;
DROP INDEX IF EXISTS idx_audit_logs_target_fk;

-- billing_failures
DROP INDEX IF EXISTS idx_billing_failures_member;
DROP INDEX IF EXISTS idx_billing_failures_org;

-- billing_schedules
DROP INDEX IF EXISTS idx_billing_schedules_member;
DROP INDEX IF EXISTS idx_billing_schedules_org;

-- billing_transactions
DROP INDEX IF EXISTS idx_billing_transactions_created;
DROP INDEX IF EXISTS idx_billing_transactions_member;
DROP INDEX IF EXISTS idx_billing_transactions_org;

-- call_participants
DROP INDEX IF EXISTS idx_call_participants_profile;

-- change_events (keep idx_change_events_org_created, drop the other)
DROP INDEX IF EXISTS idx_change_events_org_date;

-- change_subscriptions
DROP INDEX IF EXISTS idx_change_subscriptions_user;

-- commission_payouts
DROP INDEX IF EXISTS idx_commission_payouts_advisor;
DROP INDEX IF EXISTS idx_commission_payouts_org;

-- commission_tiers
DROP INDEX IF EXISTS idx_commission_tiers_org;

-- commission_transactions
DROP INDEX IF EXISTS idx_commission_transactions_advisor;
DROP INDEX IF EXISTS idx_commission_transactions_org;

-- commissions (keep idx_commissions_commission_period)
DROP INDEX IF EXISTS idx_commissions_period;

-- crm_approval_actions
DROP INDEX IF EXISTS idx_crm_approval_actions_created;

-- crm_approval_decisions
DROP INDEX IF EXISTS idx_crm_approval_decisions_created;
DROP INDEX IF EXISTS idx_crm_approval_decisions_org;

-- crm_approval_processes
DROP INDEX IF EXISTS idx_crm_approval_processes_org;

-- crm_approval_rules
DROP INDEX IF EXISTS idx_crm_approval_rules_org;

-- crm_approvals
DROP INDEX IF EXISTS idx_crm_approvals_created;
DROP INDEX IF EXISTS idx_crm_approvals_org;

-- crm_assignment_rules
DROP INDEX IF EXISTS idx_crm_assignment_rules_org;

-- crm_audit_log (keep idx_crm_audit_log_created_at and idx_crm_audit_log_org_id)
DROP INDEX IF EXISTS idx_crm_audit_created;
DROP INDEX IF EXISTS idx_crm_audit_org;

-- crm_automation_runs
DROP INDEX IF EXISTS idx_crm_automation_runs_org;

-- crm_blueprints
DROP INDEX IF EXISTS idx_crm_blueprints_org;

-- crm_cadence_enrollments
DROP INDEX IF EXISTS idx_crm_cadence_enrollments_org;

-- crm_cadences
DROP INDEX IF EXISTS idx_crm_cadences_org;

-- crm_contact_preferences
DROP INDEX IF EXISTS idx_crm_contact_preferences_org;

-- crm_deal_stage_history
DROP INDEX IF EXISTS idx_crm_deal_stage_history_created;
DROP INDEX IF EXISTS idx_crm_deal_stage_history_org;

-- crm_deal_stages
DROP INDEX IF EXISTS idx_crm_deal_stages_org;

-- crm_fields
DROP INDEX IF EXISTS idx_crm_fields_org;

-- crm_import_jobs
DROP INDEX IF EXISTS idx_crm_import_jobs_created;
DROP INDEX IF EXISTS idx_crm_import_jobs_org;

-- crm_import_sources
DROP INDEX IF EXISTS idx_crm_import_sources_org;

-- crm_macro_runs
DROP INDEX IF EXISTS idx_crm_macro_runs_org;

-- crm_macros
DROP INDEX IF EXISTS idx_crm_macros_org;

-- crm_message_events
DROP INDEX IF EXISTS idx_crm_message_events_created;

-- crm_message_providers
DROP INDEX IF EXISTS idx_crm_message_providers_org;

-- crm_message_templates
DROP INDEX IF EXISTS idx_crm_message_templates_org;

-- crm_message_threads
DROP INDEX IF EXISTS idx_crm_message_threads_org;

-- crm_messages
DROP INDEX IF EXISTS idx_crm_messages_created;
DROP INDEX IF EXISTS idx_crm_messages_org;

-- crm_modules
DROP INDEX IF EXISTS idx_crm_modules_org;

-- crm_notes (keep idx_crm_notes_created_at)
DROP INDEX IF EXISTS idx_crm_notes_record_created;

-- crm_notifications
DROP INDEX IF EXISTS idx_crm_notifications_user;

-- crm_record_links
DROP INDEX IF EXISTS idx_crm_record_links_org;

-- crm_records (keep idx_crm_records_module_created)
DROP INDEX IF EXISTS idx_crm_records_org_module_date;

-- crm_reports (keep idx_crm_reports_created_by and idx_crm_reports_organization_id)
DROP INDEX IF EXISTS idx_fk_crm_reports_created_by;
DROP INDEX IF EXISTS idx_crm_reports_org;

-- crm_scheduler_jobs
DROP INDEX IF EXISTS idx_crm_scheduler_jobs_org;

-- crm_scoring_rules
DROP INDEX IF EXISTS idx_crm_scoring_rules_org;

-- crm_sla_policies
DROP INDEX IF EXISTS idx_crm_sla_policies_org;

-- crm_stage_history
DROP INDEX IF EXISTS idx_crm_stage_history_created;
DROP INDEX IF EXISTS idx_crm_stage_history_org;

-- crm_validation_rule_runs
DROP INDEX IF EXISTS idx_crm_validation_rule_runs_created;
DROP INDEX IF EXISTS idx_crm_validation_rule_runs_org;

-- crm_validation_rules
DROP INDEX IF EXISTS idx_crm_validation_rules_org;

-- crm_webforms
DROP INDEX IF EXISTS idx_crm_webforms_org;

-- crm_workflows
DROP INDEX IF EXISTS idx_crm_workflows_org;

-- custom_reports
DROP INDEX IF EXISTS idx_custom_reports_org;

-- dependents
DROP INDEX IF EXISTS idx_dependents_member;
DROP INDEX IF EXISTS idx_dependents_organization;

-- email_assets
DROP INDEX IF EXISTS idx_email_assets_org;

-- email_attachments
DROP INDEX IF EXISTS idx_email_attachments_org;

-- email_campaigns
DROP INDEX IF EXISTS idx_email_campaigns_org;

-- email_domains
DROP INDEX IF EXISTS idx_email_domains_org;

-- email_sender_addresses (triple: keep idx_email_sender_addresses_org_id)
DROP INDEX IF EXISTS idx_email_sender_addresses_org;
DROP INDEX IF EXISTS idx_sender_addresses_org;
-- also drop duplicate domain index (keep idx_email_sender_addresses_domain)
DROP INDEX IF EXISTS idx_sender_addresses_domain;

-- email_signatures
DROP INDEX IF EXISTS idx_email_signatures_org;
DROP INDEX IF EXISTS idx_email_signatures_profile;

-- email_unsubscribes (keep idx_email_unsubscribes_org_id)
DROP INDEX IF EXISTS idx_unsubscribes_org;

-- engagement_events
DROP INDEX IF EXISTS idx_engagement_events_advisor;
DROP INDEX IF EXISTS idx_engagement_events_org;

-- enrollment_audit_log (keep idx_enrollment_audit_log_created_at)
DROP INDEX IF EXISTS idx_enrollment_audit_created_at;

-- enrollments
DROP INDEX IF EXISTS idx_enrollments_advisor;
DROP INDEX IF EXISTS idx_enrollments_org;

-- field_mappings
DROP INDEX IF EXISTS idx_field_mappings_org;

-- import_jobs
DROP INDEX IF EXISTS idx_import_jobs_created;
DROP INDEX IF EXISTS idx_import_jobs_org;

-- import_snapshots
DROP INDEX IF EXISTS idx_import_snapshots_org;

-- inbox_conversations
DROP INDEX IF EXISTS idx_inbox_conversations_org;

-- inbox_views
DROP INDEX IF EXISTS idx_inbox_views_org;

-- integration_connections
DROP INDEX IF EXISTS idx_integration_connections_org;
DROP INDEX IF EXISTS idx_integration_connections_user;

-- invoices
DROP INDEX IF EXISTS idx_invoices_org;

-- landing_pages
DROP INDEX IF EXISTS idx_landing_pages_org;

-- meeting_participants
DROP INDEX IF EXISTS idx_meeting_participants_user;

-- memberships
DROP INDEX IF EXISTS idx_memberships_advisor;
DROP INDEX IF EXISTS idx_memberships_member;
DROP INDEX IF EXISTS idx_memberships_org;

-- need_pricing_estimates (keep idx_need_pricing_estimates_organization_id)
DROP INDEX IF EXISTS idx_need_pricing_org;

-- oauth_states
DROP INDEX IF EXISTS idx_oauth_states_org;

-- payment_profiles
DROP INDEX IF EXISTS idx_payment_profiles_member;
DROP INDEX IF EXISTS idx_payment_profiles_org;

-- pipeline_stages
DROP INDEX IF EXISTS idx_pipeline_stages_org;

-- plans
DROP INDEX IF EXISTS idx_plans_org;

-- presentation_templates
DROP INDEX IF EXISTS idx_presentation_templates_org;

-- presentations
DROP INDEX IF EXISTS idx_presentations_org;

-- procedure_pricing
DROP INDEX IF EXISTS idx_procedure_pricing_org;

-- product_benefit_types
DROP INDEX IF EXISTS idx_product_benefit_types_org;

-- products
DROP INDEX IF EXISTS idx_products_org;

-- profiles (keep idx_profiles_user_id)
DROP INDEX IF EXISTS idx_profiles_user_id_simple;

-- quotes
DROP INDEX IF EXISTS idx_quotes_org;

-- requests (keep idx_requests_catalog_item_id and idx_requests_requester_id)
DROP INDEX IF EXISTS idx_requests_item;
DROP INDEX IF EXISTS idx_requests_requester;

-- super_admin_sessions
DROP INDEX IF EXISTS idx_super_admin_sessions_profile;

-- system_health_logs (keep idx_system_health_logs_status)
DROP INDEX IF EXISTS idx_health_logs_status;

-- system_incidents (keep idx_system_incidents_status)
DROP INDEX IF EXISTS idx_incidents_status;

-- team_activities
DROP INDEX IF EXISTS idx_team_activities_created;
DROP INDEX IF EXISTS idx_team_activities_user;

-- team_announcements
DROP INDEX IF EXISTS idx_team_announcements_created;

-- team_presence
DROP INDEX IF EXISTS idx_team_presence_user;

-- ticket_notifications
DROP INDEX IF EXISTS idx_ticket_notifications_user;

-- ticket_read_status
DROP INDEX IF EXISTS idx_ticket_read_status_user;

-- ticket_watchers
DROP INDEX IF EXISTS idx_ticket_watchers_ticket;
DROP INDEX IF EXISTS idx_ticket_watchers_user;

-- user_domain_assignments
DROP INDEX IF EXISTS idx_user_domain_assignments_org;
DROP INDEX IF EXISTS idx_user_domain_assignments_profile;

-- user_email_settings
DROP INDEX IF EXISTS idx_user_email_settings_org;
DROP INDEX IF EXISTS idx_user_email_settings_profile;

-- workflow_executions
DROP INDEX IF EXISTS idx_workflow_executions_workflow;
