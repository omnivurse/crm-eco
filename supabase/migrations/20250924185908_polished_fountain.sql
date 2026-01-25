/*
  # Audit Logs and SSO Group Role Mapping

  1. New Tables
    - `audit_logs` - Track all administrative actions with actor, target, and details
    - `sso_group_roles` - Map SSO groups to application roles for automatic role assignment

  2. Security
    - Enable RLS on both tables
    - Admin+ can read audit logs
    - No direct client writes to audit logs (triggers and edge functions only)
    - Admin+ can manage SSO group mappings

  3. Functions
    - `log_profile_role_change()` - Trigger to auto-log role changes
    - `map_role_from_groups()` - Map SSO groups to highest applicable role
    - `apply_role_from_groups()` - Apply role based on SSO groups

  4. Triggers
    - Auto-audit role changes on profiles table
*/

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,                         -- who performed the action
  target_user_id uuid,                   -- target profile/user affected
  action text NOT NULL,                  -- e.g., update_role, create_user
  details jsonb DEFAULT '{}'::jsonb,     -- {from_role,to_role,email,...}
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SSO group to role mapping table
CREATE TABLE IF NOT EXISTS public.sso_group_roles (
  group_name text PRIMARY KEY,
  role user_role NOT NULL
);

ALTER TABLE public.sso_group_roles ENABLE ROW LEVEL SECURITY;

-- Audit logs policies
DROP POLICY IF EXISTS "audit_admin_read_all" ON public.audit_logs;
CREATE POLICY "audit_admin_read_all"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.role_at_least(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "audit_no_client_insert" ON public.audit_logs;
CREATE POLICY "audit_no_client_insert"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "audit_no_client_update" ON public.audit_logs;
CREATE POLICY "audit_no_client_update"
ON public.audit_logs FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- SSO group roles policies
DROP POLICY IF EXISTS "sso_map_admin_read" ON public.sso_group_roles;
CREATE POLICY "sso_map_admin_read"
ON public.sso_group_roles FOR SELECT
TO authenticated
USING (public.role_at_least(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sso_map_admin_write" ON public.sso_group_roles;
CREATE POLICY "sso_map_admin_write"
ON public.sso_group_roles FOR ALL
TO authenticated
USING (public.role_at_least(auth.uid(), 'admin'))
WITH CHECK (public.role_at_least(auth.uid(), 'admin'));

-- Function: Log profile role changes
CREATE OR REPLACE FUNCTION public.log_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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
          'to_role', new_role
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Function: Map role from SSO groups (pick highest)
CREATE OR REPLACE FUNCTION public.map_role_from_groups(groups text[])
RETURNS user_role LANGUAGE sql STABLE AS $$
  WITH mapped AS (
    SELECT role FROM public.sso_group_roles
    WHERE group_name = ANY(groups)
  )
  SELECT COALESCE((
    SELECT role FROM mapped
    ORDER BY public.role_rank(role) DESC
    LIMIT 1
  ), 'member');
$$;

-- Function: Apply role based on SSO groups
CREATE OR REPLACE FUNCTION public.apply_role_from_groups(u uuid, groups text[])
RETURNS user_role LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_role user_role;
BEGIN
  new_role := public.map_role_from_groups(groups);
  UPDATE public.profiles
     SET role = new_role,
         updated_at = now()
   WHERE id = u;
  RETURN new_role;
END;
$$;

-- Trigger: Auto-audit role changes
DROP TRIGGER IF EXISTS trg_profiles_role_audit ON public.profiles;
CREATE TRIGGER trg_profiles_role_audit
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_role_change();

-- Insert default SSO group mappings
INSERT INTO public.sso_group_roles (group_name, role) VALUES
  ('IT-Admins', 'admin'),
  ('IT-Engineers', 'it'),
  ('Staff', 'staff'),
  ('Advisors', 'advisor'),
  ('Members', 'member')
ON CONFLICT (group_name) DO NOTHING;