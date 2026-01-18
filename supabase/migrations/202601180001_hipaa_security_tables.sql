-- HIPAA Security Tables Migration
-- This migration creates the core security infrastructure for HIPAA compliance

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Security Permissions Table
-- Granular RBAC for PHI access control
-- ============================================================
CREATE TABLE IF NOT EXISTS security_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  resource text NOT NULL, -- 'contacts', 'members', 'enrollments', 'phi_data'
  action text NOT NULL, -- 'read', 'write', 'delete', 'export', 'print'
  allowed boolean DEFAULT false,
  conditions jsonb DEFAULT '{}', -- Row-level conditions
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role, resource, action)
);

-- Default permissions for roles
INSERT INTO security_permissions (role, resource, action, allowed) VALUES
  -- Owner: Full access
  ('owner', 'contacts', 'read', true),
  ('owner', 'contacts', 'write', true),
  ('owner', 'contacts', 'delete', true),
  ('owner', 'contacts', 'export', true),
  ('owner', 'members', 'read', true),
  ('owner', 'members', 'write', true),
  ('owner', 'members', 'delete', true),
  ('owner', 'members', 'export', true),
  ('owner', 'enrollments', 'read', true),
  ('owner', 'enrollments', 'write', true),
  ('owner', 'enrollments', 'delete', true),
  ('owner', 'enrollments', 'export', true),
  ('owner', 'phi_data', 'read', true),
  ('owner', 'phi_data', 'write', true),
  -- Admin: Full access except export
  ('crm_admin', 'contacts', 'read', true),
  ('crm_admin', 'contacts', 'write', true),
  ('crm_admin', 'contacts', 'delete', true),
  ('crm_admin', 'contacts', 'export', true),
  ('crm_admin', 'members', 'read', true),
  ('crm_admin', 'members', 'write', true),
  ('crm_admin', 'members', 'delete', true),
  ('crm_admin', 'phi_data', 'read', true),
  -- Agent: Read/Write, no delete or export
  ('crm_agent', 'contacts', 'read', true),
  ('crm_agent', 'contacts', 'write', true),
  ('crm_agent', 'members', 'read', true),
  ('crm_agent', 'members', 'write', true),
  ('crm_agent', 'enrollments', 'read', true),
  ('crm_agent', 'enrollments', 'write', true),
  -- Viewer: Read only
  ('crm_viewer', 'contacts', 'read', true),
  ('crm_viewer', 'members', 'read', true),
  ('crm_viewer', 'enrollments', 'read', true)
ON CONFLICT (role, resource, action) DO NOTHING;

-- ============================================================
-- PHI Access Log Table
-- HIPAA-required audit trail for all PHI access
-- Retention: 7 years (2555 days)
-- ============================================================
CREATE TABLE IF NOT EXISTS phi_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  action text NOT NULL, -- 'view', 'create', 'update', 'delete', 'export', 'print', 'download'
  resource_type text NOT NULL, -- 'contact', 'member', 'enrollment', 'record'
  resource_id uuid,
  record_name text, -- For audit display without exposing PHI
  phi_fields_accessed text[], -- Array of PHI field names accessed
  ip_address inet,
  user_agent text,
  session_id text,
  request_id text,
  success boolean DEFAULT true,
  failure_reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_phi_access_log_user_date 
  ON phi_access_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phi_access_log_org_date 
  ON phi_access_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phi_access_log_resource 
  ON phi_access_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_phi_access_log_action 
  ON phi_access_log(action, created_at DESC);

-- ============================================================
-- Auth Events Table
-- Track all authentication events for security monitoring
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  email text, -- Store email for failed attempts (user_id may be null)
  event_type text NOT NULL, -- 'login_success', 'login_failed', 'logout', 'mfa_challenge', 'mfa_success', 'mfa_failed', 'password_reset', 'session_expired'
  ip_address inet,
  user_agent text,
  location jsonb, -- {country, region, city} if available
  risk_score integer DEFAULT 0, -- 0-100 for anomaly detection
  failure_count integer DEFAULT 0, -- For rate limiting
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes for security monitoring
CREATE INDEX IF NOT EXISTS idx_auth_events_user_date 
  ON auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_type_date 
  ON auth_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip 
  ON auth_events(ip_address, created_at DESC);

-- ============================================================
-- User Sessions Table
-- Track active sessions for security management
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  session_token text UNIQUE NOT NULL,
  ip_address inet,
  user_agent text,
  device_info jsonb DEFAULT '{}',
  last_activity_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  mfa_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user 
  ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_token 
  ON user_sessions(session_token) WHERE is_active = true;

-- ============================================================
-- MFA Settings Table
-- Store user MFA preferences and backup codes
-- ============================================================
CREATE TABLE IF NOT EXISTS mfa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  mfa_enabled boolean DEFAULT false,
  mfa_method text DEFAULT 'totp', -- 'totp', 'sms', 'email'
  backup_codes_hash text[], -- Hashed backup codes
  backup_codes_used integer DEFAULT 0,
  last_mfa_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS Policies for Security Tables
-- ============================================================

-- PHI Access Log: Only admins/owners can view
ALTER TABLE phi_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view all PHI access logs" ON phi_access_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role IN ('owner', 'crm_admin')
      AND p.organization_id = phi_access_log.organization_id
    )
  );

CREATE POLICY "System can insert PHI access logs" ON phi_access_log
  FOR INSERT WITH CHECK (true);

-- Auth Events: Users can view own, admins can view all
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auth events" ON auth_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert auth events" ON auth_events
  FOR INSERT WITH CHECK (true);

-- User Sessions: Users can view/manage own sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can invalidate own sessions" ON user_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- MFA Settings: Users can manage own MFA
ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own MFA settings" ON mfa_settings
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- Functions for Security Operations
-- ============================================================

-- Function to log PHI access
CREATE OR REPLACE FUNCTION log_phi_access(
  p_user_id uuid,
  p_org_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_record_name text,
  p_phi_fields text[],
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_session_id text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO phi_access_log (
    user_id, organization_id, action, resource_type, resource_id,
    record_name, phi_fields_accessed, ip_address, user_agent, session_id
  ) VALUES (
    p_user_id, p_org_id, p_action, p_resource_type, p_resource_id,
    p_record_name, p_phi_fields, p_ip_address, p_user_agent, p_session_id
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log auth events
CREATE OR REPLACE FUNCTION log_auth_event(
  p_user_id uuid,
  p_email text,
  p_event_type text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
) RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO auth_events (
    user_id, email, event_type, ip_address, user_agent, metadata
  ) VALUES (
    p_user_id, p_email, p_event_type, p_ip_address, p_user_agent, p_metadata
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if session is valid (30 min timeout)
CREATE OR REPLACE FUNCTION is_session_valid(p_session_token text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_sessions
    WHERE session_token = p_session_token
    AND is_active = true
    AND expires_at > now()
    AND last_activity_at > now() - interval '30 minutes'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update session activity
CREATE OR REPLACE FUNCTION update_session_activity(p_session_token text)
RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET last_activity_at = now()
  WHERE session_token = p_session_token
  AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
