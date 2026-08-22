-- ============================================================================
-- Status vocabulary, step 2 of 3: apply the 46 decided rows (PIFH, batch 1)
-- ----------------------------------------------------------------------------
-- Decision sheet bc7c6c05 — section A approved by the owner 21 Aug, sections
-- B/C/D/E answered by the client 22 Aug (her corrections translated as agreed
-- with the owner). Rows she has not seen yet (section B from "Decision Making
-- Stage" down, section E's last five) and the two she left blank
-- (Agency- SUPPORT, Non Client) are NOT touched — batch 2.
--
-- Module-aware, because the two modules use the status column differently:
--   contacts / members — status is the LIFECYCLE; a pipeline stage, where one
--                        applies, is recorded in data.lead_status.
--   leads               — status IS the pipeline stage (that module's own
--                        picklist), so a row that maps to a stage gets the
--                        stage; a row with no stage gets the lifecycle value.
-- Extra facts move to their own fields: enrollment_year, record_type = group,
-- relationship_type = Personal, billing_type = Complimentary, market_type =
-- healthshare ("Direct to MCS" = medical cost sharing).
--
-- Every touched record keeps its original status in data.legacy_status
-- (only set if absent — an earlier pass may already hold the true original),
-- and the JSONB mirrors (contact_status / lead_status / status) are written to
-- agree with the column, so the form, lists and exports all say one thing.
-- Re-run safe: a record whose status is no longer a legacy value is skipped.
-- Rollback: UPDATE crm_records SET status = data->>'legacy_status' for the
-- touched ids (audit_crm_records holds the full before-image of each row).
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '600s';

DO $$
DECLARE
  v_org      constant uuid := '00000000-0000-0000-0000-000000000001';
  v_contacts uuid; v_leads uuid; v_members uuid;
  r record;
  v_new_status text; v_extra jsonb; v_data jsonb; v_mirror jsonb;
  v_rows int := 0; v_by_value jsonb := '{}'::jsonb; v_leads_life int := 0;
BEGIN
  SELECT id INTO v_contacts FROM public.crm_modules WHERE org_id = v_org AND key = 'contacts';
  SELECT id INTO v_leads    FROM public.crm_modules WHERE org_id = v_org AND key = 'leads';
  SELECT id INTO v_members  FROM public.crm_modules WHERE org_id = v_org AND key = 'members';
  IF v_contacts IS NULL OR v_leads IS NULL THEN
    RAISE EXCEPTION 'PIFH contacts/leads module not found — refusing to run against a bare database';
  END IF;

  DROP TABLE IF EXISTS vocab_map;
  CREATE TEMP TABLE vocab_map (
    legacy     text PRIMARY KEY,
    lifecycle  text NOT NULL,           -- contacts / members status
    stage      text,                    -- pipeline stage (leads status; contacts data.lead_status)
    extra      jsonb NOT NULL DEFAULT '{}'::jsonb
  ) ON COMMIT DROP;

  INSERT INTO vocab_map (legacy, lifecycle, stage, extra) VALUES
    -- A · enrolment year (owner, 21 Aug)
    ('Enrolled-2016',   'Active', NULL, '{"enrollment_year": 2016}'),
    ('Enrolled - 2017', 'Active', NULL, '{"enrollment_year": 2017}'),
    ('Enrolled - 2018', 'Active', NULL, '{"enrollment_year": 2018}'),
    ('Enrolled - 2019', 'Active', NULL, '{"enrollment_year": 2019}'),
    ('Enrolled - 2020', 'Active', NULL, '{"enrollment_year": 2020}'),
    ('Enrolled - 2021', 'Active', NULL, '{"enrollment_year": 2021}'),
    ('Enrolled - 2022', 'Active', NULL, '{"enrollment_year": 2022}'),
    ('Enrolled - 2023', 'Active', NULL, '{"enrollment_year": 2023}'),
    ('Enrolled - 2024', 'Active', NULL, '{"enrollment_year": 2024}'),
    ('Enrolled - 2025', 'Active', NULL, '{"enrollment_year": 2025}'),
    ('Enrolled - 2026', 'Active', NULL, '{"enrollment_year": 2026}'),
    -- C · role already captured in relationship_type (client ticked)
    ('Agent - Prospect',         'Prospect', NULL, '{}'),
    ('Agent- SPONSOR',           'Active',   NULL, '{}'),
    ('DPC Prospect',             'Prospect', NULL, '{}'),
    ('Agent- SPONSOR- InActive', 'Inactive', NULL, '{}'),
    ('Accepting Provider',       'Active',   NULL, '{}'),
    ('Employee Prospect',        'Prospect', NULL, '{}'),
    -- B · pipeline stage (client ticked; Attempted = reached out, never connected)
    ('Hot Prospect - ready to move',           'Prospect', 'Qualified', '{}'),
    ('Contacted',                              'Prospect', 'Contacted', '{}'),
    ('Attempted Contact Three',                'Prospect', 'Attempted', '{}'),
    ('Warm Prospect - Maybe',                  'Prospect', 'Contacted', '{}'),
    ('Future Prospect',                        'Prospect', 'New',       '{}'),
    ('Released',                               'Lost',     'Lost',      '{}'),
    ('Lost Opportunity',                       'Lost',     'Lost',      '{}'),
    ('Not Contacted',                          'Prospect', 'New',       '{}'),
    ('Full Presentation Given - Decision Mode','Prospect', 'Qualified', '{}'),
    -- D · carrier and application (client; MCS = medical cost sharing = healthshare)
    ('Enrolled - Direct to MCS',     'Active',    NULL, '{"market_type": "healthshare"}'),
    ('Denied by Liberty',            'Declined',  NULL, '{}'),
    ('Liberty App. Declined',        'Declined',  NULL, '{}'),
    ('Application in Process',       'Pending',   NULL, '{}'),
    ('B Enrollment Application',     'Pending',   NULL, '{}'),
    ('Cancelled Application',        'Abandoned', NULL, '{}'),
    ('Not In Liberty',               'Lost',      NULL, '{}'),
    ('Sedera App in Process',        'Pending',   NULL, '{}'),
    ('Sedera Application in Process','Pending',   NULL, '{}'),
    ('LHS App Incomplete',           'Abandoned', NULL, '{}'),
    ('Lost in Liberty Corporate',    'Lost',      NULL, '{}'),
    ('App. In Process (Liberty)',    'Lost',      NULL, '{}'),
    -- E · the rest (client)
    ('PERSONAL',               'Active',   NULL, '{"relationship_type": "Personal"}'),
    ('Group Policy',           'Active',   NULL, '{"record_type": "group"}'),
    ('Approved Pending',       'Pending',  NULL, '{}'),
    ('Enrolled Member',        'Active',   NULL, '{}'),
    ('Complimentary',          'Active',   NULL, '{"billing_type": "Complimentary"}'),
    ('LIVE',                   'Active',   NULL, '{}'),
    ('No Phone Number',        'Prospect', NULL, '{}'),
    ('Florida Group Business', 'Active',   NULL, '{"record_type": "group"}');

  FOR r IN
    SELECT c.id, c.module_id, c.status, c.data, m.lifecycle, m.stage, m.extra
      FROM public.crm_records c
      JOIN vocab_map m ON m.legacy = c.status
     WHERE c.org_id = v_org AND c.deleted_at IS NULL
  LOOP
    -- Leads: a legacy value that is ALREADY a valid stage in the leads
    -- picklist ("Future Prospect", "Contacted") stays exactly as it is.
    IF r.module_id = v_leads AND r.status = ANY (ARRAY['New','Attempted','Contacted','Qualified','Future Prospect','In Process','Pending','Converted','Unqualified','Lost']) THEN
      CONTINUE;
    END IF;
    -- Leads: the stage is the status. A lead whose legacy label says it
    -- enrolled ("Enrolled - YYYY") has converted — that is the pipeline's own
    -- terminal word. Any other lifecycle-only label on a LEAD (e.g. the two
    -- "Florida Group Business" leads) has no honest pipeline word yet and is
    -- left for batch 2 with the client.
    IF r.module_id = v_leads THEN
      IF r.stage IS NULL AND r.status NOT LIKE 'Enrolled%' THEN
        CONTINUE;
      END IF;
      v_new_status := COALESCE(r.stage, 'Converted');
      IF r.stage IS NULL THEN v_leads_life := v_leads_life + 1; END IF;
    ELSE
      v_new_status := r.lifecycle;
    END IF;

    v_data := COALESCE(r.data, '{}'::jsonb);
    -- keep the true original: only set legacy_status if no earlier pass did
    IF NULLIF(btrim(v_data->>'legacy_status'), '') IS NULL THEN
      v_data := v_data || jsonb_build_object('legacy_status', r.status);
    END IF;
    -- extra facts to their own fields. Never overwrite a real value already
    -- there; the legacy label DOES beat a placeholder: market_type 'unknown',
    -- and record_type 'individual' / 'unknown' (the import default) when the
    -- label says Group.
    FOR v_mirror IN SELECT jsonb_build_object(k, v) FROM jsonb_each(r.extra) e(k, v) LOOP
      IF NULLIF(btrim(v_data->>(SELECT key FROM jsonb_object_keys(v_mirror) key LIMIT 1)), '') IS NULL
         OR ((v_mirror ? 'market_type') AND v_data->>'market_type' = 'unknown')
         OR ((v_mirror ? 'record_type') AND v_data->>'record_type' IN ('individual','unknown')) THEN
        v_data := v_data || v_mirror;
      END IF;
    END LOOP;
    -- mirrors agree with the column: contacts/members carry contact_status (+ stage
    -- in lead_status when one applies); leads carry lead_status; data.status if present
    IF r.module_id = v_leads THEN
      v_data := v_data || jsonb_build_object('lead_status', v_new_status);
      IF v_data ? 'contact_status' THEN v_data := v_data || jsonb_build_object('contact_status', v_new_status); END IF;
    ELSE
      v_data := v_data || jsonb_build_object('contact_status', v_new_status);
      IF r.stage IS NOT NULL THEN v_data := v_data || jsonb_build_object('lead_status', r.stage); END IF;
    END IF;
    IF v_data ? 'status' THEN v_data := v_data || jsonb_build_object('status', v_new_status); END IF;

    UPDATE public.crm_records
       SET status = v_new_status,
           market_type = CASE WHEN (r.extra ? 'market_type') AND COALESCE(market_type,'unknown') = 'unknown'
                              THEN r.extra->>'market_type' ELSE market_type END,
           data = v_data
     WHERE id = r.id;
    v_rows := v_rows + 1;
    v_by_value := v_by_value || jsonb_build_object(r.status, COALESCE((v_by_value->>r.status)::int, 0) + 1);
  END LOOP;

  RAISE NOTICE 'status vocabulary batch 1: % records re-labelled (% leads took the lifecycle value for lack of a stage). Per value: %', v_rows, v_leads_life, v_by_value::text;
END $$;
