-- Final Realtime Optimization
-- Remove all unnecessary tables from publication to eliminate WAL overhead

-- ============================================================================
-- Remove high-write tables from Realtime publication
-- These tables generate lots of WAL but don't need live subscriptions
-- ============================================================================

DO $$
DECLARE
  tables_to_remove text[] := ARRAY[
    -- Import/batch tables (high write, no realtime needed)
    'crm_import_rows',
    'crm_import_jobs',
    'import_rows',
    'import_jobs',

    -- Audit/log tables (write-heavy, query via API)
    'crm_audit_logs',
    'audit_logs',
    'activities',
    'crm_activities',
    'staff_logs',
    'system_logs',

    -- Historical/archive tables
    'crm_stage_history',
    'stage_history',

    -- Task/note tables (use API polling or broadcast)
    'crm_tasks',
    'crm_notes',
    'tasks',
    'notes',

    -- Record tables (large payloads, use broadcast)
    'crm_records',
    'records',

    -- Communication tables
    'email_campaign_recipients',
    'email_sends',
    'sms_sends',

    -- Billing tables
    'billing_transactions',
    'payment_transactions',

    -- Other high-write tables
    'enrollments',
    'enrollment_history'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY tables_to_remove
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I', tbl);
      RAISE NOTICE 'Removed % from supabase_realtime', tbl;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- Set REPLICA IDENTITY for tables that DO need realtime (if any remain)
-- FULL allows row-level filtering without primary key lookups
-- ============================================================================

-- Only set on tables that clients actually subscribe to via postgres_changes
-- Since we switched to broadcast, this may not be needed, but keeping for safety
DO $$
BEGIN
  -- crm_records - in case any component still uses postgres_changes
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'crm_records') THEN
    ALTER TABLE crm_records REPLICA IDENTITY FULL;
    RAISE NOTICE 'Set REPLICA IDENTITY FULL on crm_records';
  END IF;
END $$;

-- ============================================================================
-- Verify publication is minimal
-- After this migration, check what remains:
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- ============================================================================
