-- Event-driven session revocation.
--
-- SCOPE, DELIBERATELY NARROW: this function exists so that an administrative
-- action can end a user's sessions. It is called from exactly two places — a CRM
-- role change and an account deactivation. There is NO inactivity revocation, NO
-- absolute session lifetime, and NO scheduled job anywhere in this system.
-- Elapsed time never signs anyone out; only an explicit admin action does.
--
-- Why SQL: the Supabase admin client cannot sign out a user by id.
-- GoTrueAdminApi.signOut(jwt) needs that user's own JWT, which an administrator
-- does not have, so the sessions have to be deleted directly.
--
-- Caveat worth knowing: an already-issued access token stays valid until it
-- expires (project JWT expiry, 1 hour by default). Deleting the session stops the
-- refresh, so the session cannot continue past that point. Authorization changes
-- take effect sooner than that on their own, because RLS and the middleware
-- profile lookup both read the live `profiles` row.

set local lock_timeout = '5s';

create or replace function public.revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_deleted integer := 0;
begin
  -- Fail closed. Without this, a null argument would make the predicates below
  -- match nothing (harmless) but would hide a caller bug; return explicitly.
  if p_user_id is null then
    return 0;
  end if;

  -- Deleting the session cascades to the refresh tokens that reference it.
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_deleted = row_count;

  -- Tokens predating the session_id column would survive that cascade.
  -- Compared as text because auth.refresh_tokens.user_id is varchar, and casting
  -- both sides keeps this correct if that ever changes.
  delete from auth.refresh_tokens where user_id::text = p_user_id::text;

  return v_deleted;
end;
$$;

comment on function public.revoke_user_sessions(uuid) is
  'Ends all sessions for one user. Called only from privileged admin actions '
  '(role change, deactivation). Never time- or inactivity-triggered.';

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which would let any
-- signed-in user revoke any other user''s sessions. Take that back explicitly.
revoke all on function public.revoke_user_sessions(uuid) from public;
revoke all on function public.revoke_user_sessions(uuid) from anon;
revoke all on function public.revoke_user_sessions(uuid) from authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- Rollback:
--   drop function if exists public.revoke_user_sessions(uuid);
