-- Additional Performance Indexes
-- Based on query advisor suggestions from pg_stat_statements

-- ============================================================================
-- CRM RECORDS: Simple module_id index for queries without org_id filter
-- Some queries filter only by module_id, not using the composite index
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_crm_records_module_id
  ON crm_records(module_id);

-- ============================================================================
-- CHANGE_EVENTS: Simple org_id index (backup for composite)
-- Query planner sometimes prefers single-column for certain query patterns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_change_events_org_id
  ON change_events(org_id);

-- ============================================================================
-- Update statistics
-- ============================================================================
ANALYZE crm_records;
ANALYZE change_events;
