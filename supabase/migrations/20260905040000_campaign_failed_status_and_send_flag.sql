-- Two things campaigns need before they can run safely.
--
-- 1. `failed` was missing from the status CHECK, but the send path writes it
--    when processing throws. The write was rejected and the error discarded, so
--    a broken campaign sat in `sending` forever with no error_message. Widening
--    the CHECK is additive: every previously valid status stays valid.
--
-- 2. A closed-by-default flag gating bulk campaign delivery. Separate from
--    crm.comms.kill_switch so campaigns can stay shut while ordinary replies and
--    transactional mail keep flowing.
--
-- Rollback:
--   alter table public.email_campaigns drop constraint email_campaigns_status_check;
--   alter table public.email_campaigns add constraint email_campaigns_status_check
--     check (status = any (array['draft','scheduled','sending','paused','sent','cancelled']));
--   delete from public.crm_feature_flags
--     where organization_id is null and flag_key = 'crm.comms.campaign_send';
-- Revert the CHECK only after confirming no row holds 'failed', or the add will
-- not validate.

begin;

set local lock_timeout = '5s';

alter table public.email_campaigns
  drop constraint if exists email_campaigns_status_check;

alter table public.email_campaigns
  add constraint email_campaigns_status_check
  check (status = any (array[
    'draft'::text,
    'scheduled'::text,
    'sending'::text,
    'paused'::text,
    'sent'::text,
    'cancelled'::text,
    'failed'::text
  ]));

-- Guarded rather than ON CONFLICT: the global uniqueness is a partial index
-- (flag_key WHERE organization_id IS NULL).
insert into public.crm_feature_flags (organization_id, flag_key, enabled, description)
select
  null,
  'crm.comms.campaign_send',
  false,
  'Allows bulk campaign delivery. Off by default; a single test send bypasses it.'
where not exists (
  select 1
  from public.crm_feature_flags
  where organization_id is null
    and flag_key = 'crm.comms.campaign_send'
);

commit;
