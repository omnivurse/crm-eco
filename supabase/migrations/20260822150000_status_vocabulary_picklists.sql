-- ============================================================================
-- Status vocabulary, step 1 of 3: the pickers offer exactly the agreed words (PIFH)
-- ----------------------------------------------------------------------------
-- Agreed with the owner + client 21–22 Aug 2026 (decision sheet bc7c6c05):
--   lifecycle (contacts, members): Active · Inactive · Pending · In Process ·
--       Cancelled · Terminated · Deceased · Prospect · Lost · Declined · Abandoned
--   pipeline (leads status, and lead_status on every module):
--       New · Attempted · Contacted · Qualified · Future Prospect · In Process ·
--       Pending · Converted · Unqualified · Lost
--   relationship_type gains Personal; record_type keeps group;
--   NEW billing_type (Paid / Complimentary); NEW enrollment_year.
--
-- OPTIONS + definitions only — no record values change here (step 2 does
-- that, step 3 adds the guard). Idempotent: only rows whose options differ
-- are rewritten; previous options kept under metadata->'previous'.
-- ============================================================================

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org      constant uuid := '00000000-0000-0000-0000-000000000001';
  v_source   constant text := 'status_vocabulary_20260822';
  v_contacts uuid; v_leads uuid; v_members uuid;
  v_life     constant jsonb := '["Active","Inactive","Pending","In Process","Cancelled","Terminated","Deceased","Prospect","Lost","Declined","Abandoned"]'::jsonb;
  v_pipe     constant jsonb := '["New","Attempted","Contacted","Qualified","Future Prospect","In Process","Pending","Converted","Unqualified","Lost"]'::jsonb;
  v_rel      constant jsonb := '["Member","Advisor","Agency","DPC Provider","Provider","Employee","Personal"]'::jsonb;
  v_n int; v_opts int := 0; v_added int := 0;
BEGIN
  SELECT id INTO v_contacts FROM public.crm_modules WHERE org_id = v_org AND key = 'contacts';
  SELECT id INTO v_leads    FROM public.crm_modules WHERE org_id = v_org AND key = 'leads';
  SELECT id INTO v_members  FROM public.crm_modules WHERE org_id = v_org AND key = 'members';
  IF v_contacts IS NULL OR v_leads IS NULL OR v_members IS NULL THEN
    RAISE EXCEPTION 'PIFH contacts/leads/members module not found — refusing to run against a bare database';
  END IF;

  -- 1. Picklist options. A helper-less UPDATE per (module set, key, options).
  WITH target AS (
    SELECT v_contacts AS module_id, 'contact_status'    AS key, v_life AS opts UNION ALL
    SELECT v_members,               'contact_status',           v_life          UNION ALL
    SELECT v_leads,                 'contact_status',           v_pipe          UNION ALL
    SELECT v_leads,                 'lead_status',              v_pipe          UNION ALL
    SELECT v_contacts,              'lead_status',              v_pipe          UNION ALL
    SELECT v_members,               'lead_status',              v_pipe          UNION ALL
    SELECT v_contacts,              'relationship_type',        v_rel           UNION ALL
    SELECT v_leads,                 'relationship_type',        v_rel           UNION ALL
    SELECT v_members,               'relationship_type',        v_rel
  ),
  upd AS (
    UPDATE public.crm_fields f
       SET options  = t.opts,
           metadata = COALESCE(f.metadata, '{}'::jsonb)
                      || jsonb_build_object('previous',
                           COALESCE(f.metadata->'previous', '{}'::jsonb)
                           || jsonb_build_object(v_source, jsonb_build_object('options', f.options)))
      FROM target t
     WHERE f.module_id = t.module_id AND f.key = t.key
       AND f.options IS DISTINCT FROM t.opts
     RETURNING 1
  )
  SELECT count(*) INTO v_opts FROM upd;

  -- 2. New fields. Guard: the keys must not already exist with another meaning.
  SELECT count(*) INTO v_n FROM public.crm_fields
   WHERE module_id IN (v_contacts, v_leads, v_members)
     AND key IN ('billing_type','enrollment_year')
     AND COALESCE(metadata->>'source','') <> v_source;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'billing_type / enrollment_year already defined with another meaning (% rows) — inspect before proceeding', v_n;
  END IF;

  INSERT INTO public.crm_fields
    (org_id, module_id, key, label, type, options, validation, section, display_order, width, required, tooltip, metadata)
  VALUES
    (v_org, v_contacts, 'billing_type', 'Billing Type', 'select', '["Paid","Complimentary"]'::jsonb, '{}'::jsonb,
       'payment', 90, 'half', false, 'Complimentary = a comped membership with no contribution due.', jsonb_build_object('source', v_source)),
    (v_org, v_members,  'billing_type', 'Billing Type', 'select', '["Paid","Complimentary"]'::jsonb, '{}'::jsonb,
       'payment', 90, 'half', false, 'Complimentary = a comped membership with no contribution due.', jsonb_build_object('source', v_source)),
    (v_org, v_contacts, 'enrollment_year', 'Enrollment Year', 'number', '[]'::jsonb, '{"min": 1990, "max": 2100}'::jsonb,
       'insurance', 70, 'half', false, 'The year an insurance client enrolled (moved out of the old "Enrolled - YYYY" status labels).', jsonb_build_object('source', v_source)),
    (v_org, v_leads,    'enrollment_year', 'Enrollment Year', 'number', '[]'::jsonb, '{"min": 1990, "max": 2100}'::jsonb,
       'insurance', 70, 'half', false, 'The year an insurance client enrolled (moved out of the old "Enrolled - YYYY" status labels).', jsonb_build_object('source', v_source))
  ON CONFLICT (module_id, key) DO NOTHING;
  GET DIAGNOSTICS v_added = ROW_COUNT;

  RAISE NOTICE 'status vocabulary picklists: % option lists rewritten, % new field definitions', v_opts, v_added;
END $$;
