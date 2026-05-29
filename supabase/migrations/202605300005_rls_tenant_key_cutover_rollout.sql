-- Phase 1 — RLS tenant-key cutover, ROLLOUT (all eligible tables).
--
-- Behavior-preserving rewrite of every RLS policy that references the tenant
-- column `org_id`, switching it to `organization_id`. org_id == organization_id
-- everywhere (verified), so policies evaluate identically — this only removes
-- the `org_id` dependency ahead of eventually dropping that column.
--
-- Safety:
--   * Only tables with BOTH columns are eligible.
--   * \yorg_id\y word boundary -> never touches organization_id / parent_org_id /
--     child_org_id / get_*_org_ids (the franchise/hierarchy policies are untouched).
--   * IDEMPOTENT: already-rewritten policies don't match \yorg_id\y, so re-running
--     is a no-op.
--   * The whole loop is ONE DO block = one transaction -> atomic, no policy gap.
--   * lock_timeout is set INSIDE the block (set_config) so it actually applies
--     under db push's autocommit; if a table can't be locked fast we fail + roll back.

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
    cnt := cnt + 1;
  end loop;

  raise notice 'rewrote % RLS policies from org_id to organization_id', cnt;
end $$;
