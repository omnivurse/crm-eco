-- Stop a late-dated message from dragging its thread down the list, and repair
-- the message counts that are already wrong.
--
-- The inbox list is ordered by `last_message_at DESC`, so that column decides
-- where a thread sits. `update_conversation_on_message` assigns it
-- unconditionally:
--
--     last_message_at = NEW.sent_at
--     preview         = LEFT(COALESCE(NEW.body_text, NEW.subject, ''), 200)
--     message_count   = message_count + 1
--
-- Since 20260904161530 (`inbound sent_at` now comes from the RFC 5322 Date
-- header rather than webhook arrival), any message whose Date is older than the
-- newest one already filed rewinds the thread: a forwarded item, a delayed or
-- retried delivery, or a sender with a slow clock. The thread SINKS at the
-- moment it receives mail, and the preview is replaced with the older text —
-- exactly the "most recent should be on top" complaint, produced by the row the
-- user cannot see.
--
-- No live thread is currently mis-sorted (verified: 0 rows where
-- last_message_at < max(sent_at)), so this is a latent defect. Fixing it before
-- it fires is cheaper than explaining it afterwards.
--
-- `message_count` is a different bug with a visible symptom: the reading pane
-- prints "N messages". 15 of 37 live threads store 2 while holding 1, left over
-- from when intake incremented the counter in addition to this trigger (fixed
-- in email-intake, but the drifted rows were never repaired).
--
-- Design: GREATEST/LEAST are monotonic, so the trigger becomes order-independent
-- — replaying inserts in any sequence converges on the same row. The counter is
-- still incremental (cheap); Step 2 below reconciles the existing drift once.
--
-- Rollback:
--   1. Restore the previous body:
--        CREATE OR REPLACE FUNCTION public.update_conversation_on_message() ...
--          last_message_at = NEW.sent_at,
--          preview = LEFT(COALESCE(NEW.body_text, NEW.subject, ''), 200),
--          message_count = message_count + 1, ...
--   2. The counter repair is data, not schema. Each repaired row records its
--      prior value under metadata.counter_repair, so:
--        UPDATE inbox_conversations SET
--          message_count = (metadata->'counter_repair'->>'message_count')::int,
--          metadata = metadata - 'counter_repair'
--        WHERE metadata ? 'counter_repair';

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Step 1 — make the trigger monotonic.
-- ---------------------------------------------------------------------------
create or replace function public.update_conversation_on_message()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
BEGIN
  UPDATE inbox_conversations
  SET
    message_count = message_count + 1,
    -- A thread's position is the newest message it holds, never the newest
    -- INSERT. Backdated mail joins its thread without moving it.
    last_message_at = GREATEST(last_message_at, NEW.sent_at),
    first_message_at = LEAST(first_message_at, NEW.sent_at),
    -- The list preview must describe the newest message. Only the arrival that
    -- actually becomes the newest may rewrite it.
    preview = CASE
      WHEN NEW.sent_at >= last_message_at
        THEN LEFT(COALESCE(NEW.body_text, NEW.subject, ''), 200)
      ELSE preview
    END,
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$function$;

comment on function public.update_conversation_on_message() is
  'Maintains inbox_conversations counters on message insert. last_message_at / '
  'first_message_at are monotonic (GREATEST/LEAST) so a backdated message '
  'cannot reorder the list, and preview only follows the newest message.';

-- ---------------------------------------------------------------------------
-- Step 2 — reconcile counters that already drifted.
-- ---------------------------------------------------------------------------
-- Idempotent: once a row matches its real count it no longer qualifies, so a
-- re-run touches nothing. The prior value is stamped into metadata first, which
-- makes the repair reversible without a restore.
with actual as (
  select
    c.id,
    c.message_count            as stored_count,
    count(m.id)                as real_count,
    min(m.sent_at)             as real_first,
    max(m.sent_at)             as real_last
  from inbox_conversations c
  join inbox_messages m on m.conversation_id = c.id
  group by c.id, c.message_count
  having count(m.id) <> c.message_count
)
update inbox_conversations c
set
  message_count = a.real_count,
  -- Only ever move these forward/back toward the truth the messages state.
  last_message_at = greatest(c.last_message_at, a.real_last),
  first_message_at = least(c.first_message_at, a.real_first),
  metadata = c.metadata || jsonb_build_object(
    'counter_repair',
    jsonb_build_object(
      'message_count', a.stored_count,
      'last_message_at', c.last_message_at,
      'first_message_at', c.first_message_at,
      'repaired_at', now()
    )
  )
from actual a
where c.id = a.id;
