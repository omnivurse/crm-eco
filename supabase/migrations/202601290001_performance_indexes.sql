-- Performance Optimization Migration
-- Addresses slow queries identified from pg_stat_statements analysis
-- Made conditional to avoid errors on missing tables

-- ============================================================================
-- CRM RECORDS: Composite indexes for common query patterns
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_records') THEN
    -- Index for org + module + date queries
    CREATE INDEX IF NOT EXISTS idx_crm_records_module_created
      ON crm_records(org_id, module_id, created_at DESC);

    -- Index for owner + date queries (common in "My Records" views)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_records' AND column_name = 'owner_id') THEN
      CREATE INDEX IF NOT EXISTS idx_crm_records_owner_created
        ON crm_records(owner_id, created_at DESC)
        WHERE owner_id IS NOT NULL;
    END IF;

    -- Index for status filtering with date sort
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_records' AND column_name = 'status') THEN
      CREATE INDEX IF NOT EXISTS idx_crm_records_status_created
        ON crm_records(org_id, status, created_at DESC)
        WHERE status IS NOT NULL;
    END IF;

    ANALYZE crm_records;
  END IF;
END $$;

-- ============================================================================
-- CRM ACTIVITIES: Composite index for record timeline queries
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_activities') THEN
    CREATE INDEX IF NOT EXISTS idx_crm_activities_record_created
      ON crm_activities(record_id, created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- CRM NOTES: Composite index for record notes with date sort
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_notes') THEN
    CREATE INDEX IF NOT EXISTS idx_crm_notes_record_created
      ON crm_notes(record_id, created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- CRM TASKS: Composite index for record tasks with date sort
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_tasks') THEN
    CREATE INDEX IF NOT EXISTS idx_crm_tasks_record_created
      ON crm_tasks(record_id, created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- PROFILES: Covering index for common auth queries
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    -- Check if user_id column exists before creating index
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
      -- Simple index on user_id (covering index with INCLUDE requires checking all columns exist)
      CREATE INDEX IF NOT EXISTS idx_profiles_user_id_simple
        ON profiles(user_id);
    END IF;

    ANALYZE profiles;
  END IF;
END $$;

-- ============================================================================
-- CHANGE_EVENTS: Index for realtime subscription queries
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'change_events') THEN
    CREATE INDEX IF NOT EXISTS idx_change_events_org_created
      ON change_events(org_id, created_at DESC);
  END IF;
END $$;
