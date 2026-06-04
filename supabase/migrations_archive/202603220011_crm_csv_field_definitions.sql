-- ============================================================================
-- CRM Field Definitions for CSV-mapped columns (ADDITIVE ONLY)
-- Registers new member & enrollment fields in the CRM UI
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_members_module_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_members_module_id
    FROM crm_modules WHERE org_id = v_org_id AND key = 'members';
  IF v_members_module_id IS NULL THEN RETURN; END IF;

  -- ==========================================================================
  -- MEMBER: Extended Contact fields (section: 'extended_contact')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'county', 'County', 'text', false, false, 400, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'phone_ext', 'Phone 1 Ext', 'text', false, false, 401, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'phone2', 'Phone 2', 'phone', false, false, 402, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'phone2_ext', 'Phone 2 Ext', 'text', false, false, 403, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'phone3', 'Phone 3', 'phone', false, false, 404, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'phone3_ext', 'Phone 3 Ext', 'text', false, false, 405, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'fax', 'Fax', 'phone', false, false, 406, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'fax_ext', 'Fax Ext', 'text', false, false, 407, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'email2', 'Email 2', 'email', false, false, 408, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'email3', 'Email 3', 'email', false, false, 409, 'extended_contact', 'half'),
    (v_org_id, v_members_module_id, 'do_not_call', 'Do Not Call', 'boolean', false, false, 410, 'extended_contact', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- MEMBER: Employment fields (section: 'employment')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'company_name', 'Company Name', 'text', false, false, 500, 'employment', 'half'),
    (v_org_id, v_members_module_id, 'position', 'Position', 'text', false, false, 501, 'employment', 'half'),
    (v_org_id, v_members_module_id, 'department', 'Department', 'text', false, false, 502, 'employment', 'half'),
    (v_org_id, v_members_module_id, 'division', 'Division', 'text', false, false, 503, 'employment', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- MEMBER: Demographics fields (section: 'demographics')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'ethnicity', 'Ethnicity', 'text', false, false, 600, 'demographics', 'half'),
    (v_org_id, v_members_module_id, 'height', 'Height', 'text', false, false, 601, 'demographics', 'half'),
    (v_org_id, v_members_module_id, 'weight', 'Weight', 'text', false, false, 602, 'demographics', 'half'),
    (v_org_id, v_members_module_id, 'disability', 'Disability', 'text', false, false, 603, 'demographics', 'half'),
    (v_org_id, v_members_module_id, 'drivers_license', 'Drivers License', 'text', false, false, 604, 'demographics', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- MEMBER: Source & Tracking fields (section: 'source_tracking')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'source', 'Source', 'text', false, false, 700, 'source_tracking', 'half'),
    (v_org_id, v_members_module_id, 'referral', 'Referral', 'text', false, false, 701, 'source_tracking', 'half'),
    (v_org_id, v_members_module_id, 'member_type', 'Member Type', 'text', false, false, 702, 'source_tracking', 'half'),
    (v_org_id, v_members_module_id, 'member_type2', 'Member Type 2', 'text', false, false, 703, 'source_tracking', 'half'),
    (v_org_id, v_members_module_id, 'stage', 'Stage', 'text', false, false, 704, 'source_tracking', 'half'),
    (v_org_id, v_members_module_id, 'internal_id', 'Internal ID', 'text', false, false, 705, 'source_tracking', 'half'),
    (v_org_id, v_members_module_id, 'external_username', 'Username', 'text', false, false, 706, 'source_tracking', 'half'),
    (v_org_id, v_members_module_id, 'source_only', 'Source Only', 'text', false, false, 707, 'source_tracking', 'half'),
    (v_org_id, v_members_module_id, 'probability', 'Probability', 'number', false, false, 708, 'source_tracking', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- MEMBER: Call tracking fields (section: 'call_tracking')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'number_of_calls', '# Calls', 'number', false, false, 800, 'call_tracking', 'half'),
    (v_org_id, v_members_module_id, 'call_status', 'Call Status', 'text', false, false, 801, 'call_tracking', 'half'),
    (v_org_id, v_members_module_id, 'best_call_time', 'Best Call Time', 'text', false, false, 802, 'call_tracking', 'half'),
    (v_org_id, v_members_module_id, 'next_step', 'Next Step', 'text', false, false, 803, 'call_tracking', 'half'),
    (v_org_id, v_members_module_id, 'next_step_date', 'Next Step Date', 'date', false, false, 804, 'call_tracking', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- ENROLLMENT: Billing fields (section: 'billing')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'first_billing_date', 'First Billing Date', 'date', false, false, 900, 'billing', 'half'),
    (v_org_id, v_members_module_id, 'next_billing_date', 'Next Billing Date', 'date', false, false, 901, 'billing', 'half'),
    (v_org_id, v_members_module_id, 'next_billing_amount', 'Next Billing Amount', 'currency', false, false, 902, 'billing', 'half'),
    (v_org_id, v_members_module_id, 'permanent_bill_day', 'Permanent Bill Day', 'number', false, false, 903, 'billing', 'half'),
    (v_org_id, v_members_module_id, 'pay_type', 'Pay Type', 'text', false, false, 904, 'billing', 'half'),
    (v_org_id, v_members_module_id, 'is_paid', 'Paid', 'boolean', false, false, 905, 'billing', 'half'),
    (v_org_id, v_members_module_id, 'last_payment_date', 'Last Payment', 'date', false, false, 906, 'billing', 'half'),
    (v_org_id, v_members_module_id, 'product_paid_through_date', 'Paid Through Date', 'date', false, false, 907, 'billing', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- ENROLLMENT: Fee Breakdown fields (section: 'fees')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'administration_fee', 'Administration Fee', 'currency', false, false, 1000, 'fees', 'half'),
    (v_org_id, v_members_module_id, 'association_fee', 'Association Fee', 'currency', false, false, 1001, 'fees', 'half'),
    (v_org_id, v_members_module_id, 'iua_fee', 'IUA Fee', 'currency', false, false, 1002, 'fees', 'half'),
    (v_org_id, v_members_module_id, 'product_fee', 'Product Fee', 'currency', false, false, 1003, 'fees', 'half'),
    (v_org_id, v_members_module_id, 'monthly_contribution_fee', 'Monthly Contribution', 'currency', false, false, 1004, 'fees', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- ENROLLMENT: Hold fields (section: 'holds')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'hold_date', 'Hold Date', 'date', false, false, 1100, 'holds', 'half'),
    (v_org_id, v_members_module_id, 'hold_reason', 'Hold Reason', 'text', false, false, 1101, 'holds', 'half'),
    (v_org_id, v_members_module_id, 'hold_return_date', 'Hold Return Date', 'date', false, false, 1102, 'holds', 'half'),
    (v_org_id, v_members_module_id, 'hold_amount', 'Hold Amount', 'currency', false, false, 1103, 'holds', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- ENROLLMENT: Contract fields (section: 'contract')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'contract_number', 'Contract Number', 'text', false, false, 1200, 'contract', 'half'),
    (v_org_id, v_members_module_id, 'contract_length', 'Contract Length (months)', 'number', false, false, 1201, 'contract', 'half'),
    (v_org_id, v_members_module_id, 'underwriter', 'Underwriter', 'text', false, false, 1202, 'contract', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- ENROLLMENT: Refund fields (section: 'refunds')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'refund_requested', 'Refund Requested', 'boolean', false, false, 1300, 'refunds', 'half'),
    (v_org_id, v_members_module_id, 'refund_requested_date', 'Refund Requested Date', 'date', false, false, 1301, 'refunds', 'half'),
    (v_org_id, v_members_module_id, 'refund_provided', 'Refund Provided', 'boolean', false, false, 1302, 'refunds', 'half'),
    (v_org_id, v_members_module_id, 'refund_provided_date', 'Refund Provided Date', 'date', false, false, 1303, 'refunds', 'half'),
    (v_org_id, v_members_module_id, 'refund_comment', 'Refund Comment', 'textarea', false, false, 1304, 'refunds', 'full')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- ENROLLMENT: TPV fields (section: 'tpv')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'tpv_code', 'TPV Code', 'text', false, false, 1400, 'tpv', 'half'),
    (v_org_id, v_members_module_id, 'tpv_date', 'TPV Date', 'date', false, false, 1401, 'tpv', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- ENROLLMENT: Product Pipeline fields (section: 'product_pipeline')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'product_label', 'Product Label', 'text', false, false, 1500, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'product_benefit', 'Product Benefit', 'text', false, false, 1501, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'period_label', 'Period Label', 'text', false, false, 1502, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'product_status', 'Product Status', 'text', false, false, 1503, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'product_stage', 'Product Stage', 'text', false, false, 1504, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'product_source', 'Product Source', 'text', false, false, 1505, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'product_source_detail', 'Product Source Detail', 'text', false, false, 1506, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'product_code', 'Product Code', 'text', false, false, 1507, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'product_estimated_close_date', 'Est. Close Date', 'date', false, false, 1508, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'sale_date', 'Sale Date', 'date', false, false, 1509, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'renewal_date', 'Renewal Date', 'date', false, false, 1510, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'category', 'Category', 'text', false, false, 1511, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'category3', 'Category 3', 'text', false, false, 1512, 'product_pipeline', 'half'),
    (v_org_id, v_members_module_id, 'category4', 'Category 4', 'text', false, false, 1513, 'product_pipeline', 'half')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ==========================================================================
  -- ENROLLMENT: Enroller & Agent fields (section: 'enroller')
  -- ==========================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width)
  VALUES
    (v_org_id, v_members_module_id, 'enroller_id', 'Enroller ID', 'text', false, false, 1600, 'enroller', 'half'),
    (v_org_id, v_members_module_id, 'enroller_name', 'Enroller Name', 'text', false, false, 1601, 'enroller', 'half'),
    (v_org_id, v_members_module_id, 'product_agent_id', 'Product Agent ID', 'text', false, false, 1602, 'enroller', 'half'),
    (v_org_id, v_members_module_id, 'product_agent_label', 'Product Agent', 'text', false, false, 1603, 'enroller', 'half'),
    (v_org_id, v_members_module_id, 'agent_code', 'Agent Code', 'text', false, false, 1604, 'enroller', 'half'),
    (v_org_id, v_members_module_id, 'assigned_agents', 'Assigned Agents', 'text', false, false, 1605, 'enroller', 'full')
  ON CONFLICT (module_id, key) DO NOTHING;

END $$;

-- ============================================================================
-- UPDATE MEMBER SYNC TRIGGER to include new member fields in CRM data JSONB
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_member_to_crm_records()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_owner_id uuid;
  v_advisor_code text;
  v_advisor_name text;
  v_org_id uuid;
  v_data jsonb;
  v_market_type text;
  v_canonical_advisor_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organization_id;
  ELSE
    v_org_id := NEW.organization_id;
  END IF;

  SELECT id INTO v_module_id
    FROM crm_modules
    WHERE org_id = v_org_id AND key = 'members';

  IF v_module_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM crm_records
      WHERE module_id = v_module_id
        AND system->>'source_table' = 'members'
        AND system->>'source_id' = OLD.id::text;
    RETURN OLD;
  END IF;

  v_canonical_advisor_id := NEW.advisor_id;
  IF NEW.advisor_id IS NOT NULL THEN
    SELECT
      a.advisor_code,
      a.first_name || ' ' || a.last_name,
      p.id
    INTO v_advisor_code, v_advisor_name, v_owner_id
    FROM advisors a
    LEFT JOIN profiles p ON p.id = a.profile_id
    WHERE a.id = NEW.advisor_id;
  END IF;

  v_market_type := CASE
    WHEN NEW.plan_type ILIKE '%health%share%' OR NEW.plan_type ILIKE '%sharing%' THEN 'healthshare'
    WHEN NEW.plan_type ILIKE '%insurance%' OR NEW.plan_type ILIKE '%traditional%' THEN 'traditional_insurance'
    WHEN NEW.plan_name ILIKE '%MPB%' OR NEW.plan_name ILIKE '%MPowering%'
      OR NEW.plan_name ILIKE '%Sedera%' OR NEW.plan_name ILIKE '%Zion%'
      OR NEW.plan_name ILIKE '%sharing%' THEN 'healthshare'
    ELSE 'unknown'
  END;

  -- Build data JSONB with all CSV-mapped fields
  v_data := jsonb_build_object(
    'member_number', NEW.member_number,
    'first_name', NEW.first_name,
    'last_name', NEW.last_name,
    'date_of_birth', NEW.date_of_birth,
    'gender', NEW.gender,
    'marital_status', NEW.marital_status,
    'address_line1', NEW.address_line1,
    'address_line2', NEW.address_line2,
    'city', NEW.city,
    'state', NEW.state,
    'zip_code', COALESCE(NEW.postal_code, NEW.zip_code),
    'advisor_id', NEW.advisor_id,
    'advisor_code', v_advisor_code,
    'advisor_name', v_advisor_name,
    'plan_name', NEW.plan_name,
    'plan_type', NEW.plan_type,
    'effective_date', NEW.effective_date,
    'monthly_share', NEW.monthly_share,
    'enrollment_source', COALESCE(NEW.custom_fields->>'enrollment_source', ''),
    'coverage_type', NEW.coverage_type,
    'program_type', NEW.program_type,
    -- New CSV-mapped member fields
    'county', NEW.county,
    'phone_ext', NEW.phone_ext,
    'phone2', NEW.phone2,
    'phone2_ext', NEW.phone2_ext,
    'phone3', NEW.phone3,
    'phone3_ext', NEW.phone3_ext,
    'fax', NEW.fax,
    'fax_ext', NEW.fax_ext,
    'email2', NEW.email2,
    'email3', NEW.email3,
    'do_not_call', NEW.do_not_call,
    'drivers_license', NEW.drivers_license,
    'company_name', NEW.company_name,
    'position', NEW."position",
    'department', NEW.department,
    'division', NEW.division,
    'ethnicity', NEW.ethnicity,
    'height', NEW.height,
    'weight', NEW.weight,
    'disability', NEW.disability,
    'source', NEW.source,
    'referral', NEW.referral,
    'member_type', NEW.member_type,
    'member_type2', NEW.member_type2,
    'stage', NEW.stage,
    'internal_id', NEW.internal_id,
    'external_username', NEW.external_username,
    'number_of_calls', NEW.number_of_calls,
    'call_status', NEW.call_status,
    'best_call_time', NEW.best_call_time,
    'next_step', NEW.next_step,
    'next_step_date', NEW.next_step_date,
    'source_only', NEW.source_only,
    'probability', NEW.probability
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_records (
      org_id, module_id, owner_id,
      title, status, email, phone,
      data, system,
      market_type, canonical_advisor_id, normalized_advisor_name,
      tobacco_user, record_type, import_source, normalization_status,
      created_at, updated_at
    ) VALUES (
      NEW.organization_id, v_module_id, v_owner_id,
      NEW.first_name || ' ' || NEW.last_name,
      NEW.status, NEW.email, NEW.phone,
      v_data,
      jsonb_build_object(
        'source_table', 'members',
        'source_id', NEW.id::text,
        'member_number', NEW.member_number,
        'synced', true
      ),
      v_market_type,
      v_canonical_advisor_id,
      v_advisor_name,
      COALESCE(NEW.is_smoker, false),
      'individual',
      'enrollment',
      CASE WHEN v_market_type != 'unknown' THEN 'normalized' ELSE 'needs_review' END,
      NEW.created_at, now()
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE crm_records SET
      title = NEW.first_name || ' ' || NEW.last_name,
      status = NEW.status,
      email = NEW.email,
      phone = NEW.phone,
      owner_id = COALESCE(v_owner_id, owner_id),
      data = v_data,
      system = jsonb_build_object(
        'source_table', 'members',
        'source_id', NEW.id::text,
        'member_number', NEW.member_number,
        'synced', true
      ),
      market_type = COALESCE(v_market_type, market_type),
      canonical_advisor_id = COALESCE(v_canonical_advisor_id, canonical_advisor_id),
      normalized_advisor_name = COALESCE(v_advisor_name, normalized_advisor_name),
      tobacco_user = COALESCE(NEW.is_smoker, tobacco_user),
      record_type = COALESCE(record_type, 'individual'),
      import_source = COALESCE(import_source, 'enrollment'),
      normalization_status = CASE
        WHEN COALESCE(v_market_type, market_type) != 'unknown'
          AND (v_canonical_advisor_id IS NOT NULL OR normalized_advisor_name IS NOT NULL)
        THEN 'normalized'
        ELSE COALESCE(normalization_status, 'needs_review')
      END,
      updated_at = now()
    WHERE module_id = v_module_id
      AND system->>'source_table' = 'members'
      AND system->>'source_id' = OLD.id::text;

    IF NOT FOUND THEN
      INSERT INTO crm_records (
        org_id, module_id, owner_id,
        title, status, email, phone,
        data, system,
        market_type, canonical_advisor_id, normalized_advisor_name,
        tobacco_user, record_type, import_source, normalization_status,
        created_at, updated_at
      ) VALUES (
        NEW.organization_id, v_module_id, v_owner_id,
        NEW.first_name || ' ' || NEW.last_name,
        NEW.status, NEW.email, NEW.phone,
        v_data,
        jsonb_build_object(
          'source_table', 'members',
          'source_id', NEW.id::text,
          'member_number', NEW.member_number,
          'synced', true
        ),
        v_market_type, v_canonical_advisor_id, v_advisor_name,
        COALESCE(NEW.is_smoker, false),
        'individual', 'enrollment',
        CASE WHEN v_market_type != 'unknown' THEN 'normalized' ELSE 'needs_review' END,
        COALESCE(NEW.created_at, now()), now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE ENROLLMENT SYNC TRIGGER to include new enrollment fields
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_enrollment_to_crm_records()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_market_type text;
  v_carrier_id uuid;
  v_plan_name text;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.status = NEW.status
    AND OLD.selected_plan_id IS NOT DISTINCT FROM NEW.selected_plan_id
  THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('submitted', 'approved', 'active') THEN
    RETURN NEW;
  END IF;

  IF NEW.primary_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_module_id
    FROM crm_modules
    WHERE org_id = NEW.organization_id AND key = 'members';

  IF v_module_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.selected_plan_id IS NOT NULL THEN
    SELECT name INTO v_plan_name FROM plans WHERE id = NEW.selected_plan_id;
  END IF;

  v_market_type := CASE
    WHEN NEW.plan_type ILIKE '%health%share%' OR NEW.plan_type ILIKE '%sharing%' THEN 'healthshare'
    WHEN NEW.plan_type ILIKE '%insurance%' OR NEW.plan_type ILIKE '%traditional%' THEN 'traditional_insurance'
    WHEN v_plan_name ILIKE '%MPB%' OR v_plan_name ILIKE '%MPowering%'
      OR v_plan_name ILIKE '%Sedera%' OR v_plan_name ILIKE '%Zion%'
      OR v_plan_name ILIKE '%sharing%' THEN 'healthshare'
    ELSE NULL
  END;

  IF NEW.snapshot IS NOT NULL AND NEW.snapshot->>'carrier' IS NOT NULL THEN
    SELECT id INTO v_carrier_id
      FROM insurance_carriers
      WHERE organization_id = NEW.organization_id
        AND LOWER(TRIM(carrier_name)) = LOWER(TRIM(NEW.snapshot->>'carrier'))
        AND is_active = true
      LIMIT 1;
  END IF;

  UPDATE crm_records SET
    market_type = COALESCE(v_market_type, market_type),
    tobacco_user = COALESCE(NEW.primary_is_smoker, tobacco_user),
    carrier_id = COALESCE(v_carrier_id, carrier_id),
    data = data || jsonb_build_object(
      'enrollment_id', NEW.id,
      'enrollment_number', NEW.enrollment_number,
      'enrollment_status', NEW.status,
      'selected_plan_id', NEW.selected_plan_id,
      'plan_name', v_plan_name,
      'plan_type', NEW.plan_type,
      'effective_date', NEW.effective_date,
      'requested_effective_date', NEW.requested_effective_date,
      'base_monthly_cost', NEW.base_monthly_cost,
      'tobacco_surcharge', NEW.tobacco_surcharge,
      'total_monthly_cost', NEW.total_monthly_cost,
      'enrollment_date', NEW.enrollment_date,
      'enrollment_source', COALESCE(NEW.source, NEW.enrollment_source),
      -- New CSV-mapped enrollment fields
      'first_billing_date', NEW.first_billing_date,
      'next_billing_date', NEW.next_billing_date,
      'next_billing_amount', NEW.next_billing_amount,
      'permanent_bill_day', NEW.permanent_bill_day,
      'pay_type', NEW.pay_type,
      'is_paid', NEW.is_paid,
      'last_payment_date', NEW.last_payment_date,
      'product_paid_through_date', NEW.product_paid_through_date,
      'administration_fee', NEW.administration_fee,
      'association_fee', NEW.association_fee,
      'iua_fee', NEW.iua_fee,
      'product_fee', NEW.product_fee,
      'monthly_contribution_fee', NEW.monthly_contribution_fee,
      'hold_date', NEW.hold_date,
      'hold_reason', NEW.hold_reason,
      'hold_return_date', NEW.hold_return_date,
      'hold_amount', NEW.hold_amount,
      'contract_number', NEW.contract_number,
      'contract_length', NEW.contract_length,
      'underwriter', NEW.underwriter,
      'refund_requested', NEW.refund_requested,
      'refund_requested_date', NEW.refund_requested_date,
      'refund_provided', NEW.refund_provided,
      'refund_provided_date', NEW.refund_provided_date,
      'refund_comment', NEW.refund_comment,
      'tpv_code', NEW.tpv_code,
      'tpv_date', NEW.tpv_date,
      'product_label', NEW.product_label,
      'product_benefit', NEW.product_benefit,
      'period_label', NEW.period_label,
      'product_status', NEW.product_status,
      'product_stage', NEW.product_stage,
      'product_source', NEW.product_source,
      'product_source_detail', NEW.product_source_detail,
      'product_code', NEW.product_code,
      'product_estimated_close_date', NEW.product_estimated_close_date,
      'sale_date', NEW.sale_date,
      'renewal_date', NEW.renewal_date,
      'category', NEW.category,
      'category3', NEW.category3,
      'category4', NEW.category4,
      'enroller_id', NEW.enroller_id,
      'enroller_name', NEW.enroller_name,
      'product_agent_id', NEW.product_agent_id,
      'product_agent_label', NEW.product_agent_label,
      'agent_code', NEW.agent_code,
      'assigned_agents', NEW.assigned_agents
    ),
    normalization_status = CASE
      WHEN COALESCE(v_market_type, market_type) IS NOT NULL
        AND COALESCE(v_market_type, market_type) != 'unknown'
      THEN 'normalized'
      ELSE normalization_status
    END,
    updated_at = now()
  WHERE module_id = v_module_id
    AND system->>'source_table' = 'members'
    AND system->>'source_id' = NEW.primary_member_id::text;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
