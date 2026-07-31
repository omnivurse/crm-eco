-- =============================================================================
-- Turn on realtime for the inbox so new mail can push to the UI.
--
-- The CRM inbox page has subscribed to postgres_changes on inbox_conversations
-- and inbox_messages for some time, but neither table was ever added to the
-- supabase_realtime publication. Verified on the live database:
--
--   select tablename from pg_publication_tables
--    where pubname='supabase_realtime' and tablename like 'inbox%';  -- 0 rows
--
-- So those subscriptions have never delivered an event: the inbox only updates
-- on reload, and nothing can notify an agent that mail arrived. Publishing the
-- tables is what makes the existing code — and the new-email toast — work.
--
-- SAFETY: publishing a table does NOT bypass RLS. Realtime evaluates each
-- subscriber's policies per change, and all three tables have RLS enabled with
-- org/user-scoped policies for `authenticated` and no `anon` policy at all
-- (verified live). A subscriber therefore receives only rows it could already
-- SELECT. If RLS were ever disabled on these tables, this publication would
-- become a live cross-tenant feed — so the guard below refuses to publish a
-- table whose RLS is off, rather than failing open.
--
-- Additive + idempotent. PROD WRITE RISK: YES (replication config only, no data).
-- =============================================================================

SET lock_timeout = '5s';

DO $$
DECLARE
  v_table   text;
  v_tables  text[] := ARRAY['inbox_conversations', 'inbox_messages', 'crm_notifications'];
  v_rls     boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication absent; skipping';
    RETURN;
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      RAISE NOTICE 'table public.% not present; skipping', v_table;
      CONTINUE;
    END IF;

    -- Fail closed: never expose a table over realtime unless RLS gates it.
    SELECT c.relrowsecurity INTO v_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_table;

    IF NOT v_rls THEN
      RAISE EXCEPTION 'refusing to publish public.% over realtime: RLS is disabled', v_table;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table
    ) THEN
      RAISE NOTICE 'public.% already published; skipping', v_table;
    ELSE
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      RAISE NOTICE 'published public.%', v_table;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Replica identity.
--
-- INSERT events carry the whole new row regardless of replica identity, which
-- is all the new-email listener needs. UPDATE/DELETE are different: with the
-- default (primary key only) identity, a server-side filter such as
-- `org_id=eq.<uuid>` cannot be evaluated against the old row, so the inbox's
-- existing `event: '*'` subscription would silently miss read/status changes.
--
-- FULL is therefore set on inbox_conversations, whose rows are small counters
-- and metadata. It is deliberately NOT set on inbox_messages: those rows hold
-- full email bodies, and copying every old body into the WAL on each update
-- would be a real write-amplification cost for an event nobody subscribes to.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inbox_conversations'
  ) THEN
    ALTER TABLE public.inbox_conversations REPLICA IDENTITY FULL;
  END IF;
END $$;

-- Rollback notes:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.inbox_conversations;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.inbox_messages;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.crm_notifications;
--   ALTER TABLE public.inbox_conversations REPLICA IDENTITY DEFAULT;
