-- Phase 1: Supabase linter — lock search_path on remaining flagged functions
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Linter: function_search_path_mutable (24 functions / overloads)
-- Risk: LOW — metadata-only change, no data mutation, fully reversible
-- Rollback: ALTER FUNCTION ... RESET search_path; per signature

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

COMMIT;

NOTIFY pgrst, 'reload schema';
