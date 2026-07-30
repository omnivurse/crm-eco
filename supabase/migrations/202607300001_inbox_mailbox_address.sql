-- =============================================================================
-- Shared mailboxes: tag each inbox conversation with the mailbox it arrived on.
--
-- Resend receives for the whole payitforwardhealth.com domain, so every
-- role address (billing@, enrollment@, support@, ...) already lands in
-- inbox_conversations, but nothing recorded WHICH address was addressed.
-- Without that, agents cannot filter to a single shared queue.
--
-- Additive + idempotent. No existing column or policy is altered.
-- PROD WRITE RISK: YES when applied (adds column, backfills NULL rows only).
-- =============================================================================

SET lock_timeout = '5s';

DO $$
BEGIN
  -- Guard: inbox tables are created by the unified-inbox DDL. Skip cleanly if
  -- this database has not provisioned them yet rather than failing the run.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inbox_conversations'
  ) THEN
    RAISE NOTICE 'inbox_conversations not present; skipping mailbox_address migration';
    RETURN;
  END IF;

  ALTER TABLE public.inbox_conversations
    ADD COLUMN IF NOT EXISTS mailbox_address TEXT;

  COMMENT ON COLUMN public.inbox_conversations.mailbox_address IS
    'Lowercased org-owned address this thread was addressed to (shared mailbox key). NULL for non-email channels and unfiled legacy rows.';
END $$;

-- Filter path is always (org, mailbox, recency). Partial index keeps it small:
-- SMS/phone conversations have no mailbox and would otherwise bloat the index.
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_mailbox
  ON public.inbox_conversations (org_id, mailbox_address, last_message_at DESC)
  WHERE mailbox_address IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill: derive the mailbox from the earliest inbound message's recipient.
-- Only touches rows where mailbox_address IS NULL, so it is safe to re-run and
-- never overwrites a value already set by the intake function.
-- Expected affected rows: one per existing email conversation (small today).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_updated integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inbox_conversations'
      AND column_name = 'mailbox_address'
  ) THEN
    RETURN;
  END IF;

  WITH first_inbound AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      lower(trim(m.to_address)) AS to_address
    FROM public.inbox_messages m
    WHERE m.direction = 'inbound'
      AND m.to_address IS NOT NULL
      AND position('@' in m.to_address) > 0
    ORDER BY m.conversation_id, m.sent_at ASC
  )
  UPDATE public.inbox_conversations c
  SET mailbox_address = f.to_address
  FROM first_inbound f
  WHERE c.id = f.conversation_id
    AND c.mailbox_address IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'mailbox_address backfilled on % conversation(s)', v_updated;
END $$;

-- ---------------------------------------------------------------------------
-- Per-mailbox unread badges.
--
-- Aggregated in the database on purpose: the sidebar needs one number per
-- mailbox, and fetching every unread conversation to count them client-side
-- would not survive production volume.
--
-- SECURITY INVOKER (the default) so the caller's RLS on inbox_conversations
-- still applies and this cannot become a cross-tenant read. The org filter is
-- derived from the caller's own profile, never from a client argument.
-- ---------------------------------------------------------------------------
-- Output columns are deliberately NOT named mailbox_address: a RETURNS TABLE
-- column of that name would shadow inbox_conversations.mailbox_address and make
-- the predicate below ambiguous.
CREATE OR REPLACE FUNCTION public.inbox_unread_by_mailbox()
RETURNS TABLE (mailbox TEXT, unread_conversations BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.mailbox_address AS mailbox,
    count(*) AS unread_conversations
  FROM public.inbox_conversations c
  WHERE c.mailbox_address IS NOT NULL
    AND c.unread_count > 0
    AND c.status IN ('open', 'pending')
    AND c.org_id IN (
      SELECT p.organization_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  GROUP BY c.mailbox_address;
$$;

-- REVOKE FROM PUBLIC is NOT sufficient on Supabase: pg_default_acl for schema
-- public grants EXECUTE directly to anon and authenticated on every new
-- function, and a direct grant survives a PUBLIC revoke. anon must be named
-- explicitly or unauthenticated callers keep execute rights.
REVOKE ALL ON FUNCTION public.inbox_unread_by_mailbox() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inbox_unread_by_mailbox() FROM anon;
GRANT EXECUTE ON FUNCTION public.inbox_unread_by_mailbox() TO authenticated;

-- Rollback notes:
--   DROP FUNCTION IF EXISTS public.inbox_unread_by_mailbox();
--   DROP INDEX IF EXISTS public.idx_inbox_conversations_mailbox;
--   ALTER TABLE public.inbox_conversations DROP COLUMN IF EXISTS mailbox_address;
-- Dropping the column is non-destructive to mail itself: every message still
-- carries to_address, so the backfill can be recomputed at any time.
