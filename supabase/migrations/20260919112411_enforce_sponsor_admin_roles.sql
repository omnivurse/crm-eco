-- Enforce sponsor-admin roles at the roster write boundary.
-- Additive/reversible helper plus policy replacement. Expected affected rows: 0.
--
-- Rollback:
--   drop policy if exists sponsor_roster_org_write on public.sponsor_roster;
--   create policy sponsor_roster_org_write on public.sponsor_roster
--     for all to authenticated
--     using (
--       organization_id = public.get_user_organization_id()
--       or public.is_sponsor_admin(sponsor_id)
--     )
--     with check (
--       organization_id = public.get_user_organization_id()
--       or public.is_sponsor_admin(sponsor_id)
--     );
--   drop function if exists private.sponsor_admin_has_any_role(uuid, text[]);

begin;

set local lock_timeout = '5s';

create or replace function private.sponsor_admin_has_any_role(
  p_sponsor_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.sponsor_admins a
     where a.sponsor_id = p_sponsor_id
       and a.user_id = auth.uid()
       and a.role = any (p_roles)
  );
$$;

revoke all on function private.sponsor_admin_has_any_role(uuid, text[])
  from public, anon, authenticated;
grant execute on function private.sponsor_admin_has_any_role(uuid, text[])
  to authenticated, service_role;

drop policy if exists sponsor_roster_org_write on public.sponsor_roster;
create policy sponsor_roster_org_write on public.sponsor_roster
  for all to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or private.sponsor_admin_has_any_role(sponsor_id, array['admin', 'roster']::text[])
  )
  with check (
    organization_id = public.get_user_organization_id()
    or private.sponsor_admin_has_any_role(sponsor_id, array['admin', 'roster']::text[])
  );

commit;
