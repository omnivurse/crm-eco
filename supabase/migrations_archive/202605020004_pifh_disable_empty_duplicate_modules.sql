-- =============================================================================
-- Hide empty duplicate modules from the PIFH sidebar.
--
-- After 202605020001 merged the "System Administration" org's records into
-- the canonical "Pay It Forward Health" org, the canonical org ended up with
-- both:
--
--   • `deals`     (display name "Members", 0 records)  — vestigial template module
--   • `members`   (display name "Members", 978 records) — the real data module
--   • `prospects` (display name "Prospects", 0 records) — vestigial template module
--   • `leads`     (display name "Leads", 1,093 records) — the real data module
--
-- The shell sidebar pulls modules with `is_enabled = true` and shows them by
-- `name_plural`, so today Wendy sees TWO "Members" entries (one of which is
-- empty) and a redundant "Prospects" tab. This migration flips the empty
-- duplicates' `is_enabled = false` so the sidebar surfaces only the modules
-- that actually have data.
--
-- Records are not touched. The hidden modules can be re-enabled from
-- Settings → Modules if they're ever needed.
--
-- Idempotent: if a hidden module ever ends up with records, the same query
-- becomes a no-op (the `records = 0` predicate matches nothing).
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_pifh_org CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  v_count int;
BEGIN
  -- Hide empty modules whose `name_plural` collides with a non-empty
  -- sibling module. Plus the always-vestigial `prospects` if empty.
  UPDATE public.crm_modules m
     SET is_enabled = false,
         updated_at = now()
   WHERE m.org_id = v_pifh_org
     AND m.is_enabled = true
     AND (SELECT count(*) FROM public.crm_records r WHERE r.module_id = m.id) = 0
     AND (
       -- Same name_plural as a different module that *does* have records
       EXISTS (
         SELECT 1
           FROM public.crm_modules other
           JOIN public.crm_records r2 ON r2.module_id = other.id
          WHERE other.org_id     = v_pifh_org
            AND other.id         <> m.id
            AND other.name_plural = m.name_plural
       )
       -- Or the legacy `prospects` template that's never been used
       OR m.key = 'prospects'
     );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[pifh-cleanup] disabled % empty duplicate module(s)', v_count;
END $$;

COMMIT;
