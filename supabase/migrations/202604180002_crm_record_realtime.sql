-- ============================================================================
-- Realtime for filtered per-record subscriptions (V2 record detail)
-- ============================================================================
--
-- Context:
--   Migration `202601290002_optimize_realtime.sql` dropped crm_records,
--   crm_notes, crm_tasks, crm_activities, and crm_audit_logs from the
--   supabase_realtime publication to avoid 74% DB load from un-filtered
--   global subscriptions.
--
-- What changed:
--   The V2 record detail shell (`useLiveRecord` hook) only ever opens
--   a Supabase Realtime channel scoped to a single record id, i.e.:
--
--     postgres_changes:
--       schema: public
--       table:  crm_notes
--       filter: record_id=eq.<uuid>
--
--   With `REPLICA IDENTITY FULL` set, Supabase evaluates the filter on
--   the server, so the WAL-to-client fanout cost is O(events for this
--   record) rather than O(events for all CRM records). This is the safe
--   per-record collaborative signals pattern used by Zoho / Salesforce.
--
--   If load becomes an issue again, revert by dropping the publication
--   lines at the bottom of this file.
--
-- Idempotent: all statements are guarded with `IF NOT EXISTS` checks.
-- ============================================================================

-- Tables that the V2 record detail page subscribes to.
DO $$
DECLARE
  tbl text;
  realtime_tables text[] := ARRAY[
    'crm_records',
    'crm_notes',
    'crm_tasks',
    'crm_attachments',
    'crm_stage_history',
    'crm_audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY realtime_tables
  LOOP
    -- Only act when the table exists (keeps this migration safe across
    -- environments that may not have every CRM module installed).
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- 1. Add to publication if missing.
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = tbl
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE %I',
          tbl
        );
      END IF;

      -- 2. Set replica identity so server-side filters work for all
      --    columns we reference (id, record_id).
      EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', tbl);
    END IF;
  END LOOP;
END $$;

-- After applying, restart the Realtime service so it picks up the new
-- publication membership:
--   supabase db restart  (CLI)
--   Or restart from Supabase Dashboard -> Realtime.
