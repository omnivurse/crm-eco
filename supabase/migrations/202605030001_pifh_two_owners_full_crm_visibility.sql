-- =============================================================================
-- PIFH — wire both production owners to canonical org + full CRM visibility
--
-- Users (`auth.users.id` / `profiles.user_id`):
--   • 411d27b9-9b9e-4d4e-8535-b0c431c57ddc
--   • 46be4d37-858a-4e46-abba-f4b75c096aa6
--
-- CRM SELECT on `crm_records` uses `is_crm_member(org_id)`:
--   profiles.user_id = auth.uid()
--   profiles.organization_id = crm_records.org_id
--   profiles.crm_role IS NOT NULL
--
-- Deploy gate (`scripts/pifh-deploy-gate.mjs`) expects both users in
-- `organization_members` for PIFH with role owner, active, default.
--
-- This migration also re-homes all `crm_records` to canonical PIFH and fixes
-- common module/org drift so nested `crm_modules` resolves under RLS.
--
-- Idempotent. Intended for the single Pay It Forward tenant deployment.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_org    CONSTANT uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  rec      uuid[] := ARRAY[
    '411d27b9-9b9e-4d4e-8535-b0c431c57ddc'::uuid,
    '46be4d37-858a-4e46-abba-f4b75c096aa6'::uuid
  ];
  n_profiles   int := 0;
  n_orgins     int := 0;
  n_records    int := 0;
  n_bad_mod    int := 0;
  n_notes      int := 0;
  n_tasks      int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RAISE EXCEPTION '[pifh-owners] canonical org % missing', v_org;
  END IF;

  -- Only warn if profiles row missing — cannot invent profile without onboarding.
  IF EXISTS (
    SELECT 1 FROM unnest(rec) AS u(uid)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = u.uid
    )
  ) THEN
    RAISE WARNING '[pifh-owners] one or both user ids have no profiles row — create profiles first.';
  END IF;

  -- One default membership per user: clear before we set PIFH as default.
  UPDATE public.organization_members om
     SET is_default = false,
         updated_at = now()
   WHERE om.user_id = ANY (rec);

  -- Canonical membership: owner, active, default (matches pifh-deploy-gate).
  INSERT INTO public.organization_members AS om (
    organization_id, user_id, role, is_active, is_default, joined_at
  )
  SELECT
    v_org,
    u.uid,
    'owner',
    true,
    true,
    now()
  FROM unnest(rec) AS u(uid)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET
    role       = 'owner',
    is_active  = true,
    is_default = true,
    updated_at = now();

  GET DIAGNOSTICS n_orgins = ROW_COUNT;

  -- Profiles: same org as records + CRM visibility (any non-null crm_role satisfies is_crm_member).
  UPDATE public.profiles p
     SET organization_id = v_org,
         crm_role        = COALESCE(NULLIF(btrim(p.crm_role::text), ''), 'crm_admin'),
         updated_at      = now()
   WHERE p.user_id = ANY (rec);

  GET DIAGNOSTICS n_profiles = ROW_COUNT;

  RAISE NOTICE '[pifh-owners] profiles updated: %, organization_members upserted: %',
    n_profiles, n_orgins;

  -- All CRM records on canonical org (single-tenant PIFH).
  UPDATE public.crm_records r
     SET org_id = v_org
   WHERE r.org_id IS DISTINCT FROM v_org;

  GET DIAGNOSTICS n_records = ROW_COUNT;
  IF n_records > 0 THEN
    RAISE NOTICE '[pifh-owners] crm_records re-homed to canonical: %', n_records;
  END IF;

  -- Point module_id at a module in THIS org when FK still references another org row.
  UPDATE public.crm_records r
     SET module_id = canon.id
    FROM public.crm_modules off
    JOIN public.crm_modules canon
      ON canon.org_id = v_org
     AND canon.key = off.key
   WHERE r.module_id = off.id
     AND r.org_id = v_org
     AND off.org_id IS DISTINCT FROM v_org;

  GET DIAGNOSTICS n_records = ROW_COUNT;
  IF n_records > 0 THEN
    RAISE NOTICE '[pifh-owners] module_id realigned via same-key canonical module: %', n_records;
  END IF;

  SELECT COUNT(*)::int INTO n_bad_mod
    FROM public.crm_records rr
    JOIN public.crm_modules mm ON mm.id = rr.module_id
   WHERE rr.org_id = v_org
     AND mm.org_id IS DISTINCT FROM v_org;

  IF n_bad_mod > 0 THEN
    RAISE WARNING '[pifh-owners] % crm_records still reference modules outside org % — add modules or remap manually.',
      n_bad_mod, v_org;
  END IF;

  UPDATE public.crm_notes n
     SET org_id = r.org_id
    FROM public.crm_records r
   WHERE n.record_id = r.id
     AND n.org_id IS DISTINCT FROM r.org_id;

  GET DIAGNOSTICS n_notes = ROW_COUNT;

  UPDATE public.crm_tasks t
     SET org_id = r.org_id
    FROM public.crm_records r
   WHERE t.record_id IS NOT NULL
     AND t.record_id = r.id
     AND t.org_id IS DISTINCT FROM r.org_id;

  GET DIAGNOSTICS n_tasks = ROW_COUNT;

  IF n_notes > 0 OR n_tasks > 0 THEN
    RAISE NOTICE '[pifh-owners] child org heal: notes=%, tasks=%', n_notes, n_tasks;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
