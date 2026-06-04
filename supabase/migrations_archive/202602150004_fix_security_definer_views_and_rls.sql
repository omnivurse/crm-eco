-- Migration: Fix security definer views, enable RLS on partitions & staging tables
--
-- Fixes:
--   1. security_definer_view: 6 views using SECURITY DEFINER (bypasses RLS of querying user)
--   2. rls_disabled_in_public: activity_log partitions and _import staging tables without RLS
--   3. sensitive_columns_exposed: _import_contacts_staging (has tax_id) exposed without RLS


-- ============================================================================
-- PART 1: Fix security_definer_view - Switch views to SECURITY INVOKER
-- ============================================================================
-- By default, PostgreSQL views act as SECURITY DEFINER (they use the view
-- owner's permissions). Setting security_invoker = on makes the view respect
-- the querying user's permissions and RLS policies instead.

ALTER VIEW IF EXISTS public.chat_response_time_analytics SET (security_invoker = on);
ALTER VIEW IF EXISTS public.workflow_execution_stats SET (security_invoker = on);
ALTER VIEW IF EXISTS public.enterprise_verification_summary SET (security_invoker = on);
ALTER VIEW IF EXISTS public.ticket_metrics SET (security_invoker = on);
ALTER VIEW IF EXISTS public.change_feed_view SET (security_invoker = on);
ALTER VIEW IF EXISTS public.channel_activity_summary SET (security_invoker = on);


-- ============================================================================
-- PART 2: Enable RLS on activity_log partition tables
-- ============================================================================
-- The parent table `activity_log` already has RLS enabled with org-scoped
-- policies (activity_log_org_read, activity_log_org_insert). Policies on the
-- parent are inherited by partitions, but each partition must independently
-- have RLS enabled.

ALTER TABLE IF EXISTS public.activity_log_y2026m01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log_y2026m02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log_y2026m03 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log_y2026m04 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log_y2026m05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log_y2026m06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log_y2026m07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log_default ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- PART 3: Enable RLS on _import staging tables
-- ============================================================================
-- These staging tables hold sensitive import data (including PII like tax_id)
-- and must not be exposed without RLS. Only service_role should access them.

-- _import_contacts_staging (also fixes sensitive_columns_exposed for tax_id)
ALTER TABLE IF EXISTS public._import_contacts_staging ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_import_contacts_staging') THEN
    CREATE POLICY IF NOT EXISTS "service_role_import_contacts_staging"
      ON public._import_contacts_staging FOR ALL
      USING ((SELECT auth.role()) = 'service_role')
      WITH CHECK ((SELECT auth.role()) = 'service_role');
  END IF;
END $$;

-- _import_leads_staging
ALTER TABLE IF EXISTS public._import_leads_staging ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_import_leads_staging') THEN
    CREATE POLICY IF NOT EXISTS "service_role_import_leads_staging"
      ON public._import_leads_staging FOR ALL
      USING ((SELECT auth.role()) = 'service_role')
      WITH CHECK ((SELECT auth.role()) = 'service_role');
  END IF;
END $$;

-- _import_notes_staging
ALTER TABLE IF EXISTS public._import_notes_staging ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_import_notes_staging') THEN
    CREATE POLICY IF NOT EXISTS "service_role_import_notes_staging"
      ON public._import_notes_staging FOR ALL
      USING ((SELECT auth.role()) = 'service_role')
      WITH CHECK ((SELECT auth.role()) = 'service_role');
  END IF;
END $$;
