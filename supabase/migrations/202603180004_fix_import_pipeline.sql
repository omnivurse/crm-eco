-- ============================================================================
-- PHASE 2, MIGRATION 4 — FIX IMPORT PIPELINE
-- Repairs upsert_contacts_batch() to populate canonical fields during import.
-- Future Zoho re-imports will correctly set:
--   market_type, canonical_advisor_id, normalized_advisor_name,
--   normalized_agent_name, normalization_status, import_source,
--   source_record_id
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_contacts_batch(p_offset int DEFAULT 0, p_limit int DEFAULT 500)
RETURNS TABLE(inserted int, updated int, skipped int, errors int) AS $$
DECLARE
  v_org_id uuid;
  v_module_id uuid;
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_errors int := 0;
  v_row RECORD;
  v_existing_id uuid;
  v_data jsonb;
  v_match_method text;
  -- Canonical field variables
  v_market text;
  v_advisor_name text;
  v_agent_name text;
  v_canonical_advisor_id uuid;
  v_norm_status text;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found.';
  END IF;

  SELECT id INTO v_module_id FROM crm_modules
  WHERE org_id = v_org_id AND key = 'contacts';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Contacts module not found.';
  END IF;

  FOR v_row IN
    SELECT * FROM import_contacts_staging
    WHERE record_id IS NOT NULL
      AND record_id != 'Record Id'
      AND record_id != ''
      AND (first_name IS NOT NULL OR last_name IS NOT NULL)
    ORDER BY row_num
    OFFSET p_offset
    LIMIT p_limit
  LOOP
    BEGIN
      v_existing_id := NULL;
      v_match_method := NULL;

      -- MATCH 1: email
      IF NULLIF(TRIM(v_row.email), '') IS NOT NULL THEN
        SELECT id INTO v_existing_id FROM crm_records
        WHERE org_id = v_org_id AND module_id = v_module_id
          AND LOWER(email) = LOWER(TRIM(v_row.email))
        ORDER BY updated_at DESC LIMIT 1;
        IF v_existing_id IS NOT NULL THEN v_match_method := 'email'; END IF;
      END IF;

      -- MATCH 2: zoho_record_id (in data JSONB)
      IF v_existing_id IS NULL AND NULLIF(v_row.record_id, '') IS NOT NULL THEN
        SELECT id INTO v_existing_id FROM crm_records
        WHERE org_id = v_org_id AND module_id = v_module_id
          AND data->>'zoho_record_id' = v_row.record_id
        LIMIT 1;
        IF v_existing_id IS NOT NULL THEN v_match_method := 'zoho_record_id'; END IF;
      END IF;

      -- MATCH 3: source_record_id (canonical field)
      IF v_existing_id IS NULL AND NULLIF(v_row.record_id, '') IS NOT NULL THEN
        SELECT id INTO v_existing_id FROM crm_records
        WHERE org_id = v_org_id AND module_id = v_module_id
          AND source_record_id = v_row.record_id
        LIMIT 1;
        IF v_existing_id IS NOT NULL THEN v_match_method := 'source_record_id'; END IF;
      END IF;

      -- MATCH 4: name+phone
      IF v_existing_id IS NULL
         AND NULLIF(v_row.first_name, '') IS NOT NULL
         AND NULLIF(v_row.last_name, '') IS NOT NULL
         AND NULLIF(v_row.phone, '') IS NOT NULL
      THEN
        SELECT id INTO v_existing_id FROM crm_records
        WHERE org_id = v_org_id AND module_id = v_module_id
          AND LOWER(data->>'first_name') = LOWER(v_row.first_name)
          AND LOWER(data->>'last_name') = LOWER(v_row.last_name)
          AND phone = v_row.phone
        ORDER BY updated_at DESC LIMIT 1;
        IF v_existing_id IS NOT NULL THEN v_match_method := 'name_phone'; END IF;
      END IF;

      -- Build JSONB in 4 chunks (same as original — preserves raw import data)
      v_data := jsonb_build_object(
        'zoho_record_id', NULLIF(v_row.record_id, ''),
        'zoho_contact_owner_id', NULLIF(v_row.contact_owner_id, ''),
        'zoho_producer_id', NULLIF(v_row.producer_name_id, ''),
        'first_name', NULLIF(v_row.first_name, ''),
        'last_name', NULLIF(v_row.last_name, ''),
        'contact_name', NULLIF(v_row.contact_name, ''),
        'salutation', NULLIF(v_row.salutation, ''),
        'middle_initial', NULLIF(v_row.middle_initial, ''),
        'title', NULLIF(v_row.title, ''),
        'date_of_birth', _parse_import_date(v_row.date_of_birth),
        'birth_month', NULLIF(v_row.birth_month, ''),
        'primary_member_gender', NULLIF(v_row.primary_member_gender, ''),
        'marital_status', NULLIF(v_row.marital_status, ''),
        'secondary_email', NULLIF(v_row.secondary_email, ''),
        'mobile', NULLIF(v_row.mobile, ''),
        'work_phone', NULLIF(v_row.work_phone, ''),
        'fax', NULLIF(v_row.fax, ''),
        'email', NULLIF(TRIM(v_row.email), ''),
        'phone', NULLIF(v_row.phone, ''),
        'mailing_street', NULLIF(v_row.mailing_street, ''),
        'mailing_city', NULLIF(v_row.mailing_city, ''),
        'mailing_zip', NULLIF(v_row.mailing_zip, ''),
        'mailing_state', NULLIF(v_row.mailing_state, ''),
        'contact_status', NULLIF(v_row.contact_status, ''),
        'contact_owner', NULLIF(v_row.contact_owner, ''),
        'lead_source', NULLIF(v_row.lead_source, ''),
        'affiliate', NULLIF(v_row.affiliate, ''),
        'producer_name', NULLIF(v_row.producer_name, ''),
        'referral_source', NULLIF(v_row.referral_source, ''),
        'referring_member', NULLIF(v_row.referring_member, ''),
        'tag', NULLIF(v_row.tag, ''),
        'territories', NULLIF(v_row.territories, ''),
        'company_association', NULLIF(v_row.company_association, ''),
        'data_source', NULLIF(v_row.data_source, '')
      );

      v_data := v_data || jsonb_build_object(
        'spouse', NULLIF(v_row.spouse, ''),
        'spouse_dob', _parse_import_date(v_row.spouse_dob),
        'spouse_ss_number', NULLIF(v_row.spouse_ss_number, ''),
        'spouse_address', NULLIF(v_row.spouse_address, ''),
        'spouse_phone_number', NULLIF(v_row.spouse_phone_number, ''),
        'spouse_email', NULLIF(v_row.spouse_email, ''),
        'child_1', NULLIF(v_row.child_1, ''),
        'child_1_dob', _parse_import_date(v_row.child_1_dob),
        'child_1_ss_number', NULLIF(v_row.child_1_ss_number, ''),
        'child_1_address', NULLIF(v_row.child_1_address, ''),
        'child_1_phone_number', NULLIF(v_row.child_1_phone_number, ''),
        'child_1_email', NULLIF(v_row.child_1_email, ''),
        'child_2', NULLIF(v_row.child_2, ''),
        'child_2_dob', _parse_import_date(v_row.child_2_dob),
        'child_2_ss_number', NULLIF(v_row.child_2_ss_number, ''),
        'child_2_address', NULLIF(v_row.child_2_address, ''),
        'child_2_phone_number', NULLIF(v_row.child_2_phone_number, ''),
        'child_2_email', NULLIF(v_row.child_2_email, ''),
        'child_3', NULLIF(v_row.child_3, ''),
        'child_3_dob', _parse_import_date(v_row.child_3_dob),
        'child_3_ss_number', NULLIF(v_row.child_3_ss_number, ''),
        'child_3_address', NULLIF(v_row.child_3_address, ''),
        'child_3_phone_number', NULLIF(v_row.child_3_phone_number, ''),
        'child_3_email', NULLIF(v_row.child_3_email, ''),
        'child_4', NULLIF(v_row.child_4, ''),
        'child_4_dob', _parse_import_date(v_row.child_4_dob),
        'child_4_ss_number', NULLIF(v_row.child_4_ss_number, ''),
        'child_4_address', NULLIF(v_row.child_4_address, ''),
        'child_4_phone_number', NULLIF(v_row.child_4_phone_number, ''),
        'child_4_email', NULLIF(v_row.child_4_email, ''),
        'child_5', NULLIF(v_row.child_5, ''),
        'child_5_dob', _parse_import_date(v_row.child_5_dob),
        'child_5_ss_number', NULLIF(v_row.child_5_ss_number, ''),
        'child_5_address', NULLIF(v_row.child_5_address, ''),
        'child_5_phone_number', NULLIF(v_row.child_5_phone_number, ''),
        'child_5_email', NULLIF(v_row.child_5_email, '')
      );

      v_data := v_data || jsonb_build_object(
        'product', NULLIF(v_row.product, ''),
        'coverage_option', NULLIF(v_row.coverage_option, ''),
        'carrier', NULLIF(v_row.carrier, ''),
        'previous_product', NULLIF(v_row.previous_product, ''),
        'monthly_premium', _parse_import_number(v_row.monthly_premium),
        'start_date', _parse_import_date(v_row.start_date),
        'cancellation_date', _parse_import_datetime(v_row.cancellation_date),
        'iua_amount', NULLIF(v_row.iua_amount, ''),
        'add_on_product', NULLIF(v_row.add_on_product, ''),
        'vision', NULLIF(v_row.vision, ''),
        'dental', NULLIF(v_row.dental, ''),
        'commission_percentage', _parse_import_number(v_row.commission_percentage),
        'producer_commission', _parse_import_number(v_row.producer_commission),
        'amount_received', _parse_import_number(v_row.amount_received),
        'team_leader', NULLIF(v_row.team_leader, ''),
        'team_leader_monthly', _parse_import_number(v_row.team_leader_monthly),
        'team_leader_referral', _parse_import_number(v_row.team_leader_referral),
        'director', NULLIF(v_row.director, ''),
        'director_monthly', _parse_import_number(v_row.director_monthly),
        'director_referral', _parse_import_number(v_row.director_referral),
        'affiliate_referral', NULLIF(v_row.affiliate_referral, ''),
        'affiliate_rep_monthly', _parse_import_number(v_row.affiliate_rep_monthly),
        'referral_fee', _parse_import_number(v_row.referral_fee),
        'date_referral_paid', _parse_import_date(v_row.date_referral_paid),
        'referral_requirement_satisfied', NULLIF(v_row.referral_requirement_satisfied, ''),
        'declined', _parse_import_boolean(v_row.declined),
        'charge_waived', _parse_import_boolean(v_row.charge_waived),
        'household_annual_adj_gross', _parse_import_number(v_row.household_annual_adj_gross),
        'primary_ss_number', NULLIF(v_row.primary_ss_number, ''),
        'tax_id', NULLIF(v_row.tax_id, ''),
        'mpower_life_code', NULLIF(v_row.mpower_life_code, ''),
        'life_code_2nd', NULLIF(v_row.life_code_2nd, ''),
        'life_code_3rd', NULLIF(v_row.life_code_3rd, ''),
        'life_code_4th', NULLIF(v_row.life_code_4th, ''),
        'life_code_5th', NULLIF(v_row.life_code_5th, ''),
        'e123_member_id', NULLIF(v_row.e123_member_id, '')
      );

      v_data := v_data || jsonb_build_object(
        'portal_username', NULLIF(v_row.portal_username, ''),
        'portal_password', NULLIF(v_row.portal_password, ''),
        'cirrus_registration_date', _parse_import_date(v_row.cirrus_registration_date),
        'app_downloaded', _parse_import_boolean(v_row.app_downloaded),
        'select_conversion_completed', _parse_import_boolean(v_row.select_conversion_completed),
        'mec_submitted', _parse_import_boolean(v_row.mec_submitted),
        'mec_decision_confirmed', _parse_import_boolean(v_row.mec_decision_confirmed),
        'medical_release_form_on_file', _parse_import_boolean(v_row.medical_release_form_on_file),
        'permission_to_discuss_plan', _parse_import_boolean(v_row.permission_to_discuss_plan),
        'atap', NULLIF(v_row.atap, ''),
        'third_party_payor', NULLIF(v_row.third_party_payor, ''),
        'risk_assessment_paid', NULLIF(v_row.risk_assessment_paid, ''),
        'welcome_call_status', NULLIF(v_row.welcome_call_status, ''),
        'welcome_call_performed_by', NULLIF(v_row.welcome_call_performed_by, ''),
        'wc_outreach_date', _parse_import_date(v_row.wc_outreach_date),
        'fulfillment_letter_mailed', _parse_import_date(v_row.fulfillment_letter_mailed),
        'fulfillment_email_sent', _parse_import_date(v_row.fulfillment_email_sent),
        'complete_date', _parse_import_date(v_row.complete_date),
        'business_or_practice_name', NULLIF(v_row.business_or_practice_name, ''),
        'dpc_name', NULLIF(v_row.dpc_name, ''),
        'email_opt_out', _parse_import_boolean(v_row.email_opt_out),
        'preferred_method_of_communication', NULLIF(v_row.preferred_method_of_communication, ''),
        'unsubscribed_mode', NULLIF(v_row.unsubscribed_mode, ''),
        'unsubscribed_time', _parse_import_datetime(v_row.unsubscribed_time),
        'days_visited', _parse_import_number(v_row.days_visited),
        'average_time_spent_minutes', _parse_import_number(v_row.average_time_spent_minutes),
        'number_of_chats', _parse_import_number(v_row.number_of_chats),
        'most_recent_visit', _parse_import_datetime(v_row.most_recent_visit),
        'first_visit', _parse_import_datetime(v_row.first_visit),
        'first_page_visited', NULLIF(v_row.first_page_visited, ''),
        'referrer', NULLIF(v_row.referrer, ''),
        'visitor_score', _parse_import_number(v_row.visitor_score),
        'last_activity_time', _parse_import_datetime(v_row.last_activity_time),
        'notes_history', NULLIF(v_row.notes_history, ''),
        'created_by_name', NULLIF(v_row.created_by, ''),
        'modified_by_name', NULLIF(v_row.modified_by, ''),
        'zoho_created_time', _parse_import_datetime(v_row.created_time),
        'zoho_modified_time', _parse_import_datetime(v_row.modified_time),
        'locked', _parse_import_boolean(v_row.locked),
        'admin123', NULLIF(v_row.admin123, ''),
        'change_log_time', _parse_import_datetime(v_row.change_log_time),
        'data_processing_basis', NULLIF(v_row.data_processing_basis, ''),
        'connected_to_module', NULLIF(v_row.connected_to_module, ''),
        'connected_to_id', NULLIF(v_row.connected_to_id, '')
      );

      -- Strip nulls
      v_data := (
        SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
        FROM jsonb_each(v_data)
        WHERE value IS NOT NULL AND value != 'null'::jsonb AND value != '""'::jsonb
      );

      -- ================================================================
      -- CANONICAL FIELD COMPUTATION (NEW in Phase 2)
      -- ================================================================

      -- Classify market type
      v_market := classify_market_type(
        v_row.product, v_row.carrier, v_row.coverage_option, v_row.iua_amount
      );

      -- Determine canonical advisor/agent name based on lane
      v_advisor_name := NULL;
      v_agent_name := NULL;

      IF v_market = 'healthshare' THEN
        v_advisor_name := COALESCE(
          NULLIF(TRIM(v_row.producer_name), ''),
          NULLIF(TRIM(v_row.contact_owner), '')
        );
      ELSIF v_market = 'traditional_insurance' THEN
        v_agent_name := COALESCE(
          NULLIF(TRIM(v_row.producer_name), ''),
          NULLIF(TRIM(v_row.contact_owner), '')
        );
      ELSE
        -- Unknown: populate both with best available
        v_advisor_name := COALESCE(
          NULLIF(TRIM(v_row.producer_name), ''),
          NULLIF(TRIM(v_row.contact_owner), '')
        );
        v_agent_name := v_advisor_name;
      END IF;

      -- Try to match canonical advisor FK
      v_canonical_advisor_id := NULL;
      IF v_advisor_name IS NOT NULL THEN
        SELECT id INTO v_canonical_advisor_id FROM advisors
        WHERE organization_id = v_org_id
          AND LOWER(TRIM(first_name || ' ' || last_name)) = LOWER(TRIM(v_advisor_name))
        LIMIT 1;

        -- Fallback: try producer_code match
        IF v_canonical_advisor_id IS NULL THEN
          SELECT id INTO v_canonical_advisor_id FROM advisors
          WHERE organization_id = v_org_id
            AND producer_code IS NOT NULL
            AND LOWER(TRIM(producer_code)) = LOWER(TRIM(v_advisor_name))
          LIMIT 1;
        END IF;
      END IF;

      -- Determine normalization status
      v_norm_status := CASE
        WHEN v_market != 'unknown' AND (v_canonical_advisor_id IS NOT NULL OR v_agent_name IS NOT NULL)
          THEN 'normalized'
        WHEN v_market = 'unknown' THEN 'needs_review'
        WHEN v_advisor_name IS NOT NULL AND v_canonical_advisor_id IS NULL THEN 'needs_review'
        ELSE 'unresolved'
      END;

      -- ================================================================
      -- UPSERT with canonical fields
      -- ================================================================

      IF v_existing_id IS NOT NULL THEN
        -- UPDATE existing record (preserve existing canonical values with COALESCE)
        UPDATE crm_records SET
          title = COALESCE(NULLIF(v_row.contact_name, ''), NULLIF(TRIM(COALESCE(v_row.first_name, '') || ' ' || COALESCE(v_row.last_name, '')), ''), title),
          status = COALESCE(NULLIF(v_row.contact_status, ''), status),
          email = COALESCE(NULLIF(TRIM(v_row.email), ''), email),
          phone = COALESCE(NULLIF(v_row.phone, ''), phone),
          data = (SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) FROM jsonb_each(data || v_data) WHERE value IS NOT NULL AND value != 'null'::jsonb AND value != '""'::jsonb),
          -- Canonical fields (only fill if not already set to a better value)
          market_type = COALESCE(market_type, v_market),
          canonical_advisor_id = COALESCE(canonical_advisor_id, v_canonical_advisor_id),
          normalized_advisor_name = COALESCE(normalized_advisor_name, v_advisor_name),
          normalized_agent_name = COALESCE(normalized_agent_name, v_agent_name),
          normalization_status = COALESCE(normalization_status, v_norm_status),
          source_record_id = COALESCE(source_record_id, NULLIF(v_row.record_id, '')),
          import_source = COALESCE(import_source, 'zoho_csv'),
          updated_at = now()
        WHERE id = v_existing_id;
        v_updated := v_updated + 1;
      ELSE
        -- INSERT new record with all canonical fields
        INSERT INTO crm_records (
          org_id, module_id, title, status, email, phone, data,
          market_type, canonical_advisor_id,
          normalized_advisor_name, normalized_agent_name,
          normalization_status, normalization_notes,
          import_source, source_record_id,
          created_at, updated_at
        )
        VALUES (
          v_org_id, v_module_id,
          COALESCE(NULLIF(v_row.contact_name, ''), TRIM(COALESCE(v_row.first_name, '') || ' ' || COALESCE(v_row.last_name, ''))),
          COALESCE(NULLIF(v_row.contact_status, ''), 'Active'),
          NULLIF(TRIM(v_row.email), ''), NULLIF(v_row.phone, ''),
          v_data,
          v_market,
          v_canonical_advisor_id,
          v_advisor_name,
          v_agent_name,
          v_norm_status,
          'Zoho CSV import (Phase 2 pipeline)',
          'zoho_csv',
          NULLIF(v_row.record_id, ''),
          COALESCE(_parse_import_datetime(v_row.created_time), now()),
          COALESCE(_parse_import_datetime(v_row.modified_time), now())
        );
        v_inserted := v_inserted + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_updated, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION upsert_contacts_batch(int, int) SET statement_timeout = '120s';

NOTIFY pgrst, 'reload schema';
