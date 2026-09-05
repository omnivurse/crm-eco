-- Give sequence sends a foreign key that actually points at sequence enrollments.
--
-- The bug: outbox-process writes payload.enrollment_id into
-- sent_emails.enrollment_id, but that column is FK'd to `enrollments` — the
-- health-plan member enrollment table — while the only code that ever sets
-- the payload field is the sequence engine, which passes an
-- email_sequence_enrollments id. Every sequence send therefore violates the
-- constraint. supabase-js does not throw on insert errors and the call site
-- ignores the returned error, so the row was silently dropped: mail went out,
-- no audit row was written, and every downstream reader (open/click/reply
-- conditions, exit conditions, analytics) saw nothing.
--
-- Fix is additive rather than repointing the existing FK: `enrollment_id`
-- keeps its declared health-plan meaning for future use, and sequences get
-- their own correctly-targeted column. No backfill is required — the column
-- has never held a value (0 rows non-null at time of writing) precisely
-- because every write failed.
--
-- Rollback:
--   drop index if exists public.idx_sent_emails_sequence_enrollment;
--   alter table public.sent_emails drop column if exists sequence_enrollment_id;

begin;

set local lock_timeout = '5s';

alter table public.sent_emails
  add column if not exists sequence_enrollment_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sent_emails'::regclass
      and conname = 'sent_emails_sequence_enrollment_id_fkey'
  ) then
    alter table public.sent_emails
      add constraint sent_emails_sequence_enrollment_id_fkey
      foreign key (sequence_enrollment_id)
      references public.email_sequence_enrollments (id)
      on delete set null;
  end if;
end $$;

comment on column public.sent_emails.sequence_enrollment_id is
  'Email sequence enrollment this send belongs to. Distinct from '
  'enrollment_id, which references health-plan enrollments.';

-- A plain index keeps this migration atomic. The table holds tens of rows, so
-- the build is instantaneous and the brief lock is not worth the split into a
-- non-transactional CONCURRENTLY step.
create index if not exists idx_sent_emails_sequence_enrollment
  on public.sent_emails (sequence_enrollment_id)
  where sequence_enrollment_id is not null;

commit;
