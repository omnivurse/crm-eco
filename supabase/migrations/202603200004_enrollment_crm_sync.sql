-- ============================================================================
-- ENROLLMENT → CRM SYNC
-- 1. Enhance member sync trigger to populate canonical fields
-- 2. Add enrollment sync trigger to push plan/carrier/tobacco data to CRM
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENHANCED MEMBER SYNC
-- Now populates canonical fields when creating/updating CRM records
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
  -- Determine the org_id
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organization_id;
  ELSE
    v_org_id := NEW.organization_id;
  END IF;

  -- Find the "members" CRM module for this org
  SELECT id INTO v_module_id
    FROM crm_modules
    WHERE org_id = v_org_id AND key = 'members';

  IF v_module_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM crm_records
      WHERE module_id = v_module_id
        AND system->>'source_table' = 'members'
        AND system->>'source_id' = OLD.id::text;
    RETURN OLD;
  END IF;

  -- For INSERT/UPDATE: look up advisor info
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

  -- Classify market type from plan_type if available
  v_market_type := CASE
    WHEN NEW.plan_type ILIKE '%health%share%' OR NEW.plan_type ILIKE '%sharing%' THEN 'healthshare'
    WHEN NEW.plan_type ILIKE '%insurance%' OR NEW.plan_type ILIKE '%traditional%' THEN 'traditional_insurance'
    WHEN NEW.plan_name ILIKE '%MPB%' OR NEW.plan_name ILIKE '%MPowering%'
      OR NEW.plan_name ILIKE '%Sedera%' OR NEW.plan_name ILIKE '%Zion%'
      OR NEW.plan_name ILIKE '%sharing%' THEN 'healthshare'
    ELSE 'unknown'
  END;

  -- Build the data JSONB
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
    'program_type', NEW.program_type
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_records (
      org_id, module_id, owner_id,
      title, status, email, phone,
      data, system,
      -- Canonical fields
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
      -- Update canonical fields
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

    -- Upsert if no row was updated
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
-- SECTION 2: ENROLLMENT SYNC TRIGGER
-- When an enrollment is submitted/approved, push plan data to the linked
-- CRM record (via the member's CRM record)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_enrollment_to_crm_records()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_market_type text;
  v_carrier_id uuid;
  v_plan_name text;
BEGIN
  -- Only sync on status changes to submitted, approved, or active
  IF TG_OP = 'UPDATE'
    AND OLD.status = NEW.status
    AND OLD.selected_plan_id IS NOT DISTINCT FROM NEW.selected_plan_id
  THEN
    RETURN NEW;
  END IF;

  -- Only act on meaningful statuses
  IF NEW.status NOT IN ('submitted', 'approved', 'active') THEN
    RETURN NEW;
  END IF;

  -- Must have a linked member
  IF NEW.primary_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the members CRM module
  SELECT id INTO v_module_id
    FROM crm_modules
    WHERE org_id = NEW.organization_id AND key = 'members';

  IF v_module_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up plan name for market type classification
  IF NEW.selected_plan_id IS NOT NULL THEN
    SELECT name INTO v_plan_name FROM plans WHERE id = NEW.selected_plan_id;
  END IF;

  -- Classify market type
  v_market_type := CASE
    WHEN NEW.plan_type ILIKE '%health%share%' OR NEW.plan_type ILIKE '%sharing%' THEN 'healthshare'
    WHEN NEW.plan_type ILIKE '%insurance%' OR NEW.plan_type ILIKE '%traditional%' THEN 'traditional_insurance'
    WHEN v_plan_name ILIKE '%MPB%' OR v_plan_name ILIKE '%MPowering%'
      OR v_plan_name ILIKE '%Sedera%' OR v_plan_name ILIKE '%Zion%'
      OR v_plan_name ILIKE '%sharing%' THEN 'healthshare'
    ELSE NULL -- don't override existing classification
  END;

  -- Try to find a carrier match
  IF NEW.snapshot IS NOT NULL AND NEW.snapshot->>'carrier' IS NOT NULL THEN
    SELECT id INTO v_carrier_id
      FROM insurance_carriers
      WHERE organization_id = NEW.organization_id
        AND LOWER(TRIM(carrier_name)) = LOWER(TRIM(NEW.snapshot->>'carrier'))
        AND is_active = true
      LIMIT 1;
  END IF;

  -- Update the linked CRM record with enrollment data
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
      'enrollment_source', COALESCE(NEW.source, NEW.enrollment_source)
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

DROP TRIGGER IF EXISTS trg_sync_enrollment_to_crm ON enrollments;
CREATE TRIGGER trg_sync_enrollment_to_crm
  AFTER INSERT OR UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION sync_enrollment_to_crm_records();

COMMENT ON FUNCTION sync_enrollment_to_crm_records IS
  'Pushes enrollment plan/carrier/tobacco data to the linked CRM record '
  'when enrollment status changes to submitted, approved, or active.';

NOTIFY pgrst, 'reload schema';
