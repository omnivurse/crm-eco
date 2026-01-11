-- ============================================================================
-- CRM-ECO: Enrollment Sync
-- Creates crm_ext schema with views for enrollment data access
-- Sets up triggers for automatic sync from enrollment to CRM
-- ============================================================================

-- Create crm_ext schema for enrollment integration views
CREATE SCHEMA IF NOT EXISTS crm_ext;

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA crm_ext TO authenticated;

-- ============================================================================
-- SECURITY INVOKER VIEWS
-- These views respect the caller's RLS permissions
-- ============================================================================

-- Members view (enrollment -> CRM read-only)
-- Note: View created conditionally only if members table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members') THEN
    EXECUTE '
      CREATE OR REPLACE VIEW crm_ext.members 
      WITH (security_invoker = true) AS
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        COALESCE(m.first_name, '''') || '' '' || COALESCE(m.last_name, '''') AS full_name,
        m.email,
        m.phone,
        m.status,
        m.organization_id,
        m.created_at,
        m.updated_at
      FROM members m
    ';
    COMMENT ON VIEW crm_ext.members IS 'Read-only view of enrollment members for CRM access';
    GRANT SELECT ON crm_ext.members TO authenticated;
  END IF;
END $$;

-- Enrollments view (enrollment -> CRM read-only)
-- Note: View created conditionally only if enrollments table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrollments') THEN
    EXECUTE '
      CREATE OR REPLACE VIEW crm_ext.enrollments
      WITH (security_invoker = true) AS
      SELECT 
        e.id,
        e.primary_member_id,
        e.status,
        e.effective_date,
        e.organization_id,
        e.created_at,
        e.updated_at
      FROM enrollments e
    ';
    COMMENT ON VIEW crm_ext.enrollments IS 'Read-only view of enrollments for CRM access';
    GRANT SELECT ON crm_ext.enrollments TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- ENROLLMENT -> CRM SYNC TRIGGER
-- Automatically creates/updates CRM Contacts when members change
-- ============================================================================

-- Function to sync member to CRM contacts
CREATE OR REPLACE FUNCTION sync_member_to_crm()
RETURNS TRIGGER AS $$
DECLARE
  v_contacts_module_id uuid;
  v_existing_record_id uuid;
  v_record_title text;
BEGIN
  -- Get the contacts module for this organization
  SELECT id INTO v_contacts_module_id
  FROM crm_modules
  WHERE org_id = NEW.organization_id
    AND key = 'contacts'
    AND is_enabled = true
  LIMIT 1;

  -- If no contacts module, skip
  IF v_contacts_module_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build record title
  v_record_title := COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '');
  IF v_record_title = ' ' THEN
    v_record_title := COALESCE(NEW.email, 'Member ' || NEW.id::text);
  END IF;

  -- Check if CRM record already exists for this member
  SELECT id INTO v_existing_record_id
  FROM crm_records
  WHERE module_id = v_contacts_module_id
    AND (data->>'linked_member_id')::uuid = NEW.id
  LIMIT 1;

  IF v_existing_record_id IS NOT NULL THEN
    -- Update existing record
    UPDATE crm_records
    SET
      title = v_record_title,
      email = NEW.email,
      phone = NEW.phone,
      status = COALESCE(NEW.status, 'Active'),
      data = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(data, '{}'::jsonb),
              '{first_name}', to_jsonb(NEW.first_name)
            ),
            '{last_name}', to_jsonb(NEW.last_name)
          ),
          '{email}', to_jsonb(NEW.email)
        ),
        '{linked_member_id}', to_jsonb(NEW.id::text)
      ),
      updated_at = now()
    WHERE id = v_existing_record_id;
  ELSE
    -- Create new CRM record
    INSERT INTO crm_records (
      org_id,
      module_id,
      title,
      email,
      phone,
      status,
      data,
      search,
      created_at,
      updated_at
    ) VALUES (
      NEW.organization_id,
      v_contacts_module_id,
      v_record_title,
      NEW.email,
      NEW.phone,
      COALESCE(NEW.status, 'Active'),
      jsonb_build_object(
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'email', NEW.email,
        'phone', NEW.phone,
        'contact_status', COALESCE(NEW.status, 'Active'),
        'linked_member_id', NEW.id::text,
        'source', 'enrollment_sync'
      ),
      to_tsvector('english', COALESCE(v_record_title, '') || ' ' || COALESCE(NEW.email, '')),
      now(),
      now()
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the member operation
    RAISE WARNING 'CRM sync failed for member %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for member sync (only if members table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members') THEN
    DROP TRIGGER IF EXISTS trigger_sync_member_to_crm ON members;
    CREATE TRIGGER trigger_sync_member_to_crm
      AFTER INSERT OR UPDATE ON members
      FOR EACH ROW
      EXECUTE FUNCTION sync_member_to_crm();
  END IF;
END $$;

-- ============================================================================
-- CRM -> ENROLLMENT LEAD CONVERSION
-- Stored procedure to convert a CRM lead to an enrollment member
-- ============================================================================

CREATE OR REPLACE FUNCTION convert_lead_to_member(
  p_lead_record_id uuid,
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_lead_record crm_records%ROWTYPE;
  v_org_id uuid;
  v_new_member_id uuid;
  v_contacts_module_id uuid;
  v_new_contact_id uuid;
BEGIN
  -- Get the lead record
  SELECT * INTO v_lead_record
  FROM crm_records
  WHERE id = p_lead_record_id;

  IF v_lead_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead record not found');
  END IF;

  v_org_id := v_lead_record.org_id;

  -- Check if member with same email exists
  IF v_lead_record.email IS NOT NULL THEN
    SELECT id INTO v_new_member_id
    FROM members
    WHERE email = v_lead_record.email
      AND organization_id = v_org_id
    LIMIT 1;
  END IF;

  -- If no existing member, create one
  IF v_new_member_id IS NULL THEN
    INSERT INTO members (
      organization_id,
      first_name,
      last_name,
      email,
      phone,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_org_id,
      v_lead_record.data->>'first_name',
      v_lead_record.data->>'last_name',
      v_lead_record.email,
      v_lead_record.phone,
      'Active',
      now(),
      now()
    )
    RETURNING id INTO v_new_member_id;
  END IF;

  -- Update the lead record status to Converted
  UPDATE crm_records
  SET 
    status = 'Converted',
    data = jsonb_set(
      jsonb_set(
        COALESCE(data, '{}'::jsonb),
        '{lead_status}', '"Converted"'::jsonb
      ),
      '{converted_member_id}', to_jsonb(v_new_member_id::text)
    ),
    updated_at = now()
  WHERE id = p_lead_record_id;

  -- Log the conversion in audit
  INSERT INTO crm_audit_log (org_id, user_id, record_id, module_id, entity, action, changes)
  VALUES (
    v_org_id, 
    p_user_id, 
    p_lead_record_id, 
    v_lead_record.module_id, 
    'lead', 
    'convert',
    jsonb_build_object(
      'converted_to_member_id', v_new_member_id,
      'converted_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_new_member_id,
    'lead_id', p_lead_record_id,
    'message', 'Lead converted to member successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION convert_lead_to_member(uuid, uuid) TO authenticated;

SELECT 'CRM Enrollment Sync migration complete!' as status;
