-- ============================================================================
-- CRM-ECO: Member Pipeline and Admin Notifications
--
-- This migration:
-- 1. Creates member lifecycle stages (Application → Under Review → Approved → Active → Terminated)
-- 2. Creates admin_notifications table for in-app notifications
-- 3. Adds trigger to create CRM Member record when enrollment is submitted
-- 4. Adds trigger to notify admins when enrollment is submitted
-- ============================================================================

-- ============================================================================
-- PART 1: MEMBER LIFECYCLE STAGES
-- ============================================================================

-- Function to seed member stages for an organization
CREATE OR REPLACE FUNCTION seed_member_stages(p_org_id uuid)
RETURNS void AS $$
BEGIN
  -- Only insert if no stages exist for this org
  IF NOT EXISTS (SELECT 1 FROM crm_deal_stages WHERE org_id = p_org_id) THEN
    INSERT INTO crm_deal_stages (org_id, key, name, color, probability, is_won, is_lost, display_order)
    VALUES
      (p_org_id, 'application', 'Application', '#8b5cf6', 0, false, false, 1),
      (p_org_id, 'under_review', 'Under Review', '#f59e0b', 25, false, false, 2),
      (p_org_id, 'approved', 'Approved', '#22c55e', 75, false, false, 3),
      (p_org_id, 'active', 'Active', '#3b82f6', 100, true, false, 4),
      (p_org_id, 'terminated', 'Terminated', '#ef4444', 0, false, true, 5);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION seed_member_stages(uuid) TO authenticated;

-- ============================================================================
-- PART 2: ADMIN NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  href text,
  icon text DEFAULT 'bell',
  type text DEFAULT 'info',
  meta jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id ON admin_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_org_id ON admin_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can update their own notifications"
  ON admin_notifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;

-- ============================================================================
-- PART 3: ENROLLMENT → CRM MEMBER SYNC TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_enrollment_to_crm_member()
RETURNS TRIGGER AS $$
DECLARE
  v_deals_module_id uuid;
  v_existing_record_id uuid;
  v_member record;
  v_record_title text;
BEGIN
  -- Only trigger when status changes to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN

    -- Get the deals/members module for this organization
    SELECT id INTO v_deals_module_id
    FROM crm_modules
    WHERE org_id = NEW.organization_id
      AND key = 'deals'
      AND is_enabled = true
    LIMIT 1;

    IF v_deals_module_id IS NULL THEN
      -- Module not found, skip
      RETURN NEW;
    END IF;

    -- Get member info
    SELECT first_name, last_name, email, phone INTO v_member
    FROM members
    WHERE id = NEW.primary_member_id;

    v_record_title := TRIM(COALESCE(v_member.first_name, '') || ' ' || COALESCE(v_member.last_name, ''));
    IF v_record_title = '' THEN
      v_record_title := COALESCE(v_member.email, 'Member Application');
    END IF;

    -- Check if CRM record already exists for this enrollment
    SELECT id INTO v_existing_record_id
    FROM crm_records
    WHERE module_id = v_deals_module_id
      AND (data->>'linked_enrollment_id')::text = NEW.id::text
    LIMIT 1;

    IF v_existing_record_id IS NOT NULL THEN
      -- Update stage to under_review
      UPDATE crm_records
      SET
        stage = 'under_review',
        status = 'Active',
        updated_at = now()
      WHERE id = v_existing_record_id;
    ELSE
      -- Create new CRM Member record
      INSERT INTO crm_records (
        org_id,
        module_id,
        title,
        email,
        phone,
        stage,
        status,
        data,
        created_at,
        updated_at
      ) VALUES (
        NEW.organization_id,
        v_deals_module_id,
        v_record_title,
        v_member.email,
        v_member.phone,
        'under_review',
        'Active',
        jsonb_build_object(
          'member_name', v_record_title,
          'email', v_member.email,
          'phone', v_member.phone,
          'linked_member_id', NEW.primary_member_id::text,
          'linked_enrollment_id', NEW.id::text,
          'enrollment_number', NEW.enrollment_number,
          'source', 'enrollment_submission',
          'submitted_at', now()::text
        ),
        now(),
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'CRM Member sync failed for enrollment %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_sync_enrollment_to_crm_member ON enrollments;
CREATE TRIGGER trigger_sync_enrollment_to_crm_member
  AFTER UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION sync_enrollment_to_crm_member();

-- ============================================================================
-- PART 4: ENROLLMENT → ADMIN NOTIFICATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_admins_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  v_member record;
  v_member_name text;
  v_admin record;
BEGIN
  -- Only trigger when status changes to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN

    -- Get member info
    SELECT first_name, last_name, email INTO v_member
    FROM members
    WHERE id = NEW.primary_member_id;

    v_member_name := TRIM(COALESCE(v_member.first_name, '') || ' ' || COALESCE(v_member.last_name, ''));
    IF v_member_name = '' THEN
      v_member_name := COALESCE(v_member.email, 'New Member');
    END IF;

    -- Create notification for all admin users in this organization
    FOR v_admin IN
      SELECT id
      FROM profiles
      WHERE organization_id = NEW.organization_id
        AND role IN ('owner', 'admin', 'staff')
    LOOP
      INSERT INTO admin_notifications (
        organization_id,
        user_id,
        title,
        body,
        href,
        icon,
        type,
        meta
      ) VALUES (
        NEW.organization_id,
        v_admin.id,
        'New Enrollment Submitted',
        v_member_name || ' has submitted an enrollment application.',
        '/enrollments/' || NEW.id,
        'file-text',
        'enrollment',
        jsonb_build_object(
          'enrollment_id', NEW.id,
          'enrollment_number', NEW.enrollment_number,
          'member_id', NEW.primary_member_id,
          'member_name', v_member_name
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Admin notification failed for enrollment %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_admins_on_enrollment ON enrollments;
CREATE TRIGGER trigger_notify_admins_on_enrollment
  AFTER UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_enrollment();

-- ============================================================================
-- PART 5: UPDATE MODULE DISPLAY NAME (Deals → Members)
-- ============================================================================

-- Update existing 'deals' modules to display as 'Members'
UPDATE crm_modules
SET
  name = 'Member',
  name_plural = 'Members',
  icon = 'users',
  description = 'Manage member applications and lifecycle'
WHERE key = 'deals';

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Member Pipeline and Notifications Migration Complete!' as status;
