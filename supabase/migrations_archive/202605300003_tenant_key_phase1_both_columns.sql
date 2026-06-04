-- Phase 1 — reconcile the 4 tables that already had BOTH org_id and
-- organization_id. Read-only analysis confirmed NO true mismatches anywhere
-- (org_id = organization_id wherever both are set).
--
--   agent_levels            : 7 rows with organization_id NULL -> backfill from org_id
--   commissions, crm_reports: empty
--   integration_connections : 1 row, already consistent + has its own dedicated
--                             sync (sync_integration_conn_org_id) -> left untouched.
--
-- Adds the shared sync trigger so these stay in step going forward. Additive,
-- reversible, no data overwritten (only NULLs filled).
set local lock_timeout = '8s';

update public.agent_levels set organization_id = org_id
  where organization_id is null and org_id is not null;

do $$
declare t text;
begin
  foreach t in array array['agent_levels','commissions','crm_reports'] loop
    execute format('drop trigger if exists trg_sync_org_tenant_key on public.%I', t);
    execute format(
      'create trigger trg_sync_org_tenant_key before insert or update on public.%I '
      || 'for each row execute function public.sync_org_tenant_key()', t);
    execute format('create index if not exists %I on public.%I(organization_id)',
      'idx_' || t || '_organization_id', t);
  end loop;
end $$;
