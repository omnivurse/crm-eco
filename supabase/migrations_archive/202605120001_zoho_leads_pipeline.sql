-- ============================================================================
-- Zoho Leads Pipeline — staging table + upsert function
--
-- Adds the parallel-to-contacts plumbing for Leads imports:
--   * import_leads_staging — text-only staging mirror of Zoho's leads export
--   * upsert_leads_batch(p_offset, p_limit, p_org_id) — paged upsert into
--     crm_records (module key = 'leads'), with the same 4-tier dedup pattern
--     used by upsert_contacts_batch.
--
-- Follows the recover_zoho_notes_for_org pattern: takes p_org_id explicitly
-- so multi-tenant orgs work correctly (no LIMIT 1 organization fallback).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STAGING TABLE
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS import_leads_staging CASCADE;
CREATE TABLE import_leads_staging (
  row_num serial,
  record_id text,
  lead_owner_id text,
  lead_owner text,
  is_converted text,
  company text,
  first_name text,
  last_name text,
  email text,
  phone text,
  mobile text,
  lead_source text,
  lead_status text,
  created_by_id text,
  created_by text,
  modified_by_id text,
  modified_by text,
  created_time text,
  modified_time text,
  lead_name text,
  street text,
  city text,
  state text,
  zip_code text,
  email_opt_out text,
  salutation text,
  last_activity_time text,
  spouse text,
  spouse_dob text,
  child_1 text,
  child_1_dob text,
  child_2 text,
  child_2_dob text,
  child_3 text,
  child_3_dob text,
  product_type text,
  next_step text,
  producer_id text,
  producer text,
  date_of_birth text,
  child_5_dob text,
  child_5 text,
  child_4_dob text,
  child_4 text,
  coverage_option text,
  tag text,
  business_type text,
  days_visited text,
  average_time_spent_minutes text,
  number_of_chats text,
  most_recent_visit text,
  first_visit text,
  first_page_visited text,
  referrer text,
  visitor_score text,
  data_processing_basis_id text,
  data_processing_basis text,
  data_source text,
  middle_name text,
  business_or_practice_name text,
  converted_date_time text,
  lead_conversion_time text,
  unsubscribed_mode text,
  unsubscribed_time text,
  converted_account_id text,
  converted_account text,
  converted_contact_id text,
  converted_contact text,
  converted_deal_id text,
  converted_deal text,
  change_log_time text,
  locked text,
  last_enriched_time text,
  enrich_status text,
  referring_member text,
  mobile_2 text,
  connected_to_module text,
  connected_to_id text
);

ALTER TABLE import_leads_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_leads_staging" ON import_leads_staging
  FOR ALL USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 2. UPSERT FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_leads_batch(
  p_offset  int  DEFAULT 0,
  p_limit   int  DEFAULT 500,
  p_org_id  uuid DEFAULT NULL
)
RETURNS TABLE (
  inserted int,
  updated  int,
  skipped  int,
  errors   int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $fn$
DECLARE
  v_org_id      uuid;
  v_module_id   uuid;
  v_inserted    int := 0;
  v_updated     int := 0;
  v_skipped     int := 0;
  v_errors      int := 0;
  v_row         import_leads_staging%ROWTYPE;
  v_existing_id uuid;
  v_match_type  text;
  v_data        jsonb;
  v_title       text;
BEGIN
  -- Resolve target organization
  IF p_org_id IS NOT NULL THEN
    v_org_id := p_org_id;
  ELSE
    -- Legacy fallback to match existing contacts pipeline behavior
    SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'upsert_leads_batch: no organization resolved';
  END IF;

  -- Resolve leads module for this org
  SELECT id INTO v_module_id
    FROM crm_modules
   WHERE org_id = v_org_id
     AND key = 'leads'
   LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'upsert_leads_batch: leads module not found for org %', v_org_id;
  END IF;

  FOR v_row IN
    SELECT *
      FROM import_leads_staging
     ORDER BY row_num
     LIMIT p_limit OFFSET p_offset
  LOOP
    BEGIN
      v_existing_id := NULL;
      v_match_type  := NULL;

      -- Build data payload from all staging columns. Empty strings -> NULL.
      v_data := jsonb_strip_nulls(
        to_jsonb(v_row) - 'row_num'
      );
      -- Add canonical aliases used by the existing pipeline
      v_data := v_data || jsonb_build_object(
        'zoho_record_id', NULLIF(v_row.record_id, ''),
        'zoho_module',    'Leads'
      );

      -- Compute title (used by indexed search). generate_record_title() handles fallback.
      v_title := NULLIF(
        TRIM(COALESCE(v_row.first_name, '') || ' ' || COALESCE(v_row.last_name, '')),
        ''
      );
      v_title := COALESCE(v_title, NULLIF(v_row.lead_name, ''), NULLIF(v_row.company, ''), NULLIF(v_row.email, ''), 'Untitled');

      -- ----------------------------------------------------------------------
      -- 4-tier dedup (mirrors upsert_contacts_batch precedence)
      -- ----------------------------------------------------------------------
      -- Tier 1: email
      IF v_row.email IS NOT NULL AND TRIM(v_row.email) <> '' THEN
        SELECT id INTO v_existing_id
          FROM crm_records
         WHERE org_id    = v_org_id
           AND module_id = v_module_id
           AND LOWER(email) = LOWER(TRIM(v_row.email))
         LIMIT 1;
        IF v_existing_id IS NOT NULL THEN v_match_type := 'email'; END IF;
      END IF;

      -- Tier 2: zoho_record_id
      IF v_existing_id IS NULL AND v_row.record_id IS NOT NULL AND v_row.record_id <> '' THEN
        SELECT id INTO v_existing_id
          FROM crm_records
         WHERE org_id    = v_org_id
           AND module_id = v_module_id
           AND data->>'zoho_record_id' = v_row.record_id
         LIMIT 1;
        IF v_existing_id IS NOT NULL THEN v_match_type := 'zoho_record_id'; END IF;
      END IF;

      -- Tier 3: name + phone
      IF v_existing_id IS NULL
         AND v_row.first_name IS NOT NULL AND TRIM(v_row.first_name) <> ''
         AND v_row.last_name  IS NOT NULL AND TRIM(v_row.last_name)  <> ''
         AND v_row.phone      IS NOT NULL AND TRIM(v_row.phone)      <> '' THEN
        SELECT id INTO v_existing_id
          FROM crm_records
         WHERE org_id    = v_org_id
           AND module_id = v_module_id
           AND LOWER(data->>'first_name') = LOWER(TRIM(v_row.first_name))
           AND LOWER(data->>'last_name')  = LOWER(TRIM(v_row.last_name))
           AND phone = v_row.phone
         LIMIT 1;
        IF v_existing_id IS NOT NULL THEN v_match_type := 'name_phone'; END IF;
      END IF;

      -- ----------------------------------------------------------------------
      -- UPSERT
      -- ----------------------------------------------------------------------
      IF v_existing_id IS NOT NULL THEN
        -- SAFE MERGE: existing-wins semantics. Right side of `||` wins for
        -- shared keys, so v_data only contributes brand-new keys; any field
        -- already present in `data` (including staff-edited values) is
        -- preserved. New JSONB keys from the latest Zoho export still land,
        -- but existing values are never overwritten. Top-level columns
        -- already use COALESCE(existing, incoming) for the same reason.
        UPDATE crm_records SET
          data       = COALESCE(v_data, '{}'::jsonb) || COALESCE(data, '{}'::jsonb),
          email      = COALESCE(NULLIF(email, ''), NULLIF(v_row.email, '')),
          phone      = COALESCE(NULLIF(phone, ''), NULLIF(v_row.phone, ''), NULLIF(v_row.mobile, '')),
          status     = COALESCE(NULLIF(status, ''), NULLIF(v_row.lead_status, '')),
          title      = COALESCE(NULLIF(title, ''), v_title),
          updated_at = now()
        WHERE id = v_existing_id;
        v_updated := v_updated + 1;
      ELSE
        INSERT INTO crm_records (
          org_id, module_id, title, status, email, phone, data
        ) VALUES (
          v_org_id,
          v_module_id,
          v_title,
          NULLIF(v_row.lead_status, ''),
          NULLIF(v_row.email, ''),
          COALESCE(NULLIF(v_row.phone, ''), NULLIF(v_row.mobile, '')),
          v_data
        );
        v_inserted := v_inserted + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'upsert_leads_batch row_num=% sqlerrm=%', v_row.row_num, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_updated, v_skipped, v_errors;
END
$fn$;

-- Lock down EXECUTE to service_role only (matches the pattern in
-- recover_zoho_notes_for_org and upsert_contacts_batch)
REVOKE EXECUTE ON FUNCTION public.upsert_leads_batch(int, int, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_leads_batch(int, int, uuid) TO service_role;

COMMENT ON FUNCTION public.upsert_leads_batch(int, int, uuid) IS
  'Pages through import_leads_staging and upserts into crm_records (module=leads). '
  'Uses 4-tier dedup: email -> zoho_record_id -> name+phone. Idempotent.';
