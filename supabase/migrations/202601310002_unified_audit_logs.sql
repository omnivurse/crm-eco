-- Enterprise Audit Logging System
-- Tamper-proof hash-chained audit logs for CRM and Admin Portal
-- Created: 2026-01-31

-- ============================================================================
-- TABLE: unified_audit_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.unified_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Hash chain for tamper-proof logging
  sequence_number bigserial UNIQUE NOT NULL,
  previous_hash text,
  entry_hash text NOT NULL,

  -- Multi-tenant scoping
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- App source identification
  app_source text NOT NULL CHECK (app_source IN ('crm', 'admin', 'portal', 'system')),

  -- Actor information (denormalized for audit trail persistence)
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role text,
  actor_email text,

  -- Target information
  target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  target_entity_type text,
  target_entity_id text,

  -- Action details
  action text NOT NULL,
  action_category text NOT NULL CHECK (action_category IN (
    'authentication', 'authorization', 'data_access', 'data_modification',
    'data_deletion', 'data_export', 'configuration', 'integration', 'system'
  )),
  description text,

  -- Risk classification
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Request context
  ip_address inet,
  user_agent text,
  request_id text,
  session_id text,

  -- Detailed payload
  details jsonb DEFAULT '{}'::jsonb,
  changes jsonb DEFAULT '{}'::jsonb,

  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE public.unified_audit_logs IS 'Enterprise audit logging with tamper-proof hash chain';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_org_created
  ON public.unified_audit_logs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_actor
  ON public.unified_audit_logs(actor_id) WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_target_user
  ON public.unified_audit_logs(target_user_id) WHERE target_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_target_entity
  ON public.unified_audit_logs(target_entity_type, target_entity_id);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_action
  ON public.unified_audit_logs(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_risk_level
  ON public.unified_audit_logs(risk_level, created_at DESC)
  WHERE risk_level IN ('high', 'critical');

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_app_source
  ON public.unified_audit_logs(app_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_sequence
  ON public.unified_audit_logs(sequence_number);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_action_category
  ON public.unified_audit_logs(action_category, created_at DESC);

-- ============================================================================
-- HASH CHAIN FUNCTIONS
-- ============================================================================

-- Function to compute SHA-256 hash of audit entry
CREATE OR REPLACE FUNCTION compute_audit_entry_hash(
  p_sequence_number bigint,
  p_previous_hash text,
  p_organization_id uuid,
  p_app_source text,
  p_actor_id uuid,
  p_action text,
  p_target_entity_type text,
  p_target_entity_id text,
  p_details jsonb,
  p_created_at timestamptz
)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT encode(
    sha256(
      convert_to(
        COALESCE(p_sequence_number::text, '') || '|' ||
        COALESCE(p_previous_hash, 'GENESIS') || '|' ||
        COALESCE(p_organization_id::text, '') || '|' ||
        COALESCE(p_app_source, '') || '|' ||
        COALESCE(p_actor_id::text, '') || '|' ||
        COALESCE(p_action, '') || '|' ||
        COALESCE(p_target_entity_type, '') || '|' ||
        COALESCE(p_target_entity_id, '') || '|' ||
        COALESCE(p_details::text, '{}') || '|' ||
        COALESCE(p_created_at::text, ''),
        'UTF8'
      )
    ),
    'hex'
  );
$$;

-- Trigger function to compute hash chain on insert
CREATE OR REPLACE FUNCTION audit_log_hash_chain_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_hash text;
BEGIN
  -- Get the previous hash for this organization
  SELECT entry_hash INTO v_previous_hash
  FROM public.unified_audit_logs
  WHERE organization_id = NEW.organization_id
  ORDER BY sequence_number DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Set previous hash (NULL for first entry in org)
  NEW.previous_hash := v_previous_hash;

  -- Compute entry hash
  NEW.entry_hash := compute_audit_entry_hash(
    NEW.sequence_number,
    NEW.previous_hash,
    NEW.organization_id,
    NEW.app_source,
    NEW.actor_id,
    NEW.action,
    NEW.target_entity_type,
    NEW.target_entity_id,
    NEW.details,
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_audit_log_hash_chain ON public.unified_audit_logs;
CREATE TRIGGER trg_audit_log_hash_chain
BEFORE INSERT ON public.unified_audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_log_hash_chain_trigger();

-- ============================================================================
-- VERIFICATION FUNCTION
-- ============================================================================

-- Function to verify hash chain integrity for an organization
CREATE OR REPLACE FUNCTION verify_audit_chain(
  p_organization_id uuid,
  p_from_sequence bigint DEFAULT 1,
  p_to_sequence bigint DEFAULT NULL
)
RETURNS TABLE (
  sequence_number bigint,
  is_valid boolean,
  expected_hash text,
  actual_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log RECORD;
  v_prev_hash text := NULL;
  v_computed_hash text;
BEGIN
  FOR v_log IN
    SELECT *
    FROM unified_audit_logs
    WHERE organization_id = p_organization_id
      AND unified_audit_logs.sequence_number >= p_from_sequence
      AND (p_to_sequence IS NULL OR unified_audit_logs.sequence_number <= p_to_sequence)
    ORDER BY unified_audit_logs.sequence_number ASC
  LOOP
    -- Compute expected hash
    v_computed_hash := compute_audit_entry_hash(
      v_log.sequence_number,
      v_prev_hash,
      v_log.organization_id,
      v_log.app_source,
      v_log.actor_id,
      v_log.action,
      v_log.target_entity_type,
      v_log.target_entity_id,
      v_log.details,
      v_log.created_at
    );

    -- Return verification result
    sequence_number := v_log.sequence_number;
    is_valid := (v_log.entry_hash = v_computed_hash) AND
                (v_log.previous_hash IS NOT DISTINCT FROM v_prev_hash);
    expected_hash := v_computed_hash;
    actual_hash := v_log.entry_hash;
    RETURN NEXT;

    -- Update previous hash for next iteration
    v_prev_hash := v_log.entry_hash;
  END LOOP;
END;
$$;

-- ============================================================================
-- LOGGING RPC FUNCTION
-- ============================================================================

-- Main logging function used by TypeScript utility
CREATE OR REPLACE FUNCTION log_audit_event(
  p_app_source text,
  p_action text,
  p_action_category text,
  p_risk_level text DEFAULT 'low',
  p_target_entity_type text DEFAULT NULL,
  p_target_entity_id text DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_details jsonb DEFAULT '{}',
  p_changes jsonb DEFAULT '{}',
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
  v_org_id uuid;
  v_actor_id uuid;
  v_actor_role text;
  v_actor_email text;
BEGIN
  -- Get current user's profile
  SELECT
    p.organization_id,
    p.id,
    COALESCE(p.crm_role, p.role),
    p.email
  INTO v_org_id, v_actor_id, v_actor_role, v_actor_email
  FROM profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  -- Allow system events without authenticated user
  IF v_org_id IS NULL AND p_app_source != 'system' THEN
    RAISE EXCEPTION 'Organization context required for non-system events';
  END IF;

  INSERT INTO unified_audit_logs (
    organization_id,
    app_source,
    actor_id,
    actor_role,
    actor_email,
    target_user_id,
    target_entity_type,
    target_entity_id,
    action,
    action_category,
    description,
    risk_level,
    ip_address,
    user_agent,
    request_id,
    session_id,
    details,
    changes
  ) VALUES (
    COALESCE(v_org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_app_source,
    v_actor_id,
    v_actor_role,
    v_actor_email,
    p_target_user_id,
    p_target_entity_type,
    p_target_entity_id,
    p_action,
    p_action_category,
    p_description,
    p_risk_level,
    p_ip_address,
    p_user_agent,
    p_request_id,
    p_session_id,
    p_details,
    p_changes
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.unified_audit_logs ENABLE ROW LEVEL SECURITY;

-- CRM admins can view logs in their organization
CREATE POLICY "crm_admin_view_audit_logs"
ON public.unified_audit_logs FOR SELECT
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND crm_role IN ('crm_admin')
  )
);

-- CRM managers can view logs in their organization
CREATE POLICY "crm_manager_view_audit_logs"
ON public.unified_audit_logs FOR SELECT
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND crm_role IN ('crm_manager')
  )
);

-- Admin portal owners/admins can view logs
CREATE POLICY "admin_portal_view_audit_logs"
ON public.unified_audit_logs FOR SELECT
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- Super admins can view all logs
CREATE POLICY "super_admin_view_all_audit_logs"
ON public.unified_audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND is_super_admin = true
  )
);

-- Authenticated users can insert via RPC function
CREATE POLICY "authenticated_insert_audit_logs"
ON public.unified_audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Service role has full access for server-side operations
CREATE POLICY "service_role_full_access"
ON public.unified_audit_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event TO service_role;
GRANT EXECUTE ON FUNCTION verify_audit_chain TO authenticated;
GRANT EXECUTE ON FUNCTION compute_audit_entry_hash TO authenticated;

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE unified_audit_logs;
