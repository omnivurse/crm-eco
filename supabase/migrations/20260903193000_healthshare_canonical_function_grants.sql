-- ============================================================================
-- Fail closed on the Health Share canonical projection functions
-- ----------------------------------------------------------------------------
-- 20260903190000 revoked only FROM PUBLIC, which is not enough on Supabase:
-- default privileges on schema `public` grant EXECUTE to `anon` and
-- `authenticated` explicitly, so the security advisor correctly reported
--
--   Function public.backfill_healthshare_canonical_keys(...) can be executed by
--   the `anon` role as a SECURITY DEFINER function via
--   /rest/v1/rpc/backfill_healthshare_canonical_keys
--
-- i.e. an unauthenticated caller could drive a SECURITY DEFINER bulk write over
-- crm_records. Revoke from the API roles by name and grant back only to
-- service_role.
--
-- Firing a trigger does NOT check EXECUTE on the trigger function (that is only
-- checked at CREATE TRIGGER time), so revoking from the API roles leaves
-- crm_2_healthshare_canonical_trg fully functional.
--
-- Idempotent: REVOKE/GRANT are declarative. Rollback is the inverse GRANT, but
-- there is no legitimate reason for anon/authenticated to hold these.
-- ============================================================================

-- Bulk writer — service_role only.
REVOKE ALL ON FUNCTION public.backfill_healthshare_canonical_keys(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_healthshare_canonical_keys(integer, integer)
  TO service_role;

-- Trigger function — no role needs a direct EXECUTE grant.
REVOKE ALL ON FUNCTION public.crm_records_project_healthshare_canonical()
  FROM PUBLIC, anon, authenticated;

-- Drift reporter — read-only, but it aggregates across tenants, so keep it off
-- the public API surface and leave it to the audit/service role.
REVOKE ALL ON FUNCTION public.crm_healthshare_canonical_drift()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_healthshare_canonical_drift()
  TO service_role;
