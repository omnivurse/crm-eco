-- Sponsor / employer OS (Hint-parity packets 1–6).
-- Additive / reversible. PROD WRITE RISK: YES when applied (DDL + policies).
-- Do not apply to production without explicit approval.
--
-- Rollback:
--   alter table public.landing_pages drop column if exists sponsor_id;
--   alter table public.enrollment_links drop column if exists sponsor_id;
--   alter table public.enrollments drop column if exists sponsor_id;
--   alter table public.memberships drop column if exists sponsor_id;
--   alter table public.invoices drop column if exists sponsor_id;
--   alter table public.invoices drop column if exists payer_type;
--   alter table public.invoices drop column if exists period_start;
--   alter table public.invoices drop column if exists period_end;
--   alter table public.invoices drop column if exists line_items;
--   drop table if exists public.sponsor_eligibility_events;
--   drop table if exists public.sponsor_roster_import_rows;
--   drop table if exists public.sponsor_roster_imports;
--   drop table if exists public.sponsorships;
--   drop table if exists public.sponsor_roster;
--   drop table if exists public.sponsor_admins;
--   drop table if exists public.sponsor_plans;
--   drop table if exists public.sponsors;

begin;

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) Core tables
-- ---------------------------------------------------------------------------

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  legal_name text,
  status text not null default 'active'
    check (status in ('draft', 'active', 'inactive')),
  billing_start_date date,
  enrollment_cutoff_day integer not null default 1
    check (enrollment_cutoff_day between 1 and 28),
  backbill_months integer not null default 6
    check (backbill_months between 0 and 24),
  dependent_cap integer
    check (dependent_cap is null or dependent_cap >= 0),
  allow_multiple_plans boolean not null default false,
  default_plan_id uuid references public.plans (id),
  billing_email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists idx_sponsors_org_status
  on public.sponsors (organization_id, status);

create table if not exists public.sponsor_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  is_default boolean not null default false,
  available_for_enrollment boolean not null default true,
  created_at timestamptz not null default now(),
  unique (sponsor_id, plan_id)
);

create index if not exists idx_sponsor_plans_org
  on public.sponsor_plans (organization_id, sponsor_id);

create table if not exists public.sponsor_admins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  user_id uuid references auth.users (id),
  email text not null,
  role text not null default 'admin'
    check (role in ('admin', 'billing', 'roster')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sponsor_id, email)
);

create index if not exists idx_sponsor_admins_user
  on public.sponsor_admins (user_id)
  where user_id is not null;

create table if not exists public.sponsor_roster (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  email text,
  external_id text,
  relationship text not null default 'employee'
    check (relationship in ('employee', 'spouse', 'child')),
  subscriber_roster_id uuid references public.sponsor_roster (id),
  status text not null default 'eligible'
    check (status in ('eligible', 'pending_approval', 'enrolled', 'terminated')),
  eligible_start date,
  eligible_end date,
  member_id uuid references public.members (id),
  match_key text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.sponsor_roster_set_match_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.match_key := lower(trim(new.first_name)) || '|' || lower(trim(new.last_name)) || '|' ||
    coalesce(to_char(new.date_of_birth, 'YYYY-MM-DD'), '');
  return new;
end;
$$;

drop trigger if exists trg_sponsor_roster_match_key on public.sponsor_roster;
create trigger trg_sponsor_roster_match_key
  before insert or update of first_name, last_name, date_of_birth
  on public.sponsor_roster
  for each row
  execute function public.sponsor_roster_set_match_key();

create index if not exists idx_sponsor_roster_match
  on public.sponsor_roster (organization_id, sponsor_id, match_key);

create index if not exists idx_sponsor_roster_status
  on public.sponsor_roster (sponsor_id, status);

create table if not exists public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  roster_id uuid references public.sponsor_roster (id),
  member_id uuid references public.members (id),
  membership_id uuid references public.memberships (id),
  enrollment_id uuid references public.enrollments (id),
  role text not null default 'employee'
    check (role in ('employee', 'spouse', 'child')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'ended', 'needs_approval')),
  effective_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sponsorships_sponsor_status
  on public.sponsorships (sponsor_id, status);

create unique index if not exists idx_sponsorships_active_member
  on public.sponsorships (sponsor_id, member_id)
  where status in ('pending', 'active', 'needs_approval') and member_id is not null;

create table if not exists public.sponsor_roster_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  mode text not null check (mode in ('dry_run', 'apply')),
  filename text,
  total_rows integer not null default 0,
  matched_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,
  terminated_rows integer not null default 0,
  error_rows integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.sponsor_roster_import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  import_id uuid not null references public.sponsor_roster_imports (id) on delete cascade,
  row_number integer not null,
  action text not null check (action in ('insert', 'update', 'terminate', 'match', 'error', 'skip')),
  payload jsonb not null default '{}'::jsonb,
  message text
);

create table if not exists public.sponsor_eligibility_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  roster_id uuid references public.sponsor_roster (id),
  sponsorship_id uuid references public.sponsorships (id),
  membership_id uuid references public.memberships (id),
  event_type text not null
    check (event_type in ('ended', 'skipped', 'error')),
  message text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) Additive columns on existing tables
-- ---------------------------------------------------------------------------

alter table public.landing_pages
  add column if not exists sponsor_id uuid references public.sponsors (id);

alter table public.enrollment_links
  add column if not exists sponsor_id uuid references public.sponsors (id);

alter table public.enrollments
  add column if not exists sponsor_id uuid references public.sponsors (id);

alter table public.memberships
  add column if not exists sponsor_id uuid references public.sponsors (id);

alter table public.invoices
  add column if not exists sponsor_id uuid references public.sponsors (id);

alter table public.invoices
  add column if not exists payer_type text default 'member';

alter table public.invoices
  add column if not exists period_start date;

alter table public.invoices
  add column if not exists period_end date;

alter table public.invoices
  add column if not exists line_items jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_payer_type_check'
  ) then
    alter table public.invoices
      add constraint invoices_payer_type_check
      check (payer_type in ('member', 'sponsor'));
  end if;
end $$;

create index if not exists idx_invoices_sponsor_period
  on public.invoices (sponsor_id, period_start, period_end)
  where sponsor_id is not null;

create unique index if not exists idx_invoices_one_sponsor_period
  on public.invoices (organization_id, sponsor_id, period_start, period_end)
  where payer_type = 'sponsor' and sponsor_id is not null
    and period_start is not null and period_end is not null
    and coalesce(status, 'draft') not in ('void', 'cancelled');

-- ---------------------------------------------------------------------------
-- 3) RLS — fail closed. Org staff via membership. Sponsor admins see own sponsor.
-- Anon: no access.
-- ---------------------------------------------------------------------------

alter table public.sponsors enable row level security;
alter table public.sponsor_plans enable row level security;
alter table public.sponsor_admins enable row level security;
alter table public.sponsor_roster enable row level security;
alter table public.sponsorships enable row level security;
alter table public.sponsor_roster_imports enable row level security;
alter table public.sponsor_roster_import_rows enable row level security;
alter table public.sponsor_eligibility_events enable row level security;

revoke all on public.sponsors from anon, public;
revoke all on public.sponsor_plans from anon, public;
revoke all on public.sponsor_admins from anon, public;
revoke all on public.sponsor_roster from anon, public;
revoke all on public.sponsorships from anon, public;
revoke all on public.sponsor_roster_imports from anon, public;
revoke all on public.sponsor_roster_import_rows from anon, public;
revoke all on public.sponsor_eligibility_events from anon, public;

grant select, insert, update, delete on public.sponsors to authenticated;
grant select, insert, update, delete on public.sponsor_plans to authenticated;
grant select, insert, update, delete on public.sponsor_admins to authenticated;
grant select, insert, update, delete on public.sponsor_roster to authenticated;
grant select, insert, update, delete on public.sponsorships to authenticated;
grant select, insert, update, delete on public.sponsor_roster_imports to authenticated;
grant select, insert, update, delete on public.sponsor_roster_import_rows to authenticated;
grant select, insert, update on public.sponsor_eligibility_events to authenticated;

create or replace function public.is_sponsor_admin(p_sponsor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sponsor_admins a
    where a.sponsor_id = p_sponsor_id
      and a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_sponsor_admin(uuid) from public, anon;
grant execute on function public.is_sponsor_admin(uuid) to authenticated;
revoke all on function public.sponsor_roster_set_match_key() from public, anon;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sponsors',
    'sponsor_plans',
    'sponsor_admins',
    'sponsor_roster',
    'sponsorships',
    'sponsor_roster_imports',
    'sponsor_roster_import_rows',
    'sponsor_eligibility_events'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_org_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_org_write', t);
  end loop;
  execute 'drop policy if exists sponsor_admins_self_claim on public.sponsor_admins';
end $$;

create policy sponsors_org_select on public.sponsors
  for select to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or public.is_sponsor_admin(id)
  );

create policy sponsors_org_write on public.sponsors
  for all to authenticated
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

create policy sponsor_plans_org_select on public.sponsor_plans
  for select to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or public.is_sponsor_admin(sponsor_id)
  );

create policy sponsor_plans_org_write on public.sponsor_plans
  for all to authenticated
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

create policy sponsor_admins_org_select on public.sponsor_admins
  for select to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or user_id = auth.uid()
    or public.is_sponsor_admin(sponsor_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy sponsor_admins_self_claim on public.sponsor_admins
  for update to authenticated
  using (
    user_id is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    user_id = auth.uid()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy sponsor_admins_org_write on public.sponsor_admins
  for all to authenticated
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

create policy sponsor_roster_org_select on public.sponsor_roster
  for select to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or public.is_sponsor_admin(sponsor_id)
  );

create policy sponsor_roster_org_write on public.sponsor_roster
  for all to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or public.is_sponsor_admin(sponsor_id)
  )
  with check (
    organization_id = public.get_user_organization_id()
    or public.is_sponsor_admin(sponsor_id)
  );

create policy sponsorships_org_select on public.sponsorships
  for select to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or public.is_sponsor_admin(sponsor_id)
  );

create policy sponsorships_org_write on public.sponsorships
  for all to authenticated
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

create policy sponsor_roster_imports_org_select on public.sponsor_roster_imports
  for select to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or public.is_sponsor_admin(sponsor_id)
  );

create policy sponsor_roster_imports_org_write on public.sponsor_roster_imports
  for all to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or public.is_sponsor_admin(sponsor_id)
  )
  with check (
    organization_id = public.get_user_organization_id()
    or public.is_sponsor_admin(sponsor_id)
  );

create policy sponsor_roster_import_rows_org_select on public.sponsor_roster_import_rows
  for select to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or exists (
      select 1
      from public.sponsor_roster_imports i
      where i.id = import_id
        and public.is_sponsor_admin(i.sponsor_id)
    )
  );

create policy sponsor_roster_import_rows_org_write on public.sponsor_roster_import_rows
  for all to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or exists (
      select 1
      from public.sponsor_roster_imports i
      where i.id = import_id
        and public.is_sponsor_admin(i.sponsor_id)
    )
  )
  with check (
    organization_id = public.get_user_organization_id()
    or exists (
      select 1
      from public.sponsor_roster_imports i
      where i.id = import_id
        and public.is_sponsor_admin(i.sponsor_id)
    )
  );

create policy sponsor_eligibility_events_org_select on public.sponsor_eligibility_events
  for select to authenticated
  using (organization_id = public.get_user_organization_id());

create policy sponsor_eligibility_events_org_write on public.sponsor_eligibility_events
  for all to authenticated
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

-- ---------------------------------------------------------------------------
-- 4) RPCs used by enroll + eligibility job (org-scoped, fail closed)
-- ---------------------------------------------------------------------------

create or replace function public.sponsor_match_roster(
  p_org_id uuid,
  p_sponsor_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date
)
returns table (
  roster_id uuid,
  status text,
  relationship text,
  member_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if p_org_id is null or p_sponsor_id is null then
    return;
  end if;

  if auth.uid() is not null
     and public.get_user_organization_id() is distinct from p_org_id
     and not public.is_sponsor_admin(p_sponsor_id) then
    raise exception 'not authorized';
  end if;

  v_key := lower(trim(p_first_name)) || '|' || lower(trim(p_last_name)) || '|' ||
           coalesce(to_char(p_date_of_birth, 'YYYY-MM-DD'), '');

  return query
    select r.id, r.status, r.relationship, r.member_id
    from public.sponsor_roster r
    where r.organization_id = p_org_id
      and r.sponsor_id = p_sponsor_id
      and r.match_key = v_key
      and r.status <> 'terminated'
    limit 2;
end;
$$;

revoke all on function public.sponsor_match_roster(uuid, uuid, text, text, date) from public, anon;
grant execute on function public.sponsor_match_roster(uuid, uuid, text, text, date) to authenticated, service_role;

comment on function public.sponsor_match_roster(uuid, uuid, text, text, date) is
  'Match a person to a sponsor roster on first|last|YYYY-MM-DD. Service-role or same-org only.';

drop policy if exists invoices_sponsor_admin_select on public.invoices;
create policy invoices_sponsor_admin_select on public.invoices
  for select to authenticated
  using (
    payer_type = 'sponsor'
    and sponsor_id is not null
    and public.is_sponsor_admin(sponsor_id)
  );

commit;
