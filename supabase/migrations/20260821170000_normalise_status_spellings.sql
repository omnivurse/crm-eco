-- Merge statuses that differ only by spelling.
--
-- These are the same value typed different ways, so merging them destroys no
-- information and needs no business judgement:
--
--   'In-Active' 473 + 'inactive' 63          -> 'Inactive'   (the picklist value)
--   'In process' 248 + 'In Process' 38       -> 'In Process' (the picklist value)
--   'Agent - Prospect' 214 + 'Agent- PROSPECT' 30 -> 'Agent - Prospect'
--   'Application in Process' 6 + 'Application In Process' 2 -> 'Application in Process'
--
-- 'Inactive' and 'In Process' are the spellings the crm_fields picklists
-- already offer, so the data ends up matching its own configuration.
--
-- The Agent rows keep their compound value for now: their ROLE is already
-- captured in contact_role (Advisor), but what lifecycle stage "Prospect"
-- should map to is a business decision, not a spelling one. Merging the two
-- spellings is safe; deciding the stage is deferred.
--
-- NOT touched: the 28 records still reading 'active', which are the quarantined
-- rows whose column and JSONB contradict each other.
--
-- Every touched record keeps its original string in legacy_status.
--
-- Rollback:
--   UPDATE public.crm_records
--      SET status = data->>'legacy_status', data = data - 'legacy_status'
--    WHERE org_id = '00000000-0000-0000-0000-000000000001'
--      AND data ? 'legacy_status'
--      AND status IN ('Inactive','In Process','Agent - Prospect','Application in Process');

SET lock_timeout = '5s';
SET statement_timeout = '300s';

DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001';
  v_n   int;
  v_map jsonb := jsonb_build_object(
    'In-Active',              'Inactive',
    'inactive',               'Inactive',
    'In process',             'In Process',
    'Agent- PROSPECT',        'Agent - Prospect',
    'Application In Process', 'Application in Process'
  );
BEGIN
  -- status column
  UPDATE public.crm_records r
     SET data = CASE WHEN r.data ? 'legacy_status' THEN r.data
                     ELSE r.data || jsonb_build_object('legacy_status', r.status) END,
         status = v_map ->> r.status
   WHERE r.org_id = v_org AND r.deleted_at IS NULL
     AND v_map ? r.status;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'status spellings merged: %', v_n;

  -- the JSONB twins, so the record page agrees with the column
  UPDATE public.crm_records r
     SET data = r.data || jsonb_build_object('contact_status', v_map ->> (r.data->>'contact_status'))
   WHERE r.org_id = v_org AND r.deleted_at IS NULL
     AND v_map ? (r.data->>'contact_status');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'contact_status spellings merged: %', v_n;

  UPDATE public.crm_records r
     SET data = r.data || jsonb_build_object('lead_status', v_map ->> (r.data->>'lead_status'))
   WHERE r.org_id = v_org AND r.deleted_at IS NULL
     AND v_map ? (r.data->>'lead_status');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'lead_status spellings merged: %', v_n;

  UPDATE public.crm_records r
     SET data = r.data || jsonb_build_object('sharing_status', v_map ->> (r.data->>'sharing_status'))
   WHERE r.org_id = v_org AND r.deleted_at IS NULL
     AND v_map ? (r.data->>'sharing_status');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'sharing_status spellings merged: %', v_n;
END $$;
