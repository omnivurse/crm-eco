-- Collapse every spelling of "active" into one value.
--
-- The lifecycle state was being written seven different ways — "Active HS
-- Member" (3,972), "active" (1,476), "Active ADVISOR" (71), "Active DPC" (19),
-- "Active Member" (11) and two one-off suffixed variants — so every filter,
-- badge, count and report that compared against "Active" silently missed most
-- active records.
--
-- Safe to merge now, and NOT before, because:
--   * the market half ("HS", "Insurance Client") is already carried by
--     market_type, and
--   * the role half ("ADVISOR", "DPC") was lifted into contact_role by
--     20260821150000, so no distinction is destroyed.
--
-- The write paths that kept re-creating these were fixed first (commit
-- 316c60ee): the nightly activation cron, the members sync endpoint, the
-- record-header picker and the status allowlist. Without that this would refill
-- within a day.
--
-- QUARANTINED: 28 records whose status column and data.contact_status genuinely
-- disagree (17 say Cancelled in JSONB while the column says active). Those are a
-- real data conflict, not a spelling problem, and are deliberately left alone
-- for a human to resolve rather than silently resolved in one direction.
--
-- Every touched record keeps its original string in legacy_status, so nothing
-- is lost and rollback is exact.
--
-- Rollback:
--   UPDATE public.crm_records
--      SET status = data->>'legacy_status',
--          data   = data - 'legacy_status'
--    WHERE org_id = '00000000-0000-0000-0000-000000000001'
--      AND data ? 'legacy_status'
--      AND status = 'Active';
--   -- (contact_status / sharing_status are restored from the same key by hand
--   --  if needed; they only ever moved to 'Active'.)

SET lock_timeout = '5s';
SET statement_timeout = '300s';

DO $$
DECLARE
  v_org  uuid := '00000000-0000-0000-0000-000000000001';
  v_n    int;
  v_fam  text[] := ARRAY[
    'Active HS Member', 'active', 'Active Member', 'Active ADVISOR', 'Active DPC',
    'Active Insurance Client', 'Active HS Member - Not in MyAHE backoffice',
    'Active HS Member - LHS Not Paid'
  ];
  v_skip uuid[];
BEGIN
  -- Rows whose column and JSONB contradict each other: leave for review.
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_skip
    FROM public.crm_records
   WHERE org_id = v_org AND deleted_at IS NULL
     AND status = ANY(v_fam)
     AND data ? 'contact_status'
     AND btrim(coalesce(data->>'contact_status','')) <> ''
     AND NOT (data->>'contact_status' = ANY(v_fam))
     AND data->>'contact_status' <> 'Active';
  RAISE NOTICE 'quarantined (column vs JSONB conflict): %', coalesce(array_length(v_skip,1),0);

  -- 1. preserve the original, then collapse the column
  UPDATE public.crm_records
     SET data   = data || jsonb_build_object('legacy_status', status),
         status = 'Active'
   WHERE org_id = v_org AND deleted_at IS NULL
     AND status = ANY(v_fam)
     AND NOT (id = ANY(v_skip))
     AND NOT (data ? 'legacy_status');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'status -> Active (legacy preserved): %', v_n;

  -- role records already carry legacy_status from 20260821150000
  UPDATE public.crm_records
     SET status = 'Active'
   WHERE org_id = v_org AND deleted_at IS NULL
     AND status = ANY(v_fam)
     AND NOT (id = ANY(v_skip));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'status -> Active (already had legacy_status): %', v_n;

  -- 2. the JSONB twin the record page reads
  UPDATE public.crm_records
     SET data = data || jsonb_build_object('contact_status', 'Active')
   WHERE org_id = v_org AND deleted_at IS NULL
     AND data->>'contact_status' = ANY(v_fam)
     AND NOT (id = ANY(v_skip));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'contact_status -> Active: %', v_n;

  -- 3. sharing_status: a select field whose own options are Active/Inactive/…
  --    Left alone, the header would read Active while the Health Sharing card
  --    still read "Active HS Member".
  UPDATE public.crm_records
     SET data = data || jsonb_build_object('sharing_status', 'Active')
   WHERE org_id = v_org AND deleted_at IS NULL
     AND data->>'sharing_status' = ANY(v_fam)
     AND NOT (id = ANY(v_skip));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'sharing_status -> Active: %', v_n;
END $$;

-- ---------------------------------------------------------------------------
-- Stop the advisor sync re-introducing the lowercase enum.
-- advisors.status is lowercase; it was copied verbatim into crm_records.status,
-- so the 18 advisor-module rows would revert on the next advisor edit. Reuse
-- the mapper the member sync already uses rather than adding a second one.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_src text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sync_advisor_to_crm_records' LIMIT 1;
  IF v_src IS NULL THEN
    RAISE NOTICE 'sync_advisor_to_crm_records not present — skipped';
    RETURN;
  END IF;

  -- Already patched by an earlier run: nothing to do. Checked before the
  -- replace so a re-run is a no-op rather than an error.
  IF position('map_member_status_to_crm' in v_src) > 0 THEN
    RAISE NOTICE 'sync_advisor_to_crm_records already maps status — no change';
    RETURN;
  END IF;
  v_new := replace(v_src, 'NEW.status,', 'public.map_member_status_to_crm(NEW.status),');
  v_new := replace(v_new, 'status = NEW.status,', 'status = public.map_member_status_to_crm(NEW.status),');
  IF v_new = v_src THEN
    RAISE EXCEPTION 'sync_advisor_to_crm_records did not match the expected shape — aborting rather than leaving the lowercase leak open';
  END IF;
  EXECUTE v_new;
  RAISE NOTICE 'sync_advisor_to_crm_records now maps status through map_member_status_to_crm';
END $$;
