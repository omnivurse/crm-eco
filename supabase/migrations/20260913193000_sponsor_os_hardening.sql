-- Sponsor OS hardening after packets 1–6.
-- Additive / reversible. No existing row rewrites.
-- PROD WRITE RISK: YES for DDL/privileges only. Expected affected data rows: 0.
--
-- Rollback:
--   drop trigger if exists trg_sponsor_roster_dependent_cap on public.sponsor_roster;
--   drop trigger if exists trg_sponsor_plans_single_plan on public.sponsor_plans;
--   drop function if exists public.sponsor_roster_enforce_dependent_cap();
--   drop function if exists public.sponsor_plans_enforce_single_plan();
--   grant truncate, references, trigger on the sponsor tables to authenticated;

begin;

set local lock_timeout = '5s';

revoke truncate, references, trigger on public.sponsors from authenticated;
revoke truncate, references, trigger on public.sponsor_plans from authenticated;
revoke truncate, references, trigger on public.sponsor_admins from authenticated;
revoke truncate, references, trigger on public.sponsor_roster from authenticated;
revoke truncate, references, trigger on public.sponsorships from authenticated;
revoke truncate, references, trigger on public.sponsor_roster_imports from authenticated;
revoke truncate, references, trigger on public.sponsor_roster_import_rows from authenticated;
revoke truncate, references, trigger on public.sponsor_eligibility_events from authenticated;

create or replace function public.sponsor_roster_enforce_dependent_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cap integer;
  employees integer;
  dependents integer;
begin
  if new.relationship not in ('spouse', 'child') then
    return new;
  end if;
  if new.status = 'terminated' then
    return new;
  end if;

  select s.dependent_cap into cap
  from public.sponsors s
  where s.id = new.sponsor_id;

  if cap is null then
    return new;
  end if;

  select count(*) into employees
  from public.sponsor_roster r
  where r.sponsor_id = new.sponsor_id
    and r.relationship = 'employee'
    and r.status <> 'terminated'
    and r.id is distinct from new.id;

  select count(*) into dependents
  from public.sponsor_roster r
  where r.sponsor_id = new.sponsor_id
    and r.relationship in ('spouse', 'child')
    and r.status <> 'terminated'
    and r.id is distinct from new.id;

  if (dependents + 1) > (cap * greatest(employees, 1)) then
    raise exception 'Dependent cap exceeded for this sponsor (max % per employee)', cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sponsor_roster_dependent_cap on public.sponsor_roster;
create trigger trg_sponsor_roster_dependent_cap
  before insert or update of relationship, status, sponsor_id
  on public.sponsor_roster
  for each row
  execute function public.sponsor_roster_enforce_dependent_cap();

create or replace function public.sponsor_plans_enforce_single_plan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allow_multi boolean;
begin
  select s.allow_multiple_plans into allow_multi
  from public.sponsors s
  where s.id = new.sponsor_id;

  if coalesce(allow_multi, false) then
    return new;
  end if;

  if exists (
    select 1
    from public.sponsor_plans p
    where p.sponsor_id = new.sponsor_id
      and p.id is distinct from new.id
  ) then
    raise exception 'This sponsor allows only one plan'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sponsor_plans_single_plan on public.sponsor_plans;
create trigger trg_sponsor_plans_single_plan
  before insert or update of sponsor_id
  on public.sponsor_plans
  for each row
  execute function public.sponsor_plans_enforce_single_plan();

revoke all on function public.sponsor_roster_enforce_dependent_cap() from public, anon;
revoke all on function public.sponsor_plans_enforce_single_plan() from public, anon;

commit;
