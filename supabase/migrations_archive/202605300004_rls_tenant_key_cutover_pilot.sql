-- Phase 1 — RLS tenant-key cutover, PILOT (crm_visitor_sessions).
--
-- Rewrites RLS policies that reference the tenant column `org_id` to reference
-- `organization_id` instead. This is BEHAVIOR-PRESERVING: org_id == organization_id
-- everywhere (verified 0 mismatches + sync trigger), so the policies evaluate
-- identically. It's a prerequisite for eventually dropping org_id.
--
-- Safety:
--   * \yorg_id\y word-boundary regex only touches the standalone tenant column,
--     never organization_id / parent_org_id / child_org_id / get_*_org_ids.
--   * Only tables that have BOTH org_id and organization_id are eligible.
--   * DROP+CREATE per policy happens inside this migration's single transaction,
--     so there is no window where the policy is missing (atomic to other sessions).
--   * lock_timeout so we never block live traffic.
set local lock_timeout = '8s';

do $$
declare
  r   record;
  nq  text;
  nw  text;
  ddl text;
  rolelist text;
begin
  for r in
    select pol.tablename, pol.policyname, pol.permissive, pol.cmd, pol.roles, pol.qual, pol.with_check
    from pg_policies pol
    where pol.schemaname = 'public'
      and pol.tablename = 'crm_visitor_sessions'                       -- PILOT scope
      and exists (select 1 from information_schema.columns c
                  where c.table_schema='public' and c.table_name=pol.tablename and c.column_name='organization_id')
      and exists (select 1 from information_schema.columns c
                  where c.table_schema='public' and c.table_name=pol.tablename and c.column_name='org_id')
      and (coalesce(pol.qual,'') ~ '\yorg_id\y' or coalesce(pol.with_check,'') ~ '\yorg_id\y')
  loop
    nq := regexp_replace(coalesce(r.qual, ''),       '\yorg_id\y', 'organization_id', 'g');
    nw := regexp_replace(coalesce(r.with_check, ''), '\yorg_id\y', 'organization_id', 'g');
    select string_agg(quote_ident(x), ', ') into rolelist from unnest(r.roles) as x;

    execute format('drop policy %I on public.%I', r.policyname, r.tablename);

    ddl := format('create policy %I on public.%I as %s for %s to %s',
      r.policyname, r.tablename,
      case when r.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      lower(r.cmd), rolelist);
    if r.qual is not null then
      ddl := ddl || format(' using (%s)', nq);
    end if;
    if r.with_check is not null then
      ddl := ddl || format(' with check (%s)', nw);
    end if;
    execute ddl;
    raise notice 'rewrote RLS policy %.% -> organization_id', r.tablename, r.policyname;
  end loop;
end $$;
