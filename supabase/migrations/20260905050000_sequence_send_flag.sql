-- Closed-by-default gate for automated sequence delivery.
--
-- Sequences fire on a timer with nobody watching, so they get their own switch
-- rather than riding on crm.comms.campaign_send. With this closed, the every-
-- minute processor leaves due enrollments untouched and reports them as
-- skipped, so opening the flag resumes them exactly where they stopped.
--
-- Purely additive: one row in a config table. Nothing reads it until the
-- accompanying application code ships, and absent rows already resolve to
-- false via the isCommsFlagEnabled fallback.
--
-- Rollback:
--   delete from public.crm_feature_flags
--   where organization_id is null and flag_key = 'crm.comms.sequence_send';

begin;

set local lock_timeout = '5s';

-- Guarded rather than ON CONFLICT: global uniqueness is a partial index
-- (flag_key WHERE organization_id IS NULL).
insert into public.crm_feature_flags (organization_id, flag_key, enabled, description)
select
  null,
  'crm.comms.sequence_send',
  false,
  'Allows automated email sequence steps to send. Off by default.'
where not exists (
  select 1
  from public.crm_feature_flags
  where organization_id is null
    and flag_key = 'crm.comms.sequence_send'
);

commit;
