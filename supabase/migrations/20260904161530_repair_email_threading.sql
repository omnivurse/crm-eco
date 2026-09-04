-- Repair email threads damaged by two intake defects.
--
-- 1. References parsing. email-intake split the `References` header on
--    whitespace. When a provider hands that header over JSON-encoded, the
--    split yields one bogus token instead of a list of ids. Every outbound
--    reply then wrapped that token in angle brackets, the next inbound quoted
--    the result, and the corruption nested one level deeper per round trip.
--    Consequences: intake could not match the thread, and the reply we sent
--    carried a References header the recipient's client could not stitch, so
--    it forked the thread on their side too.
--
-- 2. Thread splitting. A colleague who was CC'd on a thread and then replied
--    was refused entry to it, because the intake guard only admitted the
--    conversation's contact and prior inbound senders. One chain became two
--    conversations with the same subject, each holding partial history, which
--    is what made the message order unreadable in the CRM.
--
-- The code fixes ship alongside this migration (`_shared/rfc822-references.ts`
-- and the participant test in `_shared/inbox-threading.ts`). This file repairs
-- the rows those defects already wrote.
--
-- Both steps are idempotent: once repaired, rows no longer match the selection
-- predicates, so re-running is a no-op. Every mutated row records its prior
-- value under `metadata.threading_repair` so the change is reversible without
-- a backup restore (see the rollback notes at the foot of this file).

-- Fail fast rather than queue behind live inbox traffic.
set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Step 1 — recover References chains from the mangled values.
-- ---------------------------------------------------------------------------
-- The recovery scans for well-formed addr-spec tokens and ignores whatever
-- wrapped them, so it is indifferent to nesting depth. This is the same rule
-- the TypeScript parser applies, kept deliberately in sync.

with damaged as (
  select id, references_ids
  from inbox_messages
  where references_ids is not null
    and exists (
      select 1
      from unnest(references_ids) as r
      where r like '[%' or r like '<[%' or r like '%"%'
    )
),
hits as (
  select d.id, (m.match)[1] as ref, m.ord
  from damaged d
  cross join lateral regexp_matches(
    array_to_string(d.references_ids, ' '),
    '<[^<>[:space:]]+@[^<>[:space:]]+>',
    'g'
  ) with ordinality as m(match, ord)
),
deduped as (
  -- First occurrence wins, so the recovered chain keeps its original order.
  select id, ref, min(ord) as ord
  from hits
  group by id, ref
),
recovered as (
  select id, array_agg(ref order by ord) as ids
  from deduped
  group by id
)
update inbox_messages m
set references_ids = r.ids,
    metadata = coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object(
      'threading_repair',
      coalesce(m.metadata -> 'threading_repair', '{}'::jsonb) || jsonb_build_object(
        'previous_references_ids', to_jsonb(m.references_ids),
        'repaired_at', now()
      )
    )
from recovered r
where m.id = r.id
  and m.references_ids is distinct from r.ids;

-- ---------------------------------------------------------------------------
-- Step 2 — reunite threads the sender guard split.
-- ---------------------------------------------------------------------------
-- Eligibility mirrors the guard's new rule exactly: merge only where every
-- inbound sender on the losing thread was already a party to the surviving
-- thread. A conversation that genuinely belongs to a different counterpart is
-- left alone, so this cannot collapse unrelated threads together.

create temporary table _thread_merge on commit drop as
with links as (
  -- A reply whose parent lives in another conversation is a split thread.
  select distinct
    child.conversation_id  as losing_id,
    parent.conversation_id as surviving_id
  from inbox_messages child
  join inbox_messages parent
    on parent.message_id = child.in_reply_to
   and parent.org_id = child.org_id
  where child.in_reply_to is not null
    and child.conversation_id <> parent.conversation_id
),
participants as (
  -- Everyone a thread has addressed, in either direction.
  select m.conversation_id, lower(trim(p.email)) as email
  from inbox_messages m
  cross join lateral (
    select m.from_address as email
    union all
    select m.to_address
    union all
    select cc ->> 'email'
    from jsonb_array_elements(
      case when jsonb_typeof(m.cc_addresses) = 'array' then m.cc_addresses else '[]'::jsonb end
    ) as cc
  ) as p
  where p.email is not null and trim(p.email) <> ''
)
select l.losing_id, l.surviving_id
from links l
join inbox_conversations lc on lc.id = l.losing_id
join inbox_conversations sc on sc.id = l.surviving_id
where lc.org_id = sc.org_id
  -- Never move a thread across shared mailboxes; each role owns its queue.
  and coalesce(lc.mailbox_address, '') = coalesce(sc.mailbox_address, '')
  and not exists (
    select 1
    from inbox_messages lm
    where lm.conversation_id = l.losing_id
      and lm.direction = 'inbound'
      and lower(trim(lm.from_address)) not in (
        select p.email from participants p where p.conversation_id = l.surviving_id
      )
  )
  -- A conversation can only be merged in one direction.
  and l.losing_id not in (select surviving_id from links);

-- Move the messages, recording where each came from.
update inbox_messages m
set conversation_id = t.surviving_id,
    metadata = coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object(
      'threading_repair',
      coalesce(m.metadata -> 'threading_repair', '{}'::jsonb) || jsonb_build_object(
        'previous_conversation_id', m.conversation_id,
        'merged_at', now()
      )
    )
from _thread_merge t
where m.conversation_id = t.losing_id;

-- Read cursors are keyed (conversation_id, user_id): drop the losing row when
-- the same user already has one on the survivor, keeping the later position.
update inbox_conversation_reads sr
set last_read_at = greatest(sr.last_read_at, lr.last_read_at)
from inbox_conversation_reads lr
join _thread_merge t on t.losing_id = lr.conversation_id
where sr.conversation_id = t.surviving_id
  and sr.user_id = lr.user_id;

delete from inbox_conversation_reads lr
using _thread_merge t
where lr.conversation_id = t.losing_id
  and exists (
    select 1 from inbox_conversation_reads sr
    where sr.conversation_id = t.surviving_id and sr.user_id = lr.user_id
  );

update inbox_conversation_reads r
set conversation_id = t.surviving_id
from _thread_merge t
where r.conversation_id = t.losing_id;

-- Record links are unique per (organization_id, conversation_id, record_id).
delete from communication_record_links lk
using _thread_merge t
where lk.conversation_id = t.losing_id
  and exists (
    select 1 from communication_record_links s
    where s.conversation_id = t.surviving_id
      and s.organization_id = lk.organization_id
      and s.record_id is not distinct from lk.record_id
  );

update communication_record_links lk
set conversation_id = t.surviving_id
from _thread_merge t
where lk.conversation_id = t.losing_id;

-- Remaining children are keyed on their own id, so a straight repoint is safe.
update inbox_assignments x    set conversation_id = t.surviving_id from _thread_merge t where x.conversation_id = t.losing_id;
update inbox_drafts x         set conversation_id = t.surviving_id from _thread_merge t where x.conversation_id = t.losing_id;
update inbox_internal_notes x set conversation_id = t.surviving_id from _thread_merge t where x.conversation_id = t.losing_id;
update inbox_quick_actions x  set conversation_id = t.surviving_id from _thread_merge t where x.conversation_id = t.losing_id;
update message_participants x set conversation_id = t.surviving_id from _thread_merge t where x.conversation_id = t.losing_id;
update crm_calendar_events x  set conversation_id = t.surviving_id from _thread_merge t where x.conversation_id = t.losing_id;
update email_send_outbox x    set conversation_id = t.surviving_id from _thread_merge t where x.conversation_id = t.losing_id;

update provider_inbound_events x set conversation_id = t.surviving_id from _thread_merge t where x.conversation_id = t.losing_id;

-- Counters are maintained by an AFTER INSERT trigger that cannot see a
-- conversation_id move, so recompute them from the messages themselves.
-- unread_count is summed rather than recounted: the trigger only ever
-- increments it, and marking-as-read decrements it elsewhere, so recounting
-- inbound messages would resurrect mail the user has already read.
update inbox_conversations c
set message_count = agg.message_count,
    first_message_at = least(c.first_message_at, agg.first_message_at),
    last_message_at = agg.last_message_at,
    preview = agg.preview,
    unread_count = c.unread_count + coalesce(lost.unread_count, 0),
    updated_at = now()
from (
  select t.surviving_id,
         count(*)          as message_count,
         min(m.sent_at)    as first_message_at,
         max(m.sent_at)    as last_message_at,
         left(coalesce(
           (array_agg(m.body_text order by m.sent_at desc))[1],
           (array_agg(m.subject   order by m.sent_at desc))[1],
           ''
         ), 200) as preview
  from _thread_merge t
  join inbox_messages m on m.conversation_id = t.surviving_id
  group by t.surviving_id
) agg
left join (
  select t.surviving_id, sum(lc.unread_count) as unread_count
  from _thread_merge t
  join inbox_conversations lc on lc.id = t.losing_id
  group by t.surviving_id
) lost on lost.surviving_id = agg.surviving_id
where c.id = agg.surviving_id;

-- The emptied conversations now hold nothing; every child has been repointed.
delete from inbox_conversations c
using _thread_merge t
where c.id = t.losing_id
  and not exists (select 1 from inbox_messages m where m.conversation_id = c.id);

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- Step 1 (References):
--   update inbox_messages m
--   set references_ids = array(
--         select jsonb_array_elements_text(
--           m.metadata -> 'threading_repair' -> 'previous_references_ids'))
--   where m.metadata -> 'threading_repair' ? 'previous_references_ids';
--
-- Step 2 (merge) is reversible per row via
--   metadata -> 'threading_repair' ->> 'previous_conversation_id',
-- but the emptied conversation rows are deleted here, so a full reversal must
-- recreate them from a point-in-time snapshot first. Take one before applying.
