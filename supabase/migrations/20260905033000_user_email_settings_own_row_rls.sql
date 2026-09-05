-- user_email_settings could only be written by owner/admin, so a member-role user
-- silently failed to save any email preference. /api/email/settings upserts, which
-- needs both INSERT and UPDATE to pass, so both are added here.
--
-- Additive: the existing admin-manage and service-role policies are untouched, and
-- permissive policies OR together, so admins keep the access they already had.
-- Rollback: drop the two policies created below; nothing else changes.

begin;

set local lock_timeout = '5s';

drop policy if exists user_email_settings_own_insert on public.user_email_settings;
drop policy if exists user_email_settings_own_update on public.user_email_settings;

-- Pin profile_id and org_id to the SAME profile row owned by the caller, so a user
-- cannot file settings under someone else's profile or park their row in another org.
create policy user_email_settings_own_insert
  on public.user_email_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.id = user_email_settings.profile_id
        and p.organization_id = user_email_settings.org_id
    )
  );

create policy user_email_settings_own_update
  on public.user_email_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.id = user_email_settings.profile_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.id = user_email_settings.profile_id
        and p.organization_id = user_email_settings.org_id
    )
  );

commit;
