-- Make dead-lettered comms readable by the people who have to act on them.
--
-- Problem: every policy on this table was gated on
--   is_staff_or_admin() AND (is_super_admin() OR <org match>)
-- but is_staff_or_admin() matches role IN ('staff','agent','admin','super_admin')
-- and this deployment's privileged users hold role 'owner'. The leading AND
-- therefore failed for every account, including accounts with is_super_admin set.
-- Verified against live data before writing: all three real users saw 0 of 1 rows,
-- so the table was write-only in practice — mail could be parked here and no
-- human could ever see it.
--
-- Two independent audiences, and the old predicate served neither:
--   * Unroutable inbound has organization_id IS NULL by definition — we could not
--     resolve a tenant. `NULL = <org>` is never true, so those rows can only ever
--     be reached by a platform-level reader. That is is_super_admin(), which the
--     old AND made unreachable.
--   * Org-attributable failures belong to that tenant's own admins and owners.
--
-- Fix: lift the super-admin branch out from behind the AND, and let an org's
-- owner/admin see their own org's rows via the existing is_admin_or_owner()
-- helper. Tenant isolation is unchanged: the non-super-admin branch still
-- requires an org match, so no tenant gains visibility of another's mail.
--
-- Deliberately NOT changing is_staff_or_admin() itself. 52 policies across 18
-- tables depend on that function; widening it to include 'owner' would silently
-- grant access far beyond this table.
--
-- Additive only: this grants access that was always intended and revokes nothing.
-- anon holds no table grant at all and is unaffected.
--
-- Rollback: restore the previous predicate, i.e. replace
--   public.is_super_admin() OR ((is_staff_or_admin() OR is_admin_or_owner()) AND <org match>)
-- with
--   public.is_staff_or_admin() AND (public.is_super_admin() OR <org match>)
-- on all four policies below.

DO $$
DECLARE
  -- Platform readers see everything (including rows with no tenant); tenant
  -- readers are confined to their own org.
  v_predicate constant text :=
    '('
      'public.is_super_admin() OR ('
        '(public.is_staff_or_admin() OR public.is_admin_or_owner()) AND ('
          'organization_id = public.get_user_organization_id() OR '
          'org_id = public.get_user_organization_id()'
        ')'
      ')'
    ')';
BEGIN
  EXECUTE format(
    'ALTER POLICY comms_dead_letters_staff_select ON public.comms_dead_letters USING %s',
    v_predicate
  );

  EXECUTE format(
    'ALTER POLICY comms_dead_letters_staff_insert ON public.comms_dead_letters WITH CHECK %s',
    v_predicate
  );

  -- UPDATE is what makes triage possible: resolved_at / resolved_by already exist
  -- on this table and there is a partial index on the unresolved rows, so the
  -- workflow was designed for and then left unreachable.
  EXECUTE format(
    'ALTER POLICY comms_dead_letters_staff_update ON public.comms_dead_letters USING %s WITH CHECK %s',
    v_predicate, v_predicate
  );

  EXECUTE format(
    'ALTER POLICY comms_dead_letters_staff_delete ON public.comms_dead_letters USING %s',
    v_predicate
  );
END
$$;
