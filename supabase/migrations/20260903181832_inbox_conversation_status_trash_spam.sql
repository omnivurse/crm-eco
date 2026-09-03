-- Additive conversation folders: trash + spam.
-- Rollback: UPDATE inbox_conversations SET status = 'archived' WHERE status IN ('trash','spam');
--           ALTER TABLE inbox_conversations DROP CONSTRAINT inbox_conversations_status_check;
--           ALTER TABLE inbox_conversations ADD CONSTRAINT inbox_conversations_status_check
--             CHECK (status = ANY (ARRAY['open','pending','snoozed','resolved','archived']));

SET lock_timeout = '5s';

ALTER TABLE public.inbox_conversations
  DROP CONSTRAINT IF EXISTS inbox_conversations_status_check;

ALTER TABLE public.inbox_conversations
  ADD CONSTRAINT inbox_conversations_status_check
  CHECK (status = ANY (ARRAY[
    'open'::text,
    'pending'::text,
    'snoozed'::text,
    'resolved'::text,
    'archived'::text,
    'trash'::text,
    'spam'::text
  ]));
