-- Read-only reconciliation view for contact reporting lineage.
-- Surfaces stranded dates/status splits between converted leads and contacts.
-- ADDITIVE ONLY — no data mutation.

CREATE OR REPLACE VIEW public.crm_contact_coverage_reporting_v AS
SELECT
  c.id AS contact_id,
  c.organization_id,
  c.title AS contact_title,
  c.status AS contact_status,
  c.original_start_date AS contact_original_start_date,
  c.current_year_start_date AS contact_current_year_start_date,
  c.data->>'start_date' AS contact_start_date_json,
  c.data->>'health_insurance_start_date' AS contact_health_insurance_start_date_json,
  c.data->>'contact_status' AS contact_status_json,
  l.id AS lead_id,
  l.status AS lead_status,
  l.data->>'lead_status' AS lead_status_json,
  l.data->>'is_converted' AS lead_is_converted,
  l.data->>'health_insurance_start_date' AS lead_health_insurance_start_date_json,
  l.data->>'start_date' AS lead_start_date_json,
  public._parse_import_date(COALESCE(
    c.original_start_date::text,
    c.current_year_start_date::text,
    c.data->>'start_date',
    c.data->>'health_insurance_start_date',
    c.data->>'sharing_effective_date',
    l.data->>'health_insurance_start_date',
    l.data->>'start_date',
    l.data->>'sharing_effective_date'
  )) AS reporting_effective_start_date,
  CASE
    WHEN l.id IS NOT NULL
     AND (l.data->>'is_converted') = 'true'
     AND l.status IS DISTINCT FROM 'Converted'
      THEN 'converted_lead_status_drift'
    WHEN l.id IS NOT NULL
     AND public._parse_import_date(COALESCE(l.data->>'health_insurance_start_date', l.data->>'start_date')) IS NOT NULL
     AND c.original_start_date IS NULL
     AND c.data->>'health_insurance_start_date' IS NULL
     AND c.data->>'start_date' IS NULL
      THEN 'start_date_stranded_on_lead'
    WHEN c.status IN ('In Process', 'In process', 'Pending')
     AND public._parse_import_date(COALESCE(
       c.original_start_date::text,
       c.data->>'start_date',
       c.data->>'health_insurance_start_date'
     )) IS NULL
     AND l.id IS NOT NULL
     AND public._parse_import_date(COALESCE(l.data->>'health_insurance_start_date', l.data->>'start_date')) IS NOT NULL
      THEN 'contact_missing_date_on_linked_lead'
    ELSE NULL
  END AS reconciliation_issue
FROM public.crm_records c
JOIN public.crm_modules cm ON cm.id = c.module_id AND cm.key = 'contacts'
LEFT JOIN public.crm_record_links rl
  ON rl.link_type = 'lead_to_contact'
 AND rl.target_record_id = c.id
LEFT JOIN public.crm_records l ON l.id = rl.source_record_id
WHERE c.organization_id IS NOT NULL;

COMMENT ON VIEW public.crm_contact_coverage_reporting_v IS
  'Reporting lineage: coalesced effective start date + flags for lead/contact status/date splits.';

-- ── DRY-RUN BACKFILL (DO NOT EXECUTE WITHOUT APPROVAL) ─────────────────────
-- Preview rows that would be repaired (Avery Tudor class):
--
-- SELECT contact_id, contact_title, lead_id, lead_health_insurance_start_date_json,
--        contact_status, reporting_effective_start_date, reconciliation_issue
--   FROM public.crm_contact_coverage_reporting_v
--  WHERE reconciliation_issue IS NOT NULL;
--
-- Expected Avery row:
--   contact_id = d24456aa-a4b7-4eb1-a08d-3209c3d81af0
--   lead_id    = d702cc2c-0d16-4ed0-8533-7b1c626e75cf
--   issue      = start_date_stranded_on_lead + converted_lead_status_drift
