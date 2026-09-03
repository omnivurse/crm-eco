-- Per-user inbox read cursors. Org unread_count stays for mailbox badges.
-- Rollback: DROP FUNCTION public.inbox_unread_count_for_user(uuid);
--           DROP FUNCTION public.inbox_unread_conversation_ids(uuid, integer);
--           DROP TABLE public.inbox_conversation_reads;

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.inbox_conversation_reads (
  org_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  last_seen_message_id uuid NULL REFERENCES public.inbox_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS inbox_conversation_reads_user_org_idx
  ON public.inbox_conversation_reads (org_id, user_id);

CREATE INDEX IF NOT EXISTS inbox_messages_inbound_sent_idx
  ON public.inbox_messages (org_id, conversation_id, sent_at DESC)
  WHERE direction = 'inbound';

ALTER TABLE public.inbox_conversation_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.inbox_conversation_reads FROM PUBLIC, anon;

DROP POLICY IF EXISTS inbox_conversation_reads_select_own ON public.inbox_conversation_reads;
DROP POLICY IF EXISTS inbox_conversation_reads_insert_own ON public.inbox_conversation_reads;
DROP POLICY IF EXISTS inbox_conversation_reads_update_own ON public.inbox_conversation_reads;
DROP POLICY IF EXISTS inbox_conversation_reads_delete_own ON public.inbox_conversation_reads;

CREATE POLICY inbox_conversation_reads_select_own
  ON public.inbox_conversation_reads
  FOR SELECT
  TO authenticated
  USING (
    user_id = public.current_profile_id()
    AND public.can_access_organization(org_id)
  );

CREATE POLICY inbox_conversation_reads_insert_own
  ON public.inbox_conversation_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = public.current_profile_id()
    AND public.can_access_organization(org_id)
  );

CREATE POLICY inbox_conversation_reads_update_own
  ON public.inbox_conversation_reads
  FOR UPDATE
  TO authenticated
  USING (
    user_id = public.current_profile_id()
    AND public.can_access_organization(org_id)
  )
  WITH CHECK (
    user_id = public.current_profile_id()
    AND public.can_access_organization(org_id)
  );

CREATE POLICY inbox_conversation_reads_delete_own
  ON public.inbox_conversation_reads
  FOR DELETE
  TO authenticated
  USING (
    user_id = public.current_profile_id()
    AND public.can_access_organization(org_id)
  );

CREATE OR REPLACE FUNCTION public.inbox_unread_conversation_ids(
  p_org_id uuid,
  p_limit integer DEFAULT 200
)
RETURNS TABLE(conversation_id uuid, latest_inbound_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id, inbound.latest_inbound_at
  FROM public.inbox_conversations c
  JOIN LATERAL (
    SELECT MAX(m.sent_at) AS latest_inbound_at
    FROM public.inbox_messages m
    WHERE m.conversation_id = c.id
      AND m.direction = 'inbound'
  ) inbound ON inbound.latest_inbound_at IS NOT NULL
  LEFT JOIN public.inbox_conversation_reads r
    ON r.conversation_id = c.id
   AND r.user_id = public.current_profile_id()
  WHERE c.org_id = p_org_id
    AND public.can_access_organization(c.org_id)
    AND c.status IN ('open', 'pending')
    AND (r.last_read_at IS NULL OR inbound.latest_inbound_at > r.last_read_at)
  ORDER BY inbound.latest_inbound_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500));
$$;

CREATE OR REPLACE FUNCTION public.inbox_unread_count_for_user(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.inbox_unread_conversation_ids(p_org_id, 500);
$$;

GRANT EXECUTE ON FUNCTION public.inbox_unread_conversation_ids(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_unread_count_for_user(uuid) TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_conversation_reads TO authenticated;
