-- Realtime Optimization: Remove tables from WAL polling
-- Application code now uses explicit Realtime broadcast instead of postgres_changes
-- This eliminates the 74% WAL overhead from realtime.list_changes

-- ============================================================================
-- Remove tables from Realtime publication
-- These tables will use application-level broadcast instead of WAL polling
-- ============================================================================

DO $$
BEGIN
  -- Remove change_events from publication
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'change_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE change_events;
    RAISE NOTICE 'Removed change_events from supabase_realtime publication';
  END IF;

  -- Remove admin_notifications from publication
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE admin_notifications;
    RAISE NOTICE 'Removed admin_notifications from supabase_realtime publication';
  END IF;
END $$;

-- ============================================================================
-- Note: Realtime updates for these tables are now handled by:
--
-- 1. change_events:
--    - Server broadcasts via @crm-eco/lib/realtime/broadcastChangeEvent()
--    - Client subscribes to broadcast channel `change-events:${orgId}`
--
-- 2. admin_notifications:
--    - Server broadcasts via @crm-eco/lib/realtime/broadcastAdminNotification()
--    - Client subscribes to broadcast channel `admin-notifications:${userId}`
--
-- This approach eliminates WAL polling overhead while maintaining real-time UX.
-- ============================================================================
