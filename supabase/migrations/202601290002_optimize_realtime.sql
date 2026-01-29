-- Realtime Publication Optimization
-- Reduces WAL overhead by limiting which tables are in the realtime publication
--
-- Current issue: Realtime is polling ALL WAL entries, consuming 74% of DB resources
-- Solution: Only publish tables that actually need realtime subscriptions

-- ============================================================================
-- STEP 1: Drop tables that DON'T need realtime from publication
-- These are high-write tables where realtime isn't used
-- ============================================================================

-- Remove high-write CRM tables (polling/TanStack Query used instead)
DO $$
DECLARE
  tbl text;
  tables_to_remove text[] := ARRAY[
    'crm_records', 'crm_activities', 'crm_notes', 'crm_tasks',
    'crm_audit_logs', 'activities', 'audit_logs', 'email_campaign_recipients'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_remove
  LOOP
    -- Check if table is in the publication before trying to remove
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I', tbl);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Ensure needed tables ARE in the publication
-- These tables have active realtime subscriptions in the app
-- ============================================================================

-- Change events (used by CrmTopBar change ticker)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'change_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE change_events;
  END IF;
END $$;

-- Admin notifications (used by AdminNotificationListener)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add replica identity for filtered subscriptions
-- This allows filtering subscriptions to specific rows (by org_id, user_id)
-- which further reduces WAL processing overhead
-- ============================================================================

-- Change events needs full replica identity for org_id filtering
ALTER TABLE change_events REPLICA IDENTITY FULL;

-- Admin notifications needs full replica identity for user_id filtering
ALTER TABLE admin_notifications REPLICA IDENTITY FULL;

-- ============================================================================
-- NOTE: After applying this migration, restart the Realtime service
-- to pick up the publication changes:
--   supabase db restart (if using CLI)
--   Or restart from Supabase dashboard
-- ============================================================================
