-- ============================================================================
-- Multi-Tenancy — keep profiles.organization_id and organization_members in sync
--
-- The 202604260001 migration backfilled organization_members from the existing
-- profiles snapshot. After deploy, **new profile inserts/updates** still need
-- a matching organization_members row, otherwise:
--   • `getActiveTenant()` (apps/admin) returns null → user bounced to /login
--   • RLS policies that resolve via `user_organization_ids()` deny everything
--
-- This migration adds a single AFTER INSERT OR UPDATE trigger on `profiles`
-- that upserts the corresponding membership row. It uses ON CONFLICT DO
-- NOTHING so the existing PIFH backfill is untouched (idempotent re-deploys
-- never overwrite role / is_active / is_default).
--
-- Pre-deploy state checked against PIFH (sffisarikcreyyjzdjvb):
--   profiles=2  organization_members=2  every PIFH profile already has a row.
-- This trigger is purely forward-looking — it does not rewrite any data.
--
-- Safety:
--   • SECURITY DEFINER so the trigger can write to organization_members even
--     when a non-admin caller inserts a profile (e.g. self-service onboarding).
--   • Locks search_path to `public` to neutralise CVE-2007-6600.
--   • Skips inserts where role is NULL (the table requires a role) — falls
--     back to the table's default of 'staff'.
--   • Maps any profile.role outside the membership CHECK list to 'staff'
--     so legacy roles like 'agent' / 'crm_admin' don't crash the insert.
--
-- Idempotent — safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._sync_profile_to_org_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role text;
BEGIN
  -- No-op if either side of the (user_id, organization_id) pair is missing.
  IF NEW.user_id IS NULL OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Coerce legacy / out-of-list roles to 'staff' so the CHECK passes.
  v_role := CASE
    WHEN NEW.role IN ('owner', 'super_admin', 'admin', 'staff', 'read_only')
      THEN NEW.role
    ELSE 'staff'
  END;

  INSERT INTO public.organization_members
    (organization_id, user_id, role, is_default, joined_at)
  VALUES
    (NEW.organization_id, NEW.user_id, v_role, true, COALESCE(NEW.created_at, now()))
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._sync_profile_to_org_member() FROM PUBLIC;

DROP TRIGGER IF EXISTS profiles_sync_to_org_members ON public.profiles;
CREATE TRIGGER profiles_sync_to_org_members
  AFTER INSERT OR UPDATE OF organization_id, user_id, role
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_profile_to_org_member();

-- Re-run the original backfill for defence in depth: anything created
-- between deploy and migration apply still ends up with a membership row.
INSERT INTO public.organization_members (organization_id, user_id, role, is_default, joined_at)
SELECT
  p.organization_id,
  p.user_id,
  CASE
    WHEN p.role IN ('owner', 'super_admin', 'admin', 'staff', 'read_only')
      THEN p.role
    ELSE 'staff'
  END,
  true,
  COALESCE(p.created_at, now())
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
  AND p.user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
