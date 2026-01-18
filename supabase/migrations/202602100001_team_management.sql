-- ============================================================================
-- Team Management & Invitations
-- ============================================================================
-- Adds team invitation system and extends role management
-- ============================================================================

-- First, update the role constraint on profiles to include 'super_admin'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'super_admin', 'admin', 'advisor', 'staff'));

-- ============================================================================
-- Team Invitations Table
-- ============================================================================
-- Stores pending invitations for team members

CREATE TABLE IF NOT EXISTS team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Invitation details
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'admin', 'advisor', 'staff')),

  -- Invitation state
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  token text NOT NULL UNIQUE,

  -- Expiration
  expires_at timestamptz NOT NULL,

  -- Tracking
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Prevent duplicate pending invitations to same email in same org
  UNIQUE(organization_id, email, status) WHERE status = 'pending'
);

-- Enable RLS
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Indexes for common queries
CREATE INDEX idx_team_invitations_org_id ON team_invitations(organization_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);
CREATE INDEX idx_team_invitations_expires_at ON team_invitations(expires_at);

-- ============================================================================
-- RLS Policies for Team Invitations
-- ============================================================================

-- Users can view invitations for their organization (admin+ only)
CREATE POLICY "team_invitations_select_policy" ON team_invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin')
      AND is_active = true
    )
  );

-- Only admin+ can create invitations
CREATE POLICY "team_invitations_insert_policy" ON team_invitations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin')
      AND is_active = true
    )
  );

-- Only admin+ can update invitations (revoke, etc)
CREATE POLICY "team_invitations_update_policy" ON team_invitations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin')
      AND is_active = true
    )
  );

-- Only admin+ can delete invitations
CREATE POLICY "team_invitations_delete_policy" ON team_invitations
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin')
      AND is_active = true
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to generate a secure invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- Function to create a team invitation
CREATE OR REPLACE FUNCTION create_team_invitation(
  p_org_id uuid,
  p_email text,
  p_role text DEFAULT 'staff',
  p_expires_in_days int DEFAULT 7
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inviter_profile_id uuid;
  v_inviter_role text;
  v_invitation_id uuid;
  v_token text;
BEGIN
  -- Get inviter's profile
  SELECT id, role INTO v_inviter_profile_id, v_inviter_role
  FROM profiles
  WHERE user_id = auth.uid()
    AND organization_id = p_org_id
    AND is_active = true;

  IF v_inviter_profile_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this organization';
  END IF;

  -- Check permission to invite
  IF v_inviter_role NOT IN ('owner', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to invite team members';
  END IF;

  -- Prevent inviting roles higher than your own
  IF p_role = 'super_admin' AND v_inviter_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Cannot invite super admin role';
  END IF;

  -- Check if email already exists in organization
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE organization_id = p_org_id
    AND email = p_email
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User already exists in this organization';
  END IF;

  -- Check for existing pending invitation
  IF EXISTS (
    SELECT 1 FROM team_invitations
    WHERE organization_id = p_org_id
    AND email = p_email
    AND status = 'pending'
    AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Pending invitation already exists for this email';
  END IF;

  -- Generate token
  v_token := generate_invitation_token();

  -- Create invitation
  INSERT INTO team_invitations (
    organization_id,
    email,
    role,
    token,
    expires_at,
    invited_by
  ) VALUES (
    p_org_id,
    p_email,
    p_role,
    v_token,
    now() + (p_expires_in_days || ' days')::interval,
    v_inviter_profile_id
  )
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

-- Function to accept an invitation
CREATE OR REPLACE FUNCTION accept_team_invitation(
  p_token text,
  p_full_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation record;
  v_profile_id uuid;
  v_user_email text;
BEGIN
  -- Get current user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get and validate invitation
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Check email matches
  IF lower(v_invitation.email) != lower(v_user_email) THEN
    RAISE EXCEPTION 'Invitation is for a different email address';
  END IF;

  -- Check user doesn't already have a profile in this org
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND organization_id = v_invitation.organization_id
  ) THEN
    RAISE EXCEPTION 'User already has a profile in this organization';
  END IF;

  -- Create profile
  INSERT INTO profiles (
    user_id,
    organization_id,
    email,
    full_name,
    role,
    is_active
  ) VALUES (
    auth.uid(),
    v_invitation.organization_id,
    v_user_email,
    p_full_name,
    v_invitation.role,
    true
  )
  RETURNING id INTO v_profile_id;

  -- Update invitation
  UPDATE team_invitations
  SET
    status = 'accepted',
    accepted_by = v_profile_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = v_invitation.id;

  RETURN v_profile_id;
END;
$$;

-- Function to revoke an invitation
CREATE OR REPLACE FUNCTION revoke_team_invitation(p_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation record;
  v_user_profile record;
BEGIN
  -- Get invitation
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE id = p_invitation_id;

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  -- Get user's profile in the same org
  SELECT id, role INTO v_user_profile
  FROM profiles
  WHERE user_id = auth.uid()
    AND organization_id = v_invitation.organization_id
    AND is_active = true;

  IF v_user_profile IS NULL OR v_user_profile.role NOT IN ('owner', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Revoke invitation
  UPDATE team_invitations
  SET
    status = 'revoked',
    updated_at = now()
  WHERE id = p_invitation_id
    AND status = 'pending';

  RETURN true;
END;
$$;

-- Function to get team members for an organization
CREATE OR REPLACE FUNCTION get_team_members(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  display_name text,
  avatar_url text,
  role text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify user has access to this organization
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.organization_id = p_org_id
      AND profiles.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.email,
    p.full_name,
    p.display_name,
    p.avatar_url,
    p.role,
    p.is_active,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.organization_id = p_org_id
  ORDER BY
    CASE p.role
      WHEN 'owner' THEN 1
      WHEN 'super_admin' THEN 2
      WHEN 'admin' THEN 3
      WHEN 'advisor' THEN 4
      WHEN 'staff' THEN 5
    END,
    p.full_name;
END;
$$;

-- Function to update a team member's role
CREATE OR REPLACE FUNCTION update_team_member_role(
  p_profile_id uuid,
  p_new_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_profile record;
  v_user_profile record;
BEGIN
  -- Get target profile
  SELECT * INTO v_target_profile
  FROM profiles
  WHERE id = p_profile_id;

  IF v_target_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Get user's profile in the same org
  SELECT id, role INTO v_user_profile
  FROM profiles
  WHERE user_id = auth.uid()
    AND organization_id = v_target_profile.organization_id
    AND is_active = true;

  -- Check permissions
  IF v_user_profile IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Only owner can change owner or super_admin roles
  IF v_target_profile.role IN ('owner', 'super_admin') AND v_user_profile.role != 'owner' THEN
    RAISE EXCEPTION 'Only owner can modify owner or super admin roles';
  END IF;

  -- Only owner/super_admin can set super_admin role
  IF p_new_role = 'super_admin' AND v_user_profile.role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Cannot assign super admin role';
  END IF;

  -- Cannot change owner's role (must transfer ownership instead)
  IF v_target_profile.role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change owner role. Transfer ownership instead.';
  END IF;

  -- Admin+ required for any role changes
  IF v_user_profile.role NOT IN ('owner', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Update role
  UPDATE profiles
  SET
    role = p_new_role,
    updated_at = now()
  WHERE id = p_profile_id;

  RETURN true;
END;
$$;

-- Function to deactivate a team member
CREATE OR REPLACE FUNCTION deactivate_team_member(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_profile record;
  v_user_profile record;
BEGIN
  -- Get target profile
  SELECT * INTO v_target_profile
  FROM profiles
  WHERE id = p_profile_id;

  IF v_target_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Cannot deactivate owner
  IF v_target_profile.role = 'owner' THEN
    RAISE EXCEPTION 'Cannot deactivate organization owner';
  END IF;

  -- Get user's profile in the same org
  SELECT id, role INTO v_user_profile
  FROM profiles
  WHERE user_id = auth.uid()
    AND organization_id = v_target_profile.organization_id
    AND is_active = true;

  -- Check permissions
  IF v_user_profile IS NULL OR v_user_profile.role NOT IN ('owner', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Cannot deactivate yourself
  IF v_target_profile.id = v_user_profile.id THEN
    RAISE EXCEPTION 'Cannot deactivate yourself';
  END IF;

  -- Deactivate
  UPDATE profiles
  SET
    is_active = false,
    updated_at = now()
  WHERE id = p_profile_id;

  RETURN true;
END;
$$;

-- Function to reactivate a team member
CREATE OR REPLACE FUNCTION reactivate_team_member(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_profile record;
  v_user_profile record;
BEGIN
  -- Get target profile
  SELECT * INTO v_target_profile
  FROM profiles
  WHERE id = p_profile_id;

  IF v_target_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Get user's profile in the same org
  SELECT id, role INTO v_user_profile
  FROM profiles
  WHERE user_id = auth.uid()
    AND organization_id = v_target_profile.organization_id
    AND is_active = true;

  -- Check permissions
  IF v_user_profile IS NULL OR v_user_profile.role NOT IN ('owner', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Reactivate
  UPDATE profiles
  SET
    is_active = true,
    updated_at = now()
  WHERE id = p_profile_id;

  RETURN true;
END;
$$;

-- ============================================================================
-- Trigger to clean up expired invitations
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE team_invitations
  SET
    status = 'expired',
    updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();

  RETURN NULL;
END;
$$;

-- Run cleanup on each insert (simple approach)
DROP TRIGGER IF EXISTS trigger_cleanup_expired_invitations ON team_invitations;
CREATE TRIGGER trigger_cleanup_expired_invitations
  AFTER INSERT ON team_invitations
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_invitations();

-- ============================================================================
-- Updated at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS set_updated_at_team_invitations ON team_invitations;
CREATE TRIGGER set_updated_at_team_invitations
  BEFORE UPDATE ON team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
