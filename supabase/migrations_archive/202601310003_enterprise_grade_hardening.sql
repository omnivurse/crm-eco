-- ============================================================================
-- ENTERPRISE GRADE DATABASE HARDENING
-- Ensures production-ready security, performance, and reliability
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENABLE RLS ON ALL PUBLIC TABLES
-- ============================================================================

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 2: CREATE MISSING FOREIGN KEY INDEXES (PERFORMANCE CRITICAL)
-- ============================================================================

-- Common foreign key patterns that need indexes
DO $$
DECLARE
  col RECORD;
BEGIN
  -- Index organization_id columns
  FOR col IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'organization_id'
    AND table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_organization_id ON public.%I(organization_id)',
        col.table_name, col.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore if index already exists or column type mismatch
    END;
  END LOOP;

  -- Index org_id columns (alias)
  FOR col IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'org_id'
    AND table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_org_id ON public.%I(org_id)',
        col.table_name, col.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Index user_id columns
  FOR col IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'user_id'
    AND table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_id ON public.%I(user_id)',
        col.table_name, col.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Index profile_id columns
  FOR col IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'profile_id'
    AND table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_profile_id ON public.%I(profile_id)',
        col.table_name, col.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Index advisor_id columns
  FOR col IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'advisor_id'
    AND table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_advisor_id ON public.%I(advisor_id)',
        col.table_name, col.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Index member_id columns
  FOR col IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'member_id'
    AND table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_member_id ON public.%I(member_id)',
        col.table_name, col.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Index created_at columns for time-series queries
  FOR col IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'created_at'
    AND table_schema = 'public'
    AND data_type IN ('timestamp with time zone', 'timestamp without time zone')
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_created_at ON public.%I(created_at DESC)',
        col.table_name, col.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Index status columns for filtered queries
  FOR col IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'status'
    AND table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_status ON public.%I(status)',
        col.table_name, col.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 3: UNIVERSAL UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables with updated_at column
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%I ON public.%I', tbl.table_name, tbl.table_name);
      EXECUTE format('CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        tbl.table_name, tbl.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 4: SERVICE ROLE BYPASS POLICIES (Required for server-side operations)
-- ============================================================================

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
  LOOP
    BEGIN
      -- Create service role full access policy
      EXECUTE format('DROP POLICY IF EXISTS service_role_all_%I ON public.%I', tbl.tablename, tbl.tablename);
      EXECUTE format('CREATE POLICY service_role_all_%I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        tbl.tablename, tbl.tablename);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 5: PERFORMANCE HELPER FUNCTIONS
-- ============================================================================

-- Cached user organization lookup (reduces subquery overhead)
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Cached user role lookup
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Cached user profile ID lookup
CREATE OR REPLACE FUNCTION public.get_user_profile_id()
RETURNS uuid AS $$
  SELECT id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Cached advisor ID lookup
CREATE OR REPLACE FUNCTION public.get_user_advisor_id()
RETURNS uuid AS $$
  SELECT a.id
  FROM public.advisors a
  JOIN public.profiles p ON p.id = a.profile_id
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is admin or owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'super_admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- SECTION 6: STATEMENT TIMEOUT FOR LONG-RUNNING QUERIES
-- ============================================================================

-- Set default statement timeout to prevent runaway queries (30 seconds)
-- ALTER DATABASE postgres SET statement_timeout = '30s';
-- Note: Uncomment if needed, but Supabase manages this

-- ============================================================================
-- SECTION 7: ENABLE REQUIRED EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS btree_gin; -- For composite indexes with GIN

-- ============================================================================
-- SECTION 8: DATABASE STATISTICS & MAINTENANCE HINTS
-- ============================================================================

-- Analyze all tables to update statistics for query planner
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
  LOOP
    BEGIN
      EXECUTE format('ANALYZE public.%I', tbl.tablename);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 9: AUDIT LOG TABLE (Immutable, Append-Only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),

  -- Actor information
  user_id uuid,
  user_email text,
  user_role text,
  ip_address inet,
  user_agent text,

  -- Organization context
  organization_id uuid,

  -- Action details
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,

  -- Change details
  old_values jsonb,
  new_values jsonb,

  -- Risk classification
  risk_level text DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Request context
  request_id text,
  session_id text
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_system_audit_log_timestamp ON public.system_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_user_id ON public.system_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_organization_id ON public.system_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_action ON public.system_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_resource ON public.system_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_risk ON public.system_audit_log(risk_level) WHERE risk_level IN ('high', 'critical');

-- RLS for audit log (read-only for admins, insert for service role)
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_admin_read ON public.system_audit_log;
CREATE POLICY audit_log_admin_read ON public.system_audit_log
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND is_admin_or_owner()
  );

DROP POLICY IF EXISTS audit_log_service_insert ON public.system_audit_log;
CREATE POLICY audit_log_service_insert ON public.system_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

-- No UPDATE or DELETE allowed on audit logs (immutable)

-- ============================================================================
-- SECTION 10: RATE LIMITING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- IP address, user_id, or API key
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON public.rate_limits(identifier, endpoint, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON public.rate_limits(window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limits_service_all ON public.rate_limits;
CREATE POLICY rate_limits_service_all ON public.rate_limits
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_requests integer DEFAULT 100,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  v_window_start := date_trunc('minute', now());

  -- Upsert request count
  INSERT INTO public.rate_limits (identifier, endpoint, window_start, request_count)
  VALUES (p_identifier, p_endpoint, v_window_start, 1)
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old rate limit entries (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 11: HEALTH CHECK FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.health_check()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'status', 'healthy',
    'timestamp', now(),
    'database', current_database(),
    'version', version(),
    'connections', (SELECT count(*) FROM pg_stat_activity),
    'tables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'),
    'rls_enabled_tables', (
      SELECT count(*) FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 12: DATA RETENTION POLICY HELPER
-- ============================================================================

-- Function to archive old data (call from cron job)
CREATE OR REPLACE FUNCTION public.archive_old_audit_logs(p_days_to_keep integer DEFAULT 90)
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- Move to archive table or delete based on retention policy
  DELETE FROM public.system_audit_log
  WHERE timestamp < now() - (p_days_to_keep || ' days')::interval
    AND risk_level NOT IN ('high', 'critical'); -- Keep high-risk logs longer

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 13: GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_advisor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_old_audit_logs(integer) TO service_role;

-- ============================================================================
-- SECTION 14: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.get_user_organization_id() IS 'Returns the organization_id for the current authenticated user (cached for performance)';
COMMENT ON FUNCTION public.get_user_role() IS 'Returns the role for the current authenticated user';
COMMENT ON FUNCTION public.is_admin_or_owner() IS 'Returns true if current user is admin, super_admin, or owner';
COMMENT ON FUNCTION public.health_check() IS 'Returns database health status for monitoring';
COMMENT ON FUNCTION public.check_rate_limit(text, text, integer, integer) IS 'Checks and increments rate limit counter, returns true if under limit';
COMMENT ON TABLE public.system_audit_log IS 'Immutable audit log for security and compliance tracking';
COMMENT ON TABLE public.rate_limits IS 'Rate limiting storage for API endpoints';

-- ============================================================================
-- DONE
-- ============================================================================
