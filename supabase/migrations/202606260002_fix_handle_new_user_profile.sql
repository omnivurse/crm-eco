-- ============================================================================
-- Repair handle_new_user so auth-user creation produces a VALID profile.
--
-- Current trigger inserts only (id, full_name) → violates profiles NOT NULL
-- (user_id/organization_id/email) → every auth.users INSERT fails ("Database
-- error creating new user"). This blocks ALL onboarding (members and staff).
--
-- Fix (corrective + safe):
--   * When user metadata carries organization_id, create a complete profile,
--     including role + member_id from metadata — so member onboarding is a single
--     admin.createUser({ user_metadata: { organization_id, role:'member',
--     member_id, full_name }}) call.
--   * When org metadata is absent, DO NOTHING and never fail auth creation (the
--     app/invite flow can create the profile later). Strictly safer than today.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.raw_user_meta_data ? 'organization_id')
     and coalesce(new.raw_user_meta_data->>'organization_id','') <> '' then
    insert into public.profiles (user_id, organization_id, email, full_name, role, member_id)
    values (
      new.id,
      (new.raw_user_meta_data->>'organization_id')::uuid,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      coalesce(nullif(new.raw_user_meta_data->>'role',''), 'staff'),
      nullif(new.raw_user_meta_data->>'member_id','')::uuid
    )
    on conflict (user_id, organization_id) do update
      set email = excluded.email,
          full_name = coalesce(nullif(excluded.full_name,''), public.profiles.full_name);
  end if;
  return new;
end;
$function$;
