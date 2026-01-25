/*
  # Consolidate Audit Logs System

  ## Overview
  This migration consolidates the audit logging system by removing the obsolete
  `audit_log` table and ensuring only the properly structured `audit_logs` table
  exists with complete schema, indexes, and policies.

  ## Changes Made
  
  1. Tables
    - Drop obsolete `audit_log` table if it exists
    - Migrate any existing data from `audit_log` to `audit_logs`
    - Ensure `audit_logs` table has complete schema with all required columns
    
  2. Indexes
    - Add performance indexes on frequently queried columns:
      - `actor_id` for filtering by who performed actions
      - `target_user_id` for filtering by affected users
      - `action` for filtering by action type
      - `created_at` for time-based queries and sorting
    
  3. Security
    - Ensure RLS is enabled on `audit_logs`
    - Admin+ can read all audit logs
    - Service role can insert audit logs (for system actions)
    - No direct client writes allowed
    - No updates or deletes allowed (immutable audit trail)
    
  4. Functions
    - Create helper function for service role to insert audit logs
    - Update trigger function to use correct table name
    
  ## Important Notes
  - Audit logs are immutable - no updates or deletes allowed
  - All administrative actions should log to this table
  - IP and user_agent fields are optional but recommended for compliance
*/

-- Migrate any existing data from old audit_log table to audit_logs
DO $$
BEGIN
  -- Check if old audit_log table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_log'
  ) THEN
    -- Migrate data if audit_logs table exists and has compatible structure
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'audit_logs'
    ) THEN
      -- Insert records from audit_log that don't already exist in audit_logs
      INSERT INTO public.audit_logs (id, actor_id, target_user_id, action, details, created_at)
      SELECT 
        al.id,
        al.actor_id,
        NULL, -- old table used 'target' as text, can't map to uuid
        al.action,
        COALESCE(al.details, '{}'::jsonb),
        COALESCE(al.created_at, now())
      FROM audit_log al
      WHERE NOT EXISTS (
        SELECT 1 FROM public.audit_logs WHERE id = al.id
      )
      ON CONFLICT (id) DO NOTHING;
      
      RAISE NOTICE 'Migrated data from audit_log to audit_logs';
    END IF;
    
    -- Drop the old table
    DROP TABLE IF EXISTS public.audit_log CASCADE;
    RAISE NOTICE 'Dropped obsolete audit_log table';
  END IF;
END $$;

-- Ensure audit_logs table exists with complete schema
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,                         -- who performed the action (NULL for system)
  target_user_id uuid,                   -- target profile/user affected (NULL for non-user actions)
  action text NOT NULL,                  -- e.g., update_role, create_user, delete_ticket
  details jsonb DEFAULT '{}'::jsonb,     -- {from_role, to_role, email, ticket_id, ...}
  ip text,                               -- IP address of the actor
  user_agent text,                       -- User agent string of the actor
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON public.audit_logs(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_details ON public.audit_logs USING gin(details);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "audit_admin_read_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_no_client_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_no_client_update" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_no_client_delete" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_service_role_insert" ON public.audit_logs;

-- Admin+ can read all audit logs
CREATE POLICY "audit_admin_read_all"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- Service role can insert (for edge functions and system actions)
CREATE POLICY "audit_service_role_insert"
ON public.audit_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Authenticated users cannot insert directly (must use functions or service role)
CREATE POLICY "audit_no_client_insert"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (false);

-- No one can update audit logs (immutable)
CREATE POLICY "audit_no_client_update"
ON public.audit_logs FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- No one can delete audit logs (immutable)
CREATE POLICY "audit_no_client_delete"
ON public.audit_logs FOR DELETE
TO authenticated
USING (false);

-- Helper function for service role to insert audit logs
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    actor_id,
    target_user_id,
    action,
    details,
    ip,
    user_agent,
    created_at
  ) VALUES (
    p_actor_id,
    p_target_user_id,
    p_action,
    COALESCE(p_details, '{}'::jsonb),
    p_ip,
    p_user_agent,
    now()
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Update the role change trigger function to use audit_logs
CREATE OR REPLACE FUNCTION public.log_profile_role_change()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_role text;
  new_role text;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      old_role := OLD.role::text;
      new_role := NEW.role::text;
      
      INSERT INTO public.audit_logs(actor_id, target_user_id, action, details)
      VALUES (
        auth.uid(),
        NEW.id,
        'update_role',
        jsonb_build_object(
          'from_role', old_role,
          'to_role', new_role,
          'email', NEW.email,
          'changed_at', now()
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists on profiles table
DROP TRIGGER IF EXISTS trg_profiles_role_audit ON public.profiles;
CREATE TRIGGER trg_profiles_role_audit
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_role_change();

-- Grant necessary permissions
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_audit_log TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_audit_log TO authenticated;
