-- Let the nav unread badge refresh when a user marks a thread read.
-- Rollback: ALTER PUBLICATION supabase_realtime DROP TABLE public.inbox_conversation_reads;

SET lock_timeout = '5s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'inbox_conversation_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_conversation_reads;
  END IF;
END $$;
