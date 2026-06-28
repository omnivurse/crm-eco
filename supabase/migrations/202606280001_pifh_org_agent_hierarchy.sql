-- PIFH org agent hierarchy (Tier 1+ data backfill).
-- Designates the legacy "House Account" advisor as the canonical PIFH org root
-- and wires every other PIFH advisor underneath via parent_advisor_id.
--
-- Root: dc91befa-0364-49cf-9cfa-b452f0f49a28 (formerly House Account / IMP-0245)
-- Idempotent: safe to re-run; only updates rows that drift from the target state.
--
-- Rollback (manual):
--   UPDATE advisors SET parent_advisor_id = NULL
--     WHERE organization_id = '00000000-0000-0000-0000-000000000001'
--       AND parent_advisor_id = 'dc91befa-0364-49cf-9cfa-b452f0f49a28';
--   UPDATE organizations SET settings = settings - 'default_org_agent_id'
--     WHERE id = '00000000-0000-0000-0000-000000000001';

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_root_id uuid := 'dc91befa-0364-49cf-9cfa-b452f0f49a28';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.advisors
    WHERE id = v_root_id
      AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'PIFH org agent root % not found in org %', v_root_id, v_org_id;
  END IF;

  UPDATE public.advisors
  SET
    first_name        = 'Pay It Forward Health',
    last_name         = 'House',
    email             = 'membership@payitforwardhealth.com',
    company_name      = 'Pay It Forward Health',
    agency_name       = 'Pay It Forward Health',
    agent_role        = 'Agency',
    status            = 'active',
    parent_advisor_id = NULL,
    advisor_code      = 'PIFH-0000',
    updated_at        = now()
  WHERE id = v_root_id
    AND organization_id = v_org_id
    AND (
      first_name IS DISTINCT FROM 'Pay It Forward Health'
      OR last_name IS DISTINCT FROM 'House'
      OR email IS DISTINCT FROM 'membership@payitforwardhealth.com'
      OR company_name IS DISTINCT FROM 'Pay It Forward Health'
      OR agency_name IS DISTINCT FROM 'Pay It Forward Health'
      OR agent_role IS DISTINCT FROM 'Agency'
      OR status IS DISTINCT FROM 'active'
      OR parent_advisor_id IS NOT NULL
      OR advisor_code IS DISTINCT FROM 'PIFH-0000'
    );

  UPDATE public.advisors
  SET
    parent_advisor_id = v_root_id,
    updated_at        = now()
  WHERE organization_id = v_org_id
    AND id <> v_root_id
    AND parent_advisor_id IS DISTINCT FROM v_root_id;

  UPDATE public.organizations
  SET
    settings   = coalesce(settings, '{}'::jsonb)
                 || jsonb_build_object('default_org_agent_id', v_root_id::text),
    updated_at = now()
  WHERE id = v_org_id
    AND coalesce(settings->>'default_org_agent_id', '') IS DISTINCT FROM v_root_id::text;
END $$;

NOTIFY pgrst, 'reload schema';
