-- Layered memberships + prepaid packages + portal shop cart.
-- Additive / reversible. Applied on PIF-ECO-V2 as membership_packages_shop.
-- Grant lock-down is membership_packages_shop_grants.
--
-- Rollback:
--   alter table public.memberships drop column if exists layer;
--   drop function if exists public.sync_member_active_plan_type(); -- restore prior body
--   drop table if exists public.member_package_redemptions;
--   drop table if exists public.member_packages;
--   drop table if exists public.shop_cart_items;
--   drop table if exists public.shop_carts;
--   drop table if exists public.packages;

begin;

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) Membership layer (existing table; default keeps today's 1 row as core)
-- ---------------------------------------------------------------------------

alter table public.memberships
  add column if not exists layer text not null default 'core';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'memberships_layer_check'
      and conrelid = 'public.memberships'::regclass
  ) then
    alter table public.memberships
      add constraint memberships_layer_check
      check (layer in ('core', 'addon'));
  end if;
end $$;

update public.memberships
set custom_fields = coalesce(custom_fields, '{}'::jsonb) || jsonb_build_object('layer', layer)
where custom_fields is null
   or coalesce(custom_fields->>'layer', '') = '';

create unique index if not exists memberships_one_active_core
  on public.memberships (member_id)
  where layer = 'core' and status = 'active';

create unique index if not exists memberships_one_open_sponsored
  on public.memberships (member_id)
  where sponsor_id is not null and status in ('active', 'pending');

create unique index if not exists memberships_no_duplicate_open_plan
  on public.memberships (member_id, plan_id)
  where status in ('active', 'pending');

create or replace function public.sync_member_active_plan_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_type text;
begin
  if new.status = 'active' and coalesce(new.layer, 'core') <> 'addon' then
    select p.plan_type into v_plan_type
    from plans p where p.id = new.plan_id;

    update members
    set active_plan_type = v_plan_type,
        plan_id = new.plan_id,
        plan_type = coalesce(plan_type, v_plan_type)
    where id = new.member_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Package catalog + entitlements
-- ---------------------------------------------------------------------------

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  sku text,
  description text,
  price numeric not null check (price > 0),
  tax_rate numeric not null default 0 check (tax_rate >= 0),
  units integer not null default 1 check (units > 0),
  unit_label text not null default 'units',
  entitlement_kind text not null default 'units'
    check (entitlement_kind in ('visits', 'dollars', 'months', 'units')),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists idx_packages_org_active
  on public.packages (organization_id, is_active);

create table if not exists public.member_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  member_id uuid not null references public.members (id),
  package_id uuid not null references public.packages (id),
  invoice_id uuid references public.invoices (id),
  units_purchased integer not null check (units_purchased > 0),
  units_remaining integer not null check (units_remaining >= 0),
  price_paid numeric not null default 0,
  tax_amount numeric not null default 0,
  deferred_revenue_remaining numeric not null default 0,
  status text not null default 'active'
    check (status in ('active', 'exhausted', 'expired', 'cancelled')),
  purchased_at timestamptz not null default now(),
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_packages_member
  on public.member_packages (organization_id, member_id, status);

create table if not exists public.member_package_redemptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  member_package_id uuid not null references public.member_packages (id) on delete cascade,
  units integer not null check (units > 0),
  notes text,
  redeemed_by uuid,
  redeemed_at timestamptz not null default now()
);

create index if not exists idx_member_package_redemptions_pkg
  on public.member_package_redemptions (member_package_id, redeemed_at desc);

-- ---------------------------------------------------------------------------
-- 3) Portal cart
-- ---------------------------------------------------------------------------

create table if not exists public.shop_carts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  member_id uuid not null references public.members (id),
  status text not null default 'draft'
    check (status in ('draft', 'checked_out', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shop_carts_one_draft
  on public.shop_carts (organization_id, member_id)
  where status = 'draft';

create table if not exists public.shop_cart_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  cart_id uuid not null references public.shop_carts (id) on delete cascade,
  item_type text not null check (item_type in ('plan', 'package')),
  plan_id uuid references public.plans (id),
  package_id uuid references public.packages (id),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  check (
    (item_type = 'plan' and plan_id is not null and package_id is null)
    or (item_type = 'package' and package_id is not null and plan_id is null)
  )
);

create unique index if not exists shop_cart_items_unique_plan
  on public.shop_cart_items (cart_id, plan_id)
  where plan_id is not null;

create unique index if not exists shop_cart_items_unique_package
  on public.shop_cart_items (cart_id, package_id)
  where package_id is not null;

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------

alter table public.packages enable row level security;
alter table public.member_packages enable row level security;
alter table public.member_package_redemptions enable row level security;
alter table public.shop_carts enable row level security;
alter table public.shop_cart_items enable row level security;

revoke all on public.packages from anon, public;
revoke all on public.member_packages from anon, public;
revoke all on public.member_package_redemptions from anon, public;
revoke all on public.shop_carts from anon, public;
revoke all on public.shop_cart_items from anon, public;

grant select, insert, update, delete on public.packages to authenticated;
grant select, insert, update, delete on public.member_packages to authenticated;
grant select, insert, update, delete on public.member_package_redemptions to authenticated;
grant select, insert, update, delete on public.shop_carts to authenticated;
grant select, insert, update, delete on public.shop_cart_items to authenticated;

revoke truncate, references, trigger on public.packages from authenticated;
revoke truncate, references, trigger on public.member_packages from authenticated;
revoke truncate, references, trigger on public.member_package_redemptions from authenticated;
revoke truncate, references, trigger on public.shop_carts from authenticated;
revoke truncate, references, trigger on public.shop_cart_items from authenticated;

drop policy if exists packages_org_select on public.packages;
create policy packages_org_select on public.packages
  for select to authenticated
  using (
    organization_id = public.get_user_organization_id()
    or exists (
      select 1 from public.members m
      where m.id = private.get_user_member_id()
        and m.organization_id = packages.organization_id
    )
  );

drop policy if exists packages_org_write on public.packages;
create policy packages_org_write on public.packages
  for all to authenticated
  using (
    organization_id = public.get_user_organization_id()
    and private.get_user_role() = any (array['owner'::text, 'super_admin'::text, 'admin'::text, 'staff'::text])
  )
  with check (
    organization_id = public.get_user_organization_id()
    and private.get_user_role() = any (array['owner'::text, 'super_admin'::text, 'admin'::text, 'staff'::text])
  );

drop policy if exists member_packages_select on public.member_packages;
create policy member_packages_select on public.member_packages
  for select to authenticated
  using (
    member_id = private.get_user_member_id()
    or (
      organization_id = public.get_user_organization_id()
      and private.get_user_role() = any (array['owner'::text, 'admin'::text, 'staff'::text, 'advisor'::text])
    )
  );

drop policy if exists member_packages_staff_write on public.member_packages;
create policy member_packages_staff_write on public.member_packages
  for all to authenticated
  using (
    organization_id = public.get_user_organization_id()
    and private.get_user_role() = any (array['owner'::text, 'super_admin'::text, 'admin'::text, 'staff'::text])
  )
  with check (
    organization_id = public.get_user_organization_id()
    and private.get_user_role() = any (array['owner'::text, 'super_admin'::text, 'admin'::text, 'staff'::text])
  );

drop policy if exists member_package_redemptions_select on public.member_package_redemptions;
create policy member_package_redemptions_select on public.member_package_redemptions
  for select to authenticated
  using (
    exists (
      select 1 from public.member_packages mp
      where mp.id = member_package_id
        and (
          mp.member_id = private.get_user_member_id()
          or mp.organization_id = public.get_user_organization_id()
        )
    )
  );

drop policy if exists member_package_redemptions_staff_write on public.member_package_redemptions;
create policy member_package_redemptions_staff_write on public.member_package_redemptions
  for all to authenticated
  using (
    organization_id = public.get_user_organization_id()
    and private.get_user_role() = any (array['owner'::text, 'super_admin'::text, 'admin'::text, 'staff'::text])
  )
  with check (
    organization_id = public.get_user_organization_id()
    and private.get_user_role() = any (array['owner'::text, 'super_admin'::text, 'admin'::text, 'staff'::text])
  );

drop policy if exists shop_carts_member on public.shop_carts;
create policy shop_carts_member on public.shop_carts
  for all to authenticated
  using (
    member_id = private.get_user_member_id()
    or organization_id = public.get_user_organization_id()
  )
  with check (
    member_id = private.get_user_member_id()
    or organization_id = public.get_user_organization_id()
  );

drop policy if exists shop_cart_items_member on public.shop_cart_items;
create policy shop_cart_items_member on public.shop_cart_items
  for all to authenticated
  using (
    exists (
      select 1 from public.shop_carts c
      where c.id = cart_id
        and (
          c.member_id = private.get_user_member_id()
          or c.organization_id = public.get_user_organization_id()
        )
    )
  )
  with check (
    exists (
      select 1 from public.shop_carts c
      where c.id = cart_id
        and (
          c.member_id = private.get_user_member_id()
          or c.organization_id = public.get_user_organization_id()
        )
    )
  );

commit;
