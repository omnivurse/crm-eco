-- Make inbox_drafts reachable by the people who write drafts.
--
-- Problem: all four policies compare `auth.uid()` (an auth user id) against
-- columns that hold a PROFILE id:
--
--     organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
--     AND author_id   = auth.uid()
--
-- but this deployment's profiles have `id <> user_id`. Verified against live
-- data before writing: 0 of 3 profiles satisfy `id = user_id`, so the subquery
-- returns NULL and `author_id = auth.uid()` is never true. Both halves fail for
-- every account, for every command.
--
-- The API writes `author_id = profile.id` (apps/crm/src/app/api/inbox/drafts/
-- route.ts), so INSERT is refused, SELECT returns nothing, and PUT/DELETE match
-- no row. Consequence: "Save Draft" silently fails, the Drafts folder is
-- permanently empty, and a scheduled send can never be created — the draft row
-- is the only copy of that email. inbox_drafts holds 0 rows in production,
-- which is the symptom, not a coincidence.
--
-- Fix: use the same helpers inbox_conversation_reads already uses successfully
-- (20260903181831) — `current_profile_id()` resolves auth.uid() to profiles.id,
-- and `can_access_organization()` is the shared tenant test. Ownership is
-- unchanged in intent: a draft is visible only to its author, inside their org.
--
-- Tenant isolation is NOT widened: every policy still requires both the author
-- match and the org match, so no user gains sight of another user's drafts and
-- no org gains sight of another org's. This only makes the intended grant
-- reachable. anon holds no grant on this table and is unaffected.
--
-- Idempotent: DROP POLICY IF EXISTS then CREATE, so re-running is a no-op.
--
-- Rollback:
--   DROP POLICY IF EXISTS inbox_drafts_select ON public.inbox_drafts;
--   CREATE POLICY inbox_drafts_select ON public.inbox_drafts FOR SELECT TO authenticated
--     USING ((organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
--            AND author_id = auth.uid());
--   -- ...and likewise for insert / update / delete. Note the restored form is
--   -- the broken one; roll back only to prove causation, not as a fix.

set local lock_timeout = '5s';

drop policy if exists inbox_drafts_select on public.inbox_drafts;
drop policy if exists inbox_drafts_insert on public.inbox_drafts;
drop policy if exists inbox_drafts_update on public.inbox_drafts;
drop policy if exists inbox_drafts_delete on public.inbox_drafts;

create policy inbox_drafts_select
  on public.inbox_drafts
  for select
  to authenticated
  using (
    author_id = public.current_profile_id()
    and public.can_access_organization(org_id)
  );

create policy inbox_drafts_insert
  on public.inbox_drafts
  for insert
  to authenticated
  with check (
    author_id = public.current_profile_id()
    and public.can_access_organization(org_id)
  );

create policy inbox_drafts_update
  on public.inbox_drafts
  for update
  to authenticated
  using (
    author_id = public.current_profile_id()
    and public.can_access_organization(org_id)
  )
  with check (
    author_id = public.current_profile_id()
    and public.can_access_organization(org_id)
  );

create policy inbox_drafts_delete
  on public.inbox_drafts
  for delete
  to authenticated
  using (
    author_id = public.current_profile_id()
    and public.can_access_organization(org_id)
  );

-- `org_id` is the column the policies now test, and the API always sets it.
-- `organization_id` is the legacy twin kept in sync by trg_sync_org_tenant_key;
-- nothing below depends on it, so no backfill is required.

comment on table public.inbox_drafts is
  'Email drafts with auto-save and scheduled send support. RLS keys on '
  'current_profile_id() because author_id stores a profiles.id, not an auth uid.';
