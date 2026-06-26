-- ============================================================================
-- PHASE 2 — Member self-service enablement (member RLS).  ADDITIVE + REVERSIBLE.
--
-- Three parts, all designed so CURRENT (staff-only) access is provably unchanged:
--   (1) Identity: get_user_member_id() helper + allow 'member' in profiles.role.
--   (2) Tighten: append "AND get_user_member_id() IS NULL" to the 117 blanket
--       org-read policies, so a future member cannot read CRM data through them.
--       Every current login has member_id = NULL, so staff access is unchanged.
--       Idempotent: already-tightened policies are skipped on re-run.
--   (3) Member-self policies on the member-owned tables (own rows only).
--
-- Rollback: revert_blanket.sql restores the 117 policies to their exact originals;
-- the member-self policies + helper can be dropped by name.
-- ============================================================================

-- ---- (1) IDENTITY -----------------------------------------------------------
create or replace function private.get_user_member_id()
returns uuid
language sql
stable security definer
set search_path to 'private', 'public', 'pg_catalog'
as $function$
  select member_id from public.profiles where user_id = auth.uid() limit 1
$function$;

-- The caller-member's assigned advisor id. SECURITY DEFINER so the advisors
-- self-policy does NOT subquery `members` under RLS (the existing "Advisors can
-- read their members" policy on members subqueries advisors → that mutual
-- reference would be infinite recursion). Reading members here as definer breaks
-- the cycle.
create or replace function private.get_member_advisor_id()
returns uuid
language sql
stable security definer
set search_path to 'private', 'public', 'pg_catalog'
as $function$
  select m.advisor_id
  from public.members m
  where m.id = (select p.member_id from public.profiles p where p.user_id = auth.uid() limit 1)
  limit 1
$function$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['owner','super_admin','admin','advisor','staff','member']));

-- ---- (2) TIGHTEN THE 117 BLANKET ORG-READ POLICIES (idempotent) -------------
do $tighten$
declare r record;
begin
  for r in
    select n.nspname, c.relname, pol.polname,
           pg_get_expr(pol.polqual, pol.polrelid) as using_expr
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and pol.polcmd in ('r','*')
      and pg_get_expr(pol.polqual, pol.polrelid) ~ 'get_user_organization_id'
      and pg_get_expr(pol.polqual, pol.polrelid) !~ 'get_user_role|is_staff|is_admin|is_super_admin|advisor|member_id|get_user_member_id|auth.uid'
  loop
    execute format(
      'alter policy %I on %I.%I using ((%s) and private.get_user_member_id() is null)',
      r.polname, r.nspname, r.relname, r.using_expr
    );
  end loop;
end
$tighten$;

-- ---- (3) MEMBER-SELF POLICIES (own rows only) -------------------------------
-- members — self read (writes via service-role server actions).
create policy "Members can view their own member record"
  on public.members for select to authenticated
  using (id = private.get_user_member_id());

-- memberships — self read.
create policy "Members can view their own memberships"
  on public.memberships for select to authenticated
  using (member_id = private.get_user_member_id());

-- dependents — full self CRUD.
create policy "Members can view their own dependents"
  on public.dependents for select to authenticated
  using (member_id = private.get_user_member_id());
create policy "Members can add their own dependents"
  on public.dependents for insert to authenticated
  with check (member_id = private.get_user_member_id()
             and organization_id = private.get_user_organization_id());
create policy "Members can update their own dependents"
  on public.dependents for update to authenticated
  using (member_id = private.get_user_member_id())
  with check (member_id = private.get_user_member_id());
create policy "Members can delete their own dependents"
  on public.dependents for delete to authenticated
  using (member_id = private.get_user_member_id());

-- dependent_coverage_periods — self read + insert + update.
create policy "Members can view their own coverage periods"
  on public.dependent_coverage_periods for select to authenticated
  using (member_id = private.get_user_member_id());
create policy "Members can add their own coverage periods"
  on public.dependent_coverage_periods for insert to authenticated
  with check (member_id = private.get_user_member_id()
             and organization_id = private.get_user_organization_id());
create policy "Members can update their own coverage periods"
  on public.dependent_coverage_periods for update to authenticated
  using (member_id = private.get_user_member_id())
  with check (member_id = private.get_user_member_id());

-- enrollments — self read (primary_member_id).
create policy "Members can view their own enrollments"
  on public.enrollments for select to authenticated
  using (primary_member_id = private.get_user_member_id());

-- enrollment_dependents — read via parent enrollment ownership.
create policy "Members can view their own enrollment dependents"
  on public.enrollment_dependents for select to authenticated
  using (enrollment_id in (select e.id from public.enrollments e
                           where e.primary_member_id = private.get_user_member_id()));

-- need_attachments — read + upload, scoped via parent need ownership.
create policy "Members can view attachments on their needs"
  on public.need_attachments for select to authenticated
  using (need_id in (select n.id from public.needs n
                     where n.member_id = private.get_user_member_id()));
create policy "Members can add attachments to their needs"
  on public.need_attachments for insert to authenticated
  with check (need_id in (select n.id from public.needs n
                          where n.member_id = private.get_user_member_id()));

-- member_notifications — self read + update (mark read).
create policy "Members can view their own notifications"
  on public.member_notifications for select to authenticated
  using (member_id = private.get_user_member_id());
create policy "Members can update their own notifications"
  on public.member_notifications for update to authenticated
  using (member_id = private.get_user_member_id())
  with check (member_id = private.get_user_member_id());

-- member_change_requests — self read + create.
create policy "Members can view their own change requests"
  on public.member_change_requests for select to authenticated
  using (member_id = private.get_user_member_id());
create policy "Members can create their own change requests"
  on public.member_change_requests for insert to authenticated
  with check (member_id = private.get_user_member_id()
             and organization_id = private.get_user_organization_id());

-- member_documents — self read.
create policy "Members can view their own documents"
  on public.member_documents for select to authenticated
  using (member_id = private.get_user_member_id());

-- agreement_signatures — read via parent enrollment ownership.
create policy "Members can view signatures on their enrollments"
  on public.agreement_signatures for select to authenticated
  using (enrollment_id in (select e.id from public.enrollments e
                           where e.primary_member_id = private.get_user_member_id()));

-- tickets — self read + create.
create policy "Members can view their own tickets"
  on public.tickets for select to authenticated
  using (member_id = private.get_user_member_id());
create policy "Members can create their own tickets"
  on public.tickets for insert to authenticated
  with check (member_id = private.get_user_member_id()
             and organization_id = private.get_user_organization_id());

-- ticket_comments — read + reply, scoped via parent ticket ownership.
create policy "Members can view comments on their tickets"
  on public.ticket_comments for select to authenticated
  using (ticket_id in (select t.id from public.tickets t
                       where t.member_id = private.get_user_member_id()));
create policy "Members can reply on their tickets"
  on public.ticket_comments for insert to authenticated
  with check (ticket_id in (select t.id from public.tickets t
                            where t.member_id = private.get_user_member_id()));

-- plans — members may read the plan catalog for their org.
create policy "Members can view plans in their org"
  on public.plans for select to authenticated
  using (organization_id = private.get_user_organization_id());

-- advisors — a member may read ONLY their own assigned advisor (recursion-safe
-- via the SECURITY DEFINER helper; see note above).
create policy "Members can view their own advisor"
  on public.advisors for select to authenticated
  using (id = private.get_member_advisor_id());

-- billing — member reads own schedules / failures / transactions / invoices /
-- payment profiles (these are NOT blanket-org policies, so members have no access
-- today; add scoped self-read to power the dashboard + billing pages).
create policy "Members can view their own billing schedules"
  on public.billing_schedules for select to authenticated
  using (member_id = private.get_user_member_id());
create policy "Members can view their own billing failures"
  on public.billing_failures for select to authenticated
  using (member_id = private.get_user_member_id());
create policy "Members can view their own billing transactions"
  on public.billing_transactions for select to authenticated
  using (member_id = private.get_user_member_id());
create policy "Members can view their own invoices"
  on public.invoices for select to authenticated
  using (member_id = private.get_user_member_id());
create policy "Members can view their own payment profiles"
  on public.payment_profiles for select to authenticated
  using (member_id = private.get_user_member_id());
