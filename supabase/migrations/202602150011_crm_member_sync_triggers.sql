-- ============================================================================
-- CRM MEMBER & ADVISOR SYNC TRIGGERS
-- Phase 0: Auto-generate numerical IDs (member_number, advisor_code)
-- Phase 1: Sync members/advisors to crm_records via triggers
-- Phase 6: CRM field definitions for Members and Advisors modules
-- ============================================================================

-- ============================================================================
-- PHASE 0A: Member Number Auto-Generation (9-digit numerical ID)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS member_number_seq
  START 100000001
  INCREMENT 1
  MAXVALUE 999999999
  NO CYCLE;

CREATE OR REPLACE FUNCTION generate_member_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_number IS NULL OR NEW.member_number = '' THEN
    NEW.member_number := lpad(nextval('member_number_seq')::text, 9, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_member_number ON members;
CREATE TRIGGER trg_generate_member_number
  BEFORE INSERT ON members
  FOR EACH ROW EXECUTE FUNCTION generate_member_number();

-- ============================================================================
-- PHASE 0B: Advisor Code Auto-Generation (7-digit numerical ID)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS advisor_code_seq
  START 1000001
  INCREMENT 1
  MAXVALUE 9999999
  NO CYCLE;

CREATE OR REPLACE FUNCTION generate_advisor_code_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.advisor_code IS NULL OR NEW.advisor_code = '' THEN
    NEW.advisor_code := lpad(nextval('advisor_code_seq')::text, 7, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_advisor_code ON advisors;
CREATE TRIGGER trg_generate_advisor_code
  BEFORE INSERT ON advisors
  FOR EACH ROW EXECUTE FUNCTION generate_advisor_code_number();

-- ============================================================================
-- PHASE 0C: Backfill existing records
-- ============================================================================

DO $$
DECLARE
  v_max_member_num bigint;
  v_max_advisor_num bigint;
  r RECORD;
  v_next_num bigint;
BEGIN
  -- Backfill members with missing member_number
  v_next_num := 100000001;
  
  -- Find the current max member_number to avoid conflicts
  SELECT COALESCE(MAX(member_number::bigint), 0)
    INTO v_max_member_num
    FROM members
    WHERE member_number IS NOT NULL
      AND member_number ~ '^\d+$';

  IF v_max_member_num >= v_next_num THEN
    v_next_num := v_max_member_num + 1;
  END IF;

  FOR r IN
    SELECT id FROM members
    WHERE member_number IS NULL OR member_number = ''
    ORDER BY created_at
  LOOP
    UPDATE members SET member_number = lpad(v_next_num::text, 9, '0') WHERE id = r.id;
    v_next_num := v_next_num + 1;
  END LOOP;

  -- Reset sequence to continue after the highest assigned value
  IF v_next_num > 100000001 THEN
    PERFORM setval('member_number_seq', v_next_num - 1);
  END IF;

  -- Backfill advisors with missing advisor_code
  v_next_num := 1000001;

  SELECT COALESCE(MAX(advisor_code::bigint), 0)
    INTO v_max_advisor_num
    FROM advisors
    WHERE advisor_code IS NOT NULL
      AND advisor_code ~ '^\d+$';

  IF v_max_advisor_num >= v_next_num THEN
    v_next_num := v_max_advisor_num + 1;
  END IF;

  FOR r IN
    SELECT id FROM advisors
    WHERE advisor_code IS NULL OR advisor_code = ''
    ORDER BY created_at
  LOOP
    UPDATE advisors SET advisor_code = lpad(v_next_num::text, 7, '0') WHERE id = r.id;
    v_next_num := v_next_num + 1;
  END LOOP;

  IF v_next_num > 1000001 THEN
    PERFORM setval('advisor_code_seq', v_next_num - 1);
  END IF;

  RAISE NOTICE 'Backfill complete. Member numbers assigned up to %, advisor codes up to %',
    v_max_member_num, v_max_advisor_num;
END $$;

-- ============================================================================
-- PHASE 0D: Add NOT NULL + UNIQUE constraints (after backfill)
-- ============================================================================

-- Set default for any remaining NULLs (safety)
UPDATE members SET member_number = lpad(nextval('member_number_seq')::text, 9, '0')
  WHERE member_number IS NULL OR member_number = '';
UPDATE advisors SET advisor_code = lpad(nextval('advisor_code_seq')::text, 7, '0')
  WHERE advisor_code IS NULL OR advisor_code = '';

-- Drop existing index that might conflict with the unique constraint
DROP INDEX IF EXISTS idx_members_member_number;
DROP INDEX IF EXISTS idx_advisors_advisor_code;

-- Add unique constraints
DO $$
BEGIN
  -- Members member_number unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_member_number_unique'
  ) THEN
    ALTER TABLE members ADD CONSTRAINT members_member_number_unique UNIQUE (member_number);
  END IF;

  -- Advisors advisor_code unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'advisors_advisor_code_unique'
  ) THEN
    ALTER TABLE advisors ADD CONSTRAINT advisors_advisor_code_unique UNIQUE (advisor_code);
  END IF;
END $$;

-- Set NOT NULL (safe now that all rows have values)
ALTER TABLE members ALTER COLUMN member_number SET NOT NULL;
ALTER TABLE advisors ALTER COLUMN advisor_code SET NOT NULL;

-- ============================================================================
-- PHASE 1A: Ensure "Members" and "Advisors" CRM modules exist
-- ============================================================================

DO $$
DECLARE
  v_org RECORD;
  v_members_module_id uuid;
  v_advisors_module_id uuid;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    -- Create or get "Members" module
    SELECT id INTO v_members_module_id
      FROM crm_modules
      WHERE org_id = v_org.id AND key = 'members';

    IF v_members_module_id IS NULL THEN
      INSERT INTO crm_modules (org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
      VALUES (v_org.id, 'members', 'Member', 'Members', 'heart', 'Health share members synced from enrollment', true, true, 2)
      RETURNING id INTO v_members_module_id;
    END IF;

    -- Create or get "Advisors" module
    SELECT id INTO v_advisors_module_id
      FROM crm_modules
      WHERE org_id = v_org.id AND key = 'advisors';

    IF v_advisors_module_id IS NULL THEN
      INSERT INTO crm_modules (org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
      VALUES (v_org.id, 'advisors', 'Advisor', 'Advisors', 'briefcase', 'Advisors and agents synced from admin', true, true, 3)
      RETURNING id INTO v_advisors_module_id;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- PHASE 1B: Sync trigger function - Members to CRM Records
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

  -- If no module found, skip silently (org might not have CRM set up)
  IF v_module_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Handle DELETE: remove matching crm_record
  IF TG_OP = 'DELETE' THEN
    DELETE FROM crm_records
      WHERE module_id = v_module_id
        AND system->>'source_table' = 'members'
        AND system->>'source_id' = OLD.id::text;
    RETURN OLD;
  END IF;

  -- For INSERT/UPDATE: look up advisor info
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
      created_at, updated_at
    ) VALUES (
      NEW.organization_id,
      v_module_id,
      v_owner_id,
      NEW.first_name || ' ' || NEW.last_name,
      NEW.status,
      NEW.email,
      NEW.phone,
      v_data,
      jsonb_build_object(
        'source_table', 'members',
        'source_id', NEW.id::text,
        'member_number', NEW.member_number,
        'synced', true
      ),
      NEW.created_at,
      now()
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
      updated_at = now()
    WHERE module_id = v_module_id
      AND system->>'source_table' = 'members'
      AND system->>'source_id' = OLD.id::text;

    -- If no row was updated (e.g. record was missing), insert it
    IF NOT FOUND THEN
      INSERT INTO crm_records (
        org_id, module_id, owner_id,
        title, status, email, phone,
        data, system,
        created_at, updated_at
      ) VALUES (
        NEW.organization_id,
        v_module_id,
        v_owner_id,
        NEW.first_name || ' ' || NEW.last_name,
        NEW.status,
        NEW.email,
        NEW.phone,
        v_data,
        jsonb_build_object(
          'source_table', 'members',
          'source_id', NEW.id::text,
          'member_number', NEW.member_number,
          'synced', true
        ),
        COALESCE(NEW.created_at, now()),
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_member_to_crm ON members;
CREATE TRIGGER trg_sync_member_to_crm
  AFTER INSERT OR UPDATE OR DELETE ON members
  FOR EACH ROW EXECUTE FUNCTION sync_member_to_crm_records();

-- ============================================================================
-- PHASE 1D: Sync trigger function - Advisors to CRM Records
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_advisor_to_crm_records()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_owner_id uuid;
  v_org_id uuid;
  v_data jsonb;
BEGIN
  -- Determine the org_id
  IF TG_OP = 'DELETE' THEN
    v_org_id := COALESCE(OLD.organization_id, OLD.org_id);
  ELSE
    v_org_id := COALESCE(NEW.organization_id, NEW.org_id);
  END IF;

  -- Find the "advisors" CRM module for this org
  SELECT id INTO v_module_id
    FROM crm_modules
    WHERE org_id = v_org_id AND key = 'advisors';

  IF v_module_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM crm_records
      WHERE module_id = v_module_id
        AND system->>'source_table' = 'advisors'
        AND system->>'source_id' = OLD.id::text;
    RETURN OLD;
  END IF;

  -- Get profile owner_id
  IF NEW.profile_id IS NOT NULL THEN
    v_owner_id := NEW.profile_id;
  END IF;

  -- Build data JSONB
  v_data := jsonb_build_object(
    'advisor_code', NEW.advisor_code,
    'first_name', NEW.first_name,
    'last_name', NEW.last_name,
    'agency_name', NEW.agency_name,
    'license_number', NEW.license_number,
    'npn', NEW.npn,
    'commission_tier', NEW.commission_tier,
    'enrollment_code', NEW.enrollment_code,
    'contract_date', NEW.contract_date,
    'primary_channel', NEW.primary_channel,
    'agent_role', NEW.agent_role
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_records (
      org_id, module_id, owner_id,
      title, status, email, phone,
      data, system,
      created_at, updated_at
    ) VALUES (
      v_org_id,
      v_module_id,
      v_owner_id,
      NEW.first_name || ' ' || NEW.last_name,
      NEW.status,
      NEW.email,
      NEW.phone,
      v_data,
      jsonb_build_object(
        'source_table', 'advisors',
        'source_id', NEW.id::text,
        'advisor_code', NEW.advisor_code,
        'synced', true
      ),
      NEW.created_at,
      now()
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
        'source_table', 'advisors',
        'source_id', NEW.id::text,
        'advisor_code', NEW.advisor_code,
        'synced', true
      ),
      updated_at = now()
    WHERE module_id = v_module_id
      AND system->>'source_table' = 'advisors'
      AND system->>'source_id' = OLD.id::text;

    -- Upsert if missing
    IF NOT FOUND THEN
      INSERT INTO crm_records (
        org_id, module_id, owner_id,
        title, status, email, phone,
        data, system,
        created_at, updated_at
      ) VALUES (
        v_org_id,
        v_module_id,
        v_owner_id,
        NEW.first_name || ' ' || NEW.last_name,
        NEW.status,
        NEW.email,
        NEW.phone,
        v_data,
        jsonb_build_object(
          'source_table', 'advisors',
          'source_id', NEW.id::text,
          'advisor_code', NEW.advisor_code,
          'synced', true
        ),
        COALESCE(NEW.created_at, now()),
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_advisor_to_crm ON advisors;
CREATE TRIGGER trg_sync_advisor_to_crm
  AFTER INSERT OR UPDATE OR DELETE ON advisors
  FOR EACH ROW EXECUTE FUNCTION sync_advisor_to_crm_records();

-- ============================================================================
-- PHASE 1C: Backfill existing members and advisors into crm_records
-- ============================================================================

DO $$
DECLARE
  v_org RECORD;
  v_members_module_id uuid;
  v_advisors_module_id uuid;
  v_member RECORD;
  v_advisor RECORD;
  v_owner_id uuid;
  v_advisor_code text;
  v_advisor_name text;
  v_data jsonb;
  v_member_count int := 0;
  v_advisor_count int := 0;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    -- Get module IDs
    SELECT id INTO v_members_module_id
      FROM crm_modules WHERE org_id = v_org.id AND key = 'members';
    SELECT id INTO v_advisors_module_id
      FROM crm_modules WHERE org_id = v_org.id AND key = 'advisors';

    -- Backfill members
    IF v_members_module_id IS NOT NULL THEN
      FOR v_member IN
        SELECT m.* FROM members m
        WHERE m.organization_id = v_org.id
          AND NOT EXISTS (
            SELECT 1 FROM crm_records cr
            WHERE cr.module_id = v_members_module_id
              AND cr.system->>'source_table' = 'members'
              AND cr.system->>'source_id' = m.id::text
          )
      LOOP
        -- Look up advisor info
        v_owner_id := NULL;
        v_advisor_code := NULL;
        v_advisor_name := NULL;

        IF v_member.advisor_id IS NOT NULL THEN
          SELECT
            a.advisor_code,
            a.first_name || ' ' || a.last_name,
            p.id
          INTO v_advisor_code, v_advisor_name, v_owner_id
          FROM advisors a
          LEFT JOIN profiles p ON p.id = a.profile_id
          WHERE a.id = v_member.advisor_id;
        END IF;

        v_data := jsonb_build_object(
          'member_number', v_member.member_number,
          'first_name', v_member.first_name,
          'last_name', v_member.last_name,
          'date_of_birth', v_member.date_of_birth,
          'gender', v_member.gender,
          'marital_status', v_member.marital_status,
          'address_line1', v_member.address_line1,
          'address_line2', v_member.address_line2,
          'city', v_member.city,
          'state', v_member.state,
          'zip_code', COALESCE(v_member.postal_code, v_member.zip_code),
          'advisor_id', v_member.advisor_id,
          'advisor_code', v_advisor_code,
          'advisor_name', v_advisor_name,
          'plan_name', v_member.plan_name,
          'plan_type', v_member.plan_type,
          'effective_date', v_member.effective_date,
          'monthly_share', v_member.monthly_share,
          'coverage_type', v_member.coverage_type,
          'program_type', v_member.program_type
        );

        INSERT INTO crm_records (
          org_id, module_id, owner_id,
          title, status, email, phone,
          data, system,
          created_at, updated_at
        ) VALUES (
          v_member.organization_id,
          v_members_module_id,
          v_owner_id,
          v_member.first_name || ' ' || v_member.last_name,
          v_member.status,
          v_member.email,
          v_member.phone,
          v_data,
          jsonb_build_object(
            'source_table', 'members',
            'source_id', v_member.id::text,
            'member_number', v_member.member_number,
            'synced', true
          ),
          v_member.created_at,
          now()
        );

        v_member_count := v_member_count + 1;
      END LOOP;
    END IF;

    -- Backfill advisors
    IF v_advisors_module_id IS NOT NULL THEN
      FOR v_advisor IN
        SELECT a.* FROM advisors a
        WHERE a.organization_id = v_org.id
          AND NOT EXISTS (
            SELECT 1 FROM crm_records cr
            WHERE cr.module_id = v_advisors_module_id
              AND cr.system->>'source_table' = 'advisors'
              AND cr.system->>'source_id' = a.id::text
          )
      LOOP
        v_owner_id := v_advisor.profile_id;

        v_data := jsonb_build_object(
          'advisor_code', v_advisor.advisor_code,
          'first_name', v_advisor.first_name,
          'last_name', v_advisor.last_name,
          'agency_name', v_advisor.agency_name,
          'license_number', v_advisor.license_number,
          'npn', v_advisor.npn,
          'commission_tier', v_advisor.commission_tier,
          'enrollment_code', v_advisor.enrollment_code,
          'contract_date', v_advisor.contract_date,
          'primary_channel', v_advisor.primary_channel,
          'agent_role', v_advisor.agent_role
        );

        INSERT INTO crm_records (
          org_id, module_id, owner_id,
          title, status, email, phone,
          data, system,
          created_at, updated_at
        ) VALUES (
          v_org.id,
          v_advisors_module_id,
          v_owner_id,
          v_advisor.first_name || ' ' || v_advisor.last_name,
          v_advisor.status,
          v_advisor.email,
          v_advisor.phone,
          v_data,
          jsonb_build_object(
            'source_table', 'advisors',
            'source_id', v_advisor.id::text,
            'advisor_code', v_advisor.advisor_code,
            'synced', true
          ),
          v_advisor.created_at,
          now()
        );

        v_advisor_count := v_advisor_count + 1;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % members and % advisors synced to crm_records',
    v_member_count, v_advisor_count;
END $$;

-- ============================================================================
-- PHASE 6: CRM Field Definitions for Members Module
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_members_module_id uuid;
  v_advisors_module_id uuid;
  v_display_order int := 0;
BEGIN
  -- Get the first organization (for initial setup)
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found. Fields will be created when an organization exists.';
    RETURN;
  END IF;

  -- Get Members module
  SELECT id INTO v_members_module_id FROM crm_modules
    WHERE org_id = v_org_id AND key = 'members';

  -- Get Advisors module
  SELECT id INTO v_advisors_module_id FROM crm_modules
    WHERE org_id = v_org_id AND key = 'advisors';

  -- ============================================================================
  -- MEMBERS MODULE FIELDS
  -- ============================================================================

  IF v_members_module_id IS NOT NULL THEN
    v_display_order := 0;

    -- Member Number (9-digit ID)
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, is_pinned, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'member_number', 'Member Number', 'text', false, true, true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, is_pinned = EXCLUDED.is_pinned;
    v_display_order := v_display_order + 1;

    -- First Name
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'first_name', 'First Name', 'text', true, true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Last Name
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'last_name', 'Last Name', 'text', true, true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Email
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'email', 'Email', 'email', true, true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Phone
    INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, is_indexed, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'phone', 'Phone', 'phone', true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Date of Birth
    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'date_of_birth', 'Date of Birth', 'date', 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Gender
    INSERT INTO crm_fields (org_id, module_id, key, label, type, options, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'gender', 'Gender', 'select',
      '["Male", "Female", "Other", "Prefer not to say"]'::jsonb, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Marital Status
    INSERT INTO crm_fields (org_id, module_id, key, label, type, options, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'marital_status', 'Marital Status', 'select',
      '["Single", "Married", "Divorced", "Widowed"]'::jsonb, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- SECTION: Address
    v_display_order := 100;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'address_line1', 'Address', 'text', 'address', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'address_line2', 'Address Line 2', 'text', 'address', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'city', 'City', 'text', 'address', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'state', 'State', 'text', 'address', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'zip_code', 'Zip Code', 'text', 'address', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- SECTION: Coverage
    v_display_order := 200;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'plan_name', 'Plan Name', 'text', 'coverage', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'plan_type', 'Plan Type', 'text', 'coverage', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'coverage_type', 'Coverage Type', 'text', 'coverage', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'program_type', 'Program Type', 'text', 'coverage', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'effective_date', 'Effective Date', 'date', 'coverage', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'monthly_share', 'Monthly Share', 'currency', 'coverage', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- SECTION: Advisor Info
    v_display_order := 300;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, is_indexed, is_pinned, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'advisor_code', 'Advisor Code', 'text', true, true, 'advisor', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, is_pinned = EXCLUDED.is_pinned;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'advisor_name', 'Advisor Name', 'text', 'advisor', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_members_module_id, 'enrollment_source', 'Enrollment Source', 'text', 'advisor', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Create default layout for Members module
    INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
    VALUES (
      v_org_id,
      v_members_module_id,
      'Default Member Layout',
      true,
      '{
        "sections": [
          {"key": "core", "label": "Member Information", "columns": 2},
          {"key": "address", "label": "Address", "columns": 2},
          {"key": "coverage", "label": "Coverage & Plan", "columns": 2},
          {"key": "advisor", "label": "Advisor Information", "columns": 2}
        ]
      }'::jsonb
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ============================================================================
  -- ADVISORS MODULE FIELDS
  -- ============================================================================

  IF v_advisors_module_id IS NOT NULL THEN
    v_display_order := 0;

    -- Advisor Code (7-digit ID)
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, is_pinned, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'advisor_code', 'Advisor Code', 'text', false, true, true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section, is_pinned = EXCLUDED.is_pinned;
    v_display_order := v_display_order + 1;

    -- First Name
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'first_name', 'First Name', 'text', true, true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Last Name
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'last_name', 'Last Name', 'text', true, true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Email
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'email', 'Email', 'email', true, true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Phone
    INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, is_indexed, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'phone', 'Phone', 'phone', true, true, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Agency Name
    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'agency_name', 'Agency Name', 'text', 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Agent Role
    INSERT INTO crm_fields (org_id, module_id, key, label, type, options, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'agent_role', 'Agent Role', 'select',
      '["Agent", "Agency"]'::jsonb, 'core', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- SECTION: Licensing
    v_display_order := 100;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'license_number', 'License Number', 'text', 'licensing', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'npn', 'NPN', 'text', 'licensing', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'contract_date', 'Contract Date', 'date', 'licensing', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- SECTION: Commission Info
    v_display_order := 200;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'commission_tier', 'Commission Tier', 'text', 'commissions', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'primary_channel', 'Primary Channel', 'text', 'commissions', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
    VALUES (v_org_id, v_advisors_module_id, 'enrollment_code', 'Enrollment Code', 'text', 'commissions', v_display_order)
    ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
    v_display_order := v_display_order + 1;

    -- Create default layout for Advisors module
    INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
    VALUES (
      v_org_id,
      v_advisors_module_id,
      'Default Advisor Layout',
      true,
      '{
        "sections": [
          {"key": "core", "label": "Advisor Information", "columns": 2},
          {"key": "licensing", "label": "Licensing", "columns": 2},
          {"key": "commissions", "label": "Commission Information", "columns": 2}
        ]
      }'::jsonb
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'CRM field definitions created for Members and Advisors modules.';
END $$;

-- ============================================================================
-- Add index for efficient CRM record lookup by source
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_crm_records_source
  ON crm_records ((system->>'source_table'), (system->>'source_id'));

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: member_number sequences, advisor_code sequences, CRM sync triggers, field definitions, and backfill.';
END $$;
