-- ============================================================================
-- record_origin — which migration wave a CRM record came from.
-- ----------------------------------------------------------------------------
-- Member data arrived in distinct waves (an original Zoho export, then an
-- enrollment-system batch), and when the same person appears in more than one
-- wave there was no way to tell the copies apart, sort them, or filter to one
-- wave. This adds that as a first-class, sortable/filterable column.
--
-- Values are DERIVED from evidence already on the row, never guessed:
--   legacy_zoho_leads  import_source='zoho_csv' AND data->>'zoho_module'='Leads'
--   legacy_zoho        import_source='zoho_csv'                       (15,074)
--   enrollment         import_source='enrollment'                      (1,059)
--   csv_import         import_source='csv_import'
--   native             import_source IS NULL or 'manual'                 (140)
--
-- Note: `data->>'source'` is NOT provenance — on this database it holds a
-- referral person's name ("Wendy Scipione"). It is deliberately not used here.
--
-- The value is ordered by the numeric prefix so list sorting groups waves
-- oldest-first rather than alphabetically.
--
-- A BEFORE INSERT trigger keeps new rows labelled, so this cannot silently
-- regrow a population of unclassified records.
--
-- Additive and reversible: DROP TRIGGER + DROP FUNCTION + DROP COLUMN.
-- ============================================================================

ALTER TABLE public.crm_records
  ADD COLUMN IF NOT EXISTS record_origin text;

COMMENT ON COLUMN public.crm_records.record_origin IS
  'Migration wave this record arrived in (derived from import_source + Zoho markers). Sortable/filterable; see 20260811220000.';

-- Numeric prefix so `ORDER BY record_origin` reads oldest wave first.
CREATE OR REPLACE FUNCTION public.crm_record_origin_for(
  p_import_source text,
  p_data jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT CASE
    WHEN p_import_source = 'zoho_csv' AND p_data->>'zoho_module' = 'Leads'
      THEN '1_legacy_zoho_leads'
    WHEN p_import_source = 'zoho_csv'   THEN '2_legacy_zoho'
    WHEN p_import_source = 'csv_import' THEN '3_csv_import'
    WHEN p_import_source = 'enrollment' THEN '4_enrollment'
    ELSE '5_native'
  END;
$$;

CREATE OR REPLACE FUNCTION public.crm_records_set_record_origin() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF NEW.record_origin IS NULL OR btrim(NEW.record_origin) = '' THEN
    NEW.record_origin := public.crm_record_origin_for(NEW.import_source, NEW.data);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_records_record_origin_trg ON public.crm_records;
CREATE TRIGGER crm_records_record_origin_trg
  BEFORE INSERT ON public.crm_records
  FOR EACH ROW EXECUTE FUNCTION public.crm_records_set_record_origin();

-- Backfill. Writes ONLY the new column; the audit, updated_at, title and
-- stage-history triggers are suspended so this does not write ~16k audit rows,
-- stamp every record as modified today (destroying the "recently updated"
-- signal reps rely on), or let the title generator rewrite older titles.
-- Migrations run in a transaction, so a failure restores every trigger.
DO $backfill$
DECLARE
  v_noisy text[] := ARRAY[
    'audit_crm_records',
    'set_updated_at_crm_records',
    'update_crm_records_updated_at',
    'set_crm_record_title',
    'log_deal_stage_change_trigger'
  ];
  v_present text[] := '{}';
  v_name text;
  v_rows bigint;
BEGIN
  FOREACH v_name IN ARRAY v_noisy LOOP
    IF EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'crm_records' AND t.tgname = v_name AND NOT t.tgisinternal
    ) THEN
      v_present := array_append(v_present, v_name);
      EXECUTE format('ALTER TABLE public.crm_records DISABLE TRIGGER %I', v_name);
    END IF;
  END LOOP;

  UPDATE public.crm_records
     SET record_origin = public.crm_record_origin_for(import_source, data)
   WHERE record_origin IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  FOREACH v_name IN ARRAY v_present LOOP
    EXECUTE format('ALTER TABLE public.crm_records ENABLE TRIGGER %I', v_name);
  END LOOP;

  RAISE NOTICE 'record_origin backfilled on % rows', v_rows;
END $backfill$;

CREATE INDEX IF NOT EXISTS idx_crm_records_record_origin
  ON public.crm_records (org_id, record_origin)
  WHERE deleted_at IS NULL;

-- Make it a real, labelled field so it appears in the UI, filters and sorts.
DO $fields$
DECLARE
  r record;
  v_opts jsonb := jsonb_build_array(
    jsonb_build_object('label', 'Legacy — Zoho Leads', 'value', '1_legacy_zoho_leads'),
    jsonb_build_object('label', 'Legacy — Zoho',       'value', '2_legacy_zoho'),
    jsonb_build_object('label', 'CSV Import',          'value', '3_csv_import'),
    jsonb_build_object('label', 'Enrollment',          'value', '4_enrollment'),
    jsonb_build_object('label', 'Created in CRM',      'value', '5_native')
  );
BEGIN
  FOR r IN SELECT id, org_id, key FROM crm_modules WHERE key IN ('contacts','members','leads','advisors') LOOP
    INSERT INTO crm_fields (
      org_id, organization_id, module_id, key, label, type,
      required, is_system, display_order, section, options, width, metadata, tooltip
    ) VALUES (
      r.org_id, r.org_id, r.id, 'record_origin', 'Record Origin', 'select',
      false, true, 950, 'system', v_opts, 'half',
      jsonb_build_object('source', 'record_origin_tier'),
      'Which migration wave this record came from. Use it to tell duplicate copies of the same person apart.'
    )
    ON CONFLICT (module_id, key) DO NOTHING;
  END LOOP;
END $fields$;
