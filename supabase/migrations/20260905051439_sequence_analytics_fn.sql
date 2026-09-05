-- Aggregated analytics for one email sequence.
--
-- Why a function rather than client-side counting:
--
--   1. Engagement lives in sent_emails / email_events, whose SELECT policies
--      are restricted to owner/admin/staff. A sequence itself is visible to
--      every member of the org, so reading these tables directly would show
--      members zeros while showing admins real numbers for the same screen.
--   2. Aggregating in Postgres returns a few hundred bytes instead of a row
--      per sent email per enrollment.
--
-- SECURITY DEFINER is therefore deliberate, and constrained:
--   * the caller must pass can_access_organization() for the sequence's org,
--     which resolves through auth.uid(), so it is the *caller* being checked
--     even though the body runs as the owner;
--   * only counts are returned — no addresses, subjects or bodies;
--   * EXECUTE is revoked from public/anon and granted to authenticated only.
--
-- Rollback:
--   drop function if exists public.sequence_analytics(uuid);

begin;

set local lock_timeout = '5s';

create or replace function public.sequence_analytics(p_sequence_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
  v_result jsonb;
begin
  select coalesce(organization_id, org_id)
    into v_org
    from public.email_sequences
   where id = p_sequence_id;

  -- Unknown sequence: report nothing rather than leaking existence.
  if v_org is null then
    return null;
  end if;

  if not public.can_access_organization(v_org) then
    raise exception 'not authorized for this sequence'
      using errcode = '42501';
  end if;

  with sends as (
    select
      se.id,
      -- sent_at, not status, marks a successful send. A trigger on
      -- email_events advances status through the lifecycle
      -- (sent -> delivered -> opened -> bounced), so counting status='sent'
      -- would report only the messages nothing has happened to yet.
      (se.sent_at is not null) as was_sent,
      -- Left as text: metadata is free-form and an invalid uuid here would
      -- abort the whole query on cast.
      se.metadata ->> 'step_id' as step_id
    from public.sent_emails se
    join public.email_sequence_enrollments en on en.id = se.sequence_enrollment_id
    where en.sequence_id = p_sequence_id
  ),
  ev as (
    select e.sent_email_id, e.event_type
    from public.email_events e
    join sends s on s.id = e.sent_email_id
  )
  select jsonb_build_object(
    'funnel', (
      select jsonb_build_object(
        'total',     count(*),
        'active',    count(*) filter (where status = 'active'),
        'paused',    count(*) filter (where status = 'paused'),
        'completed', count(*) filter (where status = 'completed'),
        'exited',    count(*) filter (where status = 'exited')
      )
      from public.email_sequence_enrollments
      where sequence_id = p_sequence_id
    ),
    'email', jsonb_build_object(
      'sent',   (select count(*) from sends where was_sent),
      'failed', (select count(*) from sends where not was_sent),
      -- distinct: a message can emit the same event more than once.
      'delivered',  (select count(distinct sent_email_id) from ev where event_type = 'delivered'),
      'opened',     (select count(distinct sent_email_id) from ev where event_type in ('opened', 'open')),
      'clicked',    (select count(distinct sent_email_id) from ev where event_type in ('clicked', 'click')),
      'bounced',    (select count(distinct sent_email_id) from ev where event_type in ('bounced', 'bounce')),
      'complained', (select count(distinct sent_email_id) from ev where event_type = 'complained')
    ),
    'steps', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.step_order), '[]'::jsonb)
      from (
        select
          st.id,
          st.name,
          st.step_order,
          st.step_type,
          (select count(*) from sends s where s.step_id = st.id::text and s.was_sent) as sent,
          (select count(distinct e.sent_email_id)
             from ev e join sends s on s.id = e.sent_email_id
            where s.step_id = st.id::text and e.event_type in ('opened', 'open')) as opened,
          (select count(distinct e.sent_email_id)
             from ev e join sends s on s.id = e.sent_email_id
            where s.step_id = st.id::text and e.event_type in ('clicked', 'click')) as clicked,
          (select count(distinct e.sent_email_id)
             from ev e join sends s on s.id = e.sent_email_id
            where s.step_id = st.id::text and e.event_type in ('bounced', 'bounce')) as bounced,
          (select count(*)
             from public.email_sequence_step_executions x2
             join public.email_sequence_enrollments en2 on en2.id = x2.enrollment_id
            where en2.sequence_id = p_sequence_id
              and x2.step_id = st.id
              and x2.status = 'skipped') as skipped
        from public.email_sequence_steps st
        where st.sequence_id = p_sequence_id
      ) x
    ),
    'exit_reasons', (
      select coalesce(jsonb_agg(row_to_json(r) order by r.count desc), '[]'::jsonb)
      from (
        select coalesce(exit_reason, 'Unspecified') as reason, count(*) as count
        from public.email_sequence_enrollments
        where sequence_id = p_sequence_id
          and status = 'exited'
        group by 1
        limit 10
      ) r
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.sequence_analytics(uuid) is
  'Aggregate counts for one email sequence. Definer so org members can read '
  'engagement stored in admin-only tables; returns counts only, never PII.';

-- Definer functions must not be callable by anonymous sessions.
revoke all on function public.sequence_analytics(uuid) from public;
revoke all on function public.sequence_analytics(uuid) from anon;
grant execute on function public.sequence_analytics(uuid) to authenticated;

commit;
