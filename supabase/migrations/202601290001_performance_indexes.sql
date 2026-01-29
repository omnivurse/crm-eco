-- Performance Optimization Migration
-- Addresses slow queries identified from pg_stat_statements analysis

-- ============================================================================
-- CRM RECORDS: Composite index for common query pattern
-- Query: SELECT * FROM crm_records WHERE org_id=X AND module_id=Y ORDER BY created_at DESC
-- Before: Using idx_crm_records_org_module (org_id, module_id) + separate sort on created_at
-- After: Single index scan with no additional sort
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_records_module_created
  ON crm_records(org_id, module_id, created_at DESC);

-- ============================================================================
-- CRM RECORDS: Index for owner + date queries (common in "My Records" views)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_records_owner_created
  ON crm_records(owner_id, created_at DESC)
  WHERE owner_id IS NOT NULL;

-- ============================================================================
-- CRM RECORDS: Index for status filtering with date sort
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_records_status_created
  ON crm_records(org_id, status, created_at DESC)
  WHERE status IS NOT NULL;

-- ============================================================================
-- CRM ACTIVITIES: Composite index for record timeline queries
-- Query: SELECT * FROM crm_activities WHERE record_id=X ORDER BY created_at DESC
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_activities_record_created
  ON crm_activities(record_id, created_at DESC);

-- ============================================================================
-- CRM NOTES: Composite index for record notes with date sort
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_notes_record_created
  ON crm_notes(record_id, created_at DESC);

-- ============================================================================
-- CRM TASKS: Composite index for record tasks with date sort
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_tasks_record_created
  ON crm_tasks(record_id, created_at DESC);

-- ============================================================================
-- PROFILES: Covering index for common auth queries
-- Query: SELECT * FROM profiles WHERE user_id = $1
-- This index includes all commonly-needed columns to avoid table lookups
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_user_covering
  ON profiles(user_id)
  INCLUDE (id, organization_id, email, full_name, role, is_active);

-- ============================================================================
-- CHANGE_EVENTS: Index for realtime subscription queries
-- Optimizes the filter: org_id = X (used by postgres_changes subscriptions)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_events_org_created
  ON change_events(org_id, created_at DESC);

-- ============================================================================
-- ANALYZE tables to update statistics
-- ============================================================================
ANALYZE crm_records;
ANALYZE profiles;
