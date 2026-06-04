-- Phase 1 — RLS tenant-key cutover, FINISH.
--
-- Catches the remaining policies that reference a bare `org_id` belonging to a
-- PARENT table via subquery (child tables: crm_workflow_steps, _run_logs,
-- email_sequence_*, email_campaign_recipients, crm_import_rows, document_versions).
-- Every org_id column in the schema now has an organization_id sibling (0
-- org_id-only base tables remain), so these parent references rewrite safely.
--
-- Same guarantees as the rollout: behavior-preserving, word-boundary-safe
-- (hierarchy parent_org_id/child_org_id untouched), idempotent, atomic.
do $$
declare
  r        record;
  nq       text;
  nw       text;
  ddl      text;
  rolelist text;
  cnt      int := 0;
begin
  perform set_config('lock_timeout', '8s', true);

  for r in
    select pol.tablename, pol.policyname, pol.permissive, pol.cmd, pol.roles, pol.qual, pol.with_check
    from pg_policies pol
    where pol.schemaname = 'public'
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
    cnt := cnt + 1;
  end loop;

  raise notice 'finished: rewrote % remaining policies to organization_id', cnt;
end $$;
