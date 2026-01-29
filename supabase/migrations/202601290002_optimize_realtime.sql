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
BEGIN
  -- Try to drop each table, ignore errors if not in publication
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS crm_records;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS crm_activities;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS crm_notes;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS crm_tasks;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS crm_audit_logs;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS activities;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS audit_logs;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  -- Remove email campaign recipients (high-volume, doesn't need realtime)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS email_campaign_recipients;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

-- ============================================================================
-- STEP 2: Ensure needed tables ARE in the publication
-- These tables have active realtime subscriptions in the app
-- ============================================================================

-- Change events (used by CrmTopBar change ticker)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS change_events;

-- Admin notifications (used by AdminNotificationListener)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS admin_notifications;

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
