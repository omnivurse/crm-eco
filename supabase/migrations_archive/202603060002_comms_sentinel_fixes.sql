-- =============================================================================
-- Comms Sentinel Audit Fixes
-- Fixes race condition in accept_team_invitation (FOR UPDATE row lock)
-- =============================================================================

CREATE OR REPLACE FUNCTION accept_team_invitation(
  p_token text,
  p_full_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Get and validate invitation with row-level lock to prevent race conditions
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now()
  FOR UPDATE SKIP LOCKED;

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

  -- Mark invitation as accepted FIRST to prevent race condition
  UPDATE team_invitations
  SET
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  WHERE id = v_invitation.id
    AND status = 'pending';

  -- Verify the update happened (another transaction didn't beat us)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation was already accepted';
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

  -- Update invitation with profile reference
  UPDATE team_invitations
  SET accepted_by = v_profile_id
  WHERE id = v_invitation.id;

  RETURN v_profile_id;
END;
$$;
