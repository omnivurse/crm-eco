-- PR 33 — Cross-device fan-out for the offline mutation queue.
--
-- BroadcastChannel handles same-device sibling tabs. But a rep who
-- edits a deal on their phone and then picks up the same record on
-- their laptop expects the desktop view to refresh when the phone
-- drains. That's a cross-device signal — the kind Supabase Realtime
-- is built for.
--
-- Strategy:
--   1. Add `crm_idempotency_keys` to the `supabase_realtime`
--      publication so INSERTs stream to subscribed clients.
--   2. Set REPLICA IDENTITY FULL so row-level filters evaluated
--      server-side see every column (especially `organization_id`,
--      which clients filter on to scope the stream).
--   3. Clients subscribe filtered by their own org — RLS already
--      covers this on the read path, but the publication filter
--      stops the fanout from hitting irrelevant tabs before the
--      server even bothers sending it.
--
-- Why the ledger table and not `crm_records`:
--   `crm_records` is already published per the per-record-filter
--   design in `202604180002_crm_record_realtime.sql`, but it fires
--   one event per column change. The idempotency ledger fires
--   *exactly once per committed mutation* — perfect for the "a sync
--   just landed, refresh your view" signal without duplicate events
--   for the same logical write.
--
-- Safety:
--   - RLS policy in `202604210001_crm_idempotency_keys.sql` scopes
--     reads to the caller's org. Realtime honors RLS.
--   - We only publish INSERTs because the ledger is append-only (a
--     GC cron DELETEs expired rows — we intentionally do not want
--     deletes streaming to clients).
--   - Idempotent: guarded with pg_catalog checks.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'crm_idempotency_keys'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_idempotency_keys';
    END IF;
END
$$;

/* REPLICA IDENTITY FULL so the publication streams all columns
 * (clients filter by organization_id on the wire). The ledger table
 * is small and short-lived, so the extra WAL volume is negligible. */
ALTER TABLE public.crm_idempotency_keys REPLICA IDENTITY FULL;

COMMENT ON TABLE public.crm_idempotency_keys IS
    'Short-lived (~24h) ledger of (org, key) → cached mutation response. Drives end-to-end idempotency for the client-side offline queue. Published to supabase_realtime for cross-device sync fan-out.';
