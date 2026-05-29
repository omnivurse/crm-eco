-- Phase 1 — tenant-key standardization (org_id -> organization_id), PILOT.
--
-- Strangler step 1: ADDITIVE + REVERSIBLE. Adds `organization_id` mirroring
-- `org_id`, with a bidirectional BEFORE trigger so neither column ever drifts
-- regardless of which one the application writes. `org_id`, FKs, RLS policies,
-- and application code are all left UNTOUCHED — nothing breaks. The destructive
-- `org_id` drop is a separate, much-later migration after code + RLS cut over.
--
-- Pilot scope: crm_territories only (tiny, low-traffic) to validate the pattern
-- on production before rolling to the remaining 123 org_id-only tables.

-- Generic, reusable sync function (used by every table in the full rollout).
create or replace function public.sync_org_tenant_key()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := new.org_id;
  end if;
  if new.org_id is null then
    new.org_id := new.organization_id;
  end if;
  return new;
end;
$$;

-- ── Pilot table: public.crm_territories ───────────────────────────────────
alter table public.crm_territories
  add column if not exists organization_id uuid;

update public.crm_territories
  set organization_id = org_id
  where organization_id is null and org_id is not null;

drop trigger if exists trg_sync_org_tenant_key on public.crm_territories;
create trigger trg_sync_org_tenant_key
  before insert or update on public.crm_territories
  for each row execute function public.sync_org_tenant_key();

create index if not exists idx_crm_territories_organization_id
  on public.crm_territories(organization_id);
