-- Phase 1 — tenant-key standardization, ROLLOUT (additive + reversible).
--
-- Applies the proven pilot pattern to every remaining org_id-only BASE TABLE:
-- add `organization_id`, install the bidirectional sync trigger, backfill +
-- index. Views, the already-migrated pilot table, and the 4 both-column tables
-- are excluded. `org_id`, RLS, FKs, and app code stay untouched.
--
-- The two large tables (crm_audit_log ~500k, crm_notes ~194k) get the column +
-- trigger here (instant), but their backfill + index are DEFERRED and run
-- separately in batches / CONCURRENTLY to avoid any lock or bloat spike. Their
-- sync trigger means all NEW/updated rows are populated immediately regardless.

-- Safety: never block live traffic. If a table can't be locked quickly, the
-- whole migration fails fast and rolls back (nothing applied) — we just retry.
set local lock_timeout = '8s';

do $$
declare
  t        text;
  idxname  text;
  big      text[] := array['crm_audit_log','crm_notes'];
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema
     and tb.table_name  = c.table_name
     and tb.table_type  = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name  = 'org_id'
      and not exists (
        select 1 from information_schema.columns c2
        where c2.table_schema = 'public'
          and c2.table_name   = c.table_name
          and c2.column_name  = 'organization_id')
    order by c.table_name
  loop
    execute format('alter table public.%I add column if not exists organization_id uuid', t);

    execute format('drop trigger if exists trg_sync_org_tenant_key on public.%I', t);
    execute format(
      'create trigger trg_sync_org_tenant_key before insert or update on public.%I '
      || 'for each row execute function public.sync_org_tenant_key()', t);

    if not (t = any(big)) then
      execute format(
        'update public.%I set organization_id = org_id '
        || 'where organization_id is null and org_id is not null', t);
      idxname := left('idx_' || t || '_organization_id', 63);
      execute format('create index if not exists %I on public.%I(organization_id)', idxname, t);
    end if;
  end loop;
end $$;
