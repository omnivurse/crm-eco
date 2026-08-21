-- Backfill the role that was buried inside the status string.
--
-- 575 PIFH records encode WHAT THEY ARE inside the status column. This lifts
-- that into contact_role and records the original string in legacy_status, so
-- the later status normalisation can merge the lifecycle half without
-- destroying the distinction between an active advisor and an active member.
--
--   Active ADVISOR            71  -> Advisor
--   Agent - Prospect         214  -> Advisor
--   Agent- PROSPECT           30  -> Advisor
--   Agent- SPONSOR            96  -> Advisor
--   Agent- SPONSOR- InActive  15  -> Advisor
--   Agency- SUPPORT           35  -> Agency
--   Active DPC                19  -> DPC Provider
--   DPC Prospect              83  -> DPC Provider
--   Accepting Provider         9  -> Provider
--   Employee Prospect          3  -> Employee
--
-- This migration does NOT change `status`. It only ADDS two JSONB keys, so it
-- is reversible by deleting them, and every original value stays readable in
-- legacy_status. Verified beforehand on live data: none of the 575 already
-- carry either key, and all 575 have first/last name populated, so the
-- set_record_title trigger regenerates the identical heading.
--
-- Rollback:
--   UPDATE public.crm_records
--      SET data = (data - 'contact_role') - 'legacy_status'
--    WHERE org_id = '00000000-0000-0000-0000-000000000001'
--      AND data ? 'legacy_status';

SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001';
  v_n   int;
  v_map jsonb := jsonb_build_object(
    'Active ADVISOR',           'Advisor',
    'Agent - Prospect',         'Advisor',
    'Agent- PROSPECT',          'Advisor',
    'Agent- SPONSOR',           'Advisor',
    'Agent- SPONSOR- InActive', 'Advisor',
    'Agency- SUPPORT',          'Agency',
    'Active DPC',               'DPC Provider',
    'DPC Prospect',             'DPC Provider',
    'Accepting Provider',       'Provider',
    'Employee Prospect',        'Employee'
  );
BEGIN
  UPDATE public.crm_records r
     SET data = r.data
              || jsonb_build_object('contact_role',  v_map ->> r.status)
              || jsonb_build_object('legacy_status', r.status)
   WHERE r.org_id = v_org
     AND r.deleted_at IS NULL
     AND v_map ? r.status
     -- never overwrite a role or legacy value that already exists
     AND NOT (r.data ? 'contact_role')
     AND NOT (r.data ? 'legacy_status');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'contact_role backfilled on % record(s)', v_n;
END $$;
