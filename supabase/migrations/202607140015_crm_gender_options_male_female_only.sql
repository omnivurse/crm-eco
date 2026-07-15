-- Gender field: restrict the picklist to Male / Female only.
--
-- This is a health CRM: the Gender field records biological sex for medical,
-- actuarial (HealthShare / insurance), and eligibility purposes, so the choices
-- must be exactly Male and Female. Earlier migrations seeded a superset
-- (["Male","Female","Other","Prefer not to say"]) — 202607140002 for the
-- leads/contacts modules and 202606280003 for members — which is what surfaced
-- the extra options under Gender on Lead records. This narrows every gender
-- field back to the clinical two, matching supabase/seed/crm_seed.sql.
--
-- OPTIONS-ONLY change. Existing stored gender VALUES are deliberately left
-- untouched — we never guess a person's sex. Any record already holding
-- "Other" / "Prefer not to say" keeps that value until a human corrects it;
-- only the selectable choices change going forward. (A follow-up data-review of
-- records whose gender is not Male/Female can be done separately.)
--
-- Idempotent and reversible-safe: it only rewrites rows whose options differ,
-- and JSONB equality normalizes whitespace so a prior '["Male", "Female"]'
-- (seed) is treated as already-correct.

SET lock_timeout = '5s';

DO $$
DECLARE
  v_updated bigint;
BEGIN
  UPDATE crm_fields
     SET options = '["Male","Female"]'::jsonb
   WHERE key = 'gender'
     AND options IS DISTINCT FROM '["Male","Female"]'::jsonb;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Gender options narrowed to Male/Female on % crm_fields row(s)', v_updated;
END $$;
