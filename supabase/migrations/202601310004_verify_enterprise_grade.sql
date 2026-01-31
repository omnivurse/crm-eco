-- ============================================================================
-- ENTERPRISE GRADE VERIFICATION
-- This migration verifies and reports on enterprise-grade database features
-- ============================================================================

-- Create verification results table
CREATE TABLE IF NOT EXISTS public._enterprise_verification (
  id serial PRIMARY KEY,
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS', 'FAIL', 'WARN')),
  details text,
  checked_at timestamptz DEFAULT now()
);

-- Clear previous results
TRUNCATE public._enterprise_verification;

-- ============================================================================
-- CHECK 1: RLS Coverage
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'RLS Coverage',
  CASE
    WHEN (rls_count::float / NULLIF(total_count, 0)) >= 0.95 THEN 'PASS'
    WHEN (rls_count::float / NULLIF(total_count, 0)) >= 0.80 THEN 'WARN'
    ELSE 'FAIL'
  END,
  rls_count || ' of ' || total_count || ' tables have RLS enabled'
FROM (
  SELECT
    (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true) as rls_count,
    (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') as total_count
) stats;

-- ============================================================================
-- CHECK 2: Index Coverage on Foreign Keys
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'Foreign Key Indexes',
  CASE
    WHEN unindexed_fks = 0 THEN 'PASS'
    WHEN unindexed_fks <= 5 THEN 'WARN'
    ELSE 'FAIL'
  END,
  unindexed_fks || ' foreign keys without indexes'
FROM (
  SELECT count(*) as unindexed_fks
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = tc.table_name
      AND indexdef LIKE '%' || kcu.column_name || '%'
    )
) stats;

-- ============================================================================
-- CHECK 3: Audit Logging Available
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'Audit Logging',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'system_audit_log' AND schemaname = 'public')
    THEN 'PASS' ELSE 'FAIL'
  END,
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'system_audit_log' AND schemaname = 'public')
    THEN 'system_audit_log table exists'
    ELSE 'Missing system_audit_log table'
  END;

-- ============================================================================
-- CHECK 4: Rate Limiting Available
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'Rate Limiting',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'rate_limits' AND schemaname = 'public')
    THEN 'PASS' ELSE 'FAIL'
  END,
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'rate_limits' AND schemaname = 'public')
    THEN 'rate_limits table exists'
    ELSE 'Missing rate_limits table'
  END;

-- ============================================================================
-- CHECK 5: Health Check Function
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'Health Check Function',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'health_check')
    THEN 'PASS' ELSE 'FAIL'
  END,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'health_check')
    THEN 'health_check() available'
    ELSE 'Missing health_check()'
  END;

-- ============================================================================
-- CHECK 6: Helper Functions
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'Helper Functions',
  CASE
    WHEN function_count >= 4 THEN 'PASS'
    WHEN function_count >= 2 THEN 'WARN'
    ELSE 'FAIL'
  END,
  function_count || ' of 5 helper functions available'
FROM (
  SELECT count(*) as function_count
  FROM pg_proc
  WHERE proname IN (
    'get_user_organization_id',
    'get_user_role',
    'get_user_profile_id',
    'get_user_advisor_id',
    'is_admin_or_owner'
  )
) stats;

-- ============================================================================
-- CHECK 7: Required Extensions
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'Required Extensions',
  CASE WHEN ext_count >= 2 THEN 'PASS' ELSE 'WARN' END,
  ext_count || ' required extensions installed'
FROM (
  SELECT count(*) as ext_count
  FROM pg_extension
  WHERE extname IN ('pgcrypto', 'pg_stat_statements')
) stats;

-- ============================================================================
-- CHECK 8: Total Index Count (Performance)
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'Index Count',
  CASE
    WHEN idx_count >= 100 THEN 'PASS'
    WHEN idx_count >= 50 THEN 'WARN'
    ELSE 'FAIL'
  END,
  idx_count || ' indexes in public schema'
FROM (
  SELECT count(*) as idx_count FROM pg_indexes WHERE schemaname = 'public'
) stats;

-- ============================================================================
-- CHECK 9: Service Role Policies
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'Service Role Policies',
  CASE WHEN policy_count > 0 THEN 'PASS' ELSE 'FAIL' END,
  policy_count || ' service role bypass policies'
FROM (
  SELECT count(*) as policy_count
  FROM pg_policies
  WHERE policyname LIKE 'service_role_all_%'
) stats;

-- ============================================================================
-- CHECK 10: Unified Audit Logs
-- ============================================================================
INSERT INTO public._enterprise_verification (check_name, status, details)
SELECT
  'Unified Audit Logs',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'unified_audit_logs' AND schemaname = 'public')
    THEN 'PASS' ELSE 'WARN'
  END,
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'unified_audit_logs' AND schemaname = 'public')
    THEN 'Hash-chained audit logs available'
    ELSE 'unified_audit_logs not found (optional)'
  END;

-- ============================================================================
-- SUMMARY VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.enterprise_verification_summary AS
SELECT
  (SELECT count(*) FROM public._enterprise_verification WHERE status = 'PASS') as passed,
  (SELECT count(*) FROM public._enterprise_verification WHERE status = 'WARN') as warnings,
  (SELECT count(*) FROM public._enterprise_verification WHERE status = 'FAIL') as failed,
  (SELECT count(*) FROM public._enterprise_verification) as total,
  CASE
    WHEN (SELECT count(*) FROM public._enterprise_verification WHERE status = 'FAIL') = 0
    THEN 'ENTERPRISE READY'
    ELSE 'NEEDS ATTENTION'
  END as overall_status;

-- Print results
DO $$
DECLARE
  rec RECORD;
  v_summary RECORD;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '        ENTERPRISE GRADE VERIFICATION REPORT';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';

  FOR rec IN SELECT * FROM public._enterprise_verification ORDER BY id LOOP
    RAISE NOTICE '[%] % : %', rec.status, rec.check_name, rec.details;
  END LOOP;

  SELECT * INTO v_summary FROM public.enterprise_verification_summary;

  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'SUMMARY: % PASS | % WARN | % FAIL', v_summary.passed, v_summary.warnings, v_summary.failed;
  RAISE NOTICE 'STATUS: %', v_summary.overall_status;
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
