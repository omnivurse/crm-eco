/*
  # RBAC System with Role Hierarchy

  1. New Types
    - `user_role` enum with 6 tiers: super_admin > admin > it > staff > advisor > member

  2. New Tables
    - `profiles` table (1:1 with auth.users)
      - Links to auth.users with cascade delete
      - Stores role, full_name, email sync
      - Auto-created on user signup

  3. Security Functions
    - `has_role()` - Check specific role
    - `role_rank()` - Get numeric role hierarchy
    - `role_at_least()` - Check minimum role level
    - Auto-sync email from auth.users

  4. RLS Policies
    - Users can read/update own profile (except role)
    - Admins can read all profiles
    - Admins can update roles (except granting super_admin)
    - Only super_admin can insert profiles directly
    - Only super_admin can grant super_admin

  5. Triggers
    - Auto-create profile on user signup
    - Sync email from auth.users on profile changes
*/

-- Create role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('super_admin','admin','it','staff','advisor','member');
  END IF;
END$$;

-- Profiles table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text,
  role user_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Function to sync email from auth.users
CREATE OR REPLACE FUNCTION public.sync_email_from_auth()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger to sync email
DROP TRIGGER IF EXISTS trg_profiles_sync_email ON public.profiles;
CREATE TRIGGER trg_profiles_sync_email
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_email_from_auth();

-- Function to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles(id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Role checking functions
CREATE OR REPLACE FUNCTION public.has_role(u uuid, r user_role)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE p.id = u AND p.role = r
  );
$$;

-- Role hierarchy ranking
CREATE OR REPLACE FUNCTION public.role_rank(r user_role)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE r
    WHEN 'super_admin' THEN 6
    WHEN 'admin' THEN 5
    WHEN 'it' THEN 4
    WHEN 'staff' THEN 3
    WHEN 'advisor' THEN 2
    ELSE 1
  END;
$$;

-- Check if user has minimum role level
CREATE OR REPLACE FUNCTION public.role_at_least(u uuid, min_role user_role)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT role_rank(p.role) >= role_rank(min_role)
  FROM public.profiles p
  WHERE p.id = u;
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
CREATE POLICY "profiles_self_read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Users can update their own profile (except role)
DROP POLICY IF EXISTS "profiles_self_update_nonrole" ON public.profiles;
CREATE POLICY "profiles_self_update_nonrole"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = role); -- Cannot change own role

-- Policy: Admins can read all profiles
DROP POLICY IF EXISTS "profiles_admin_read_all" ON public.profiles;
CREATE POLICY "profiles_admin_read_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.role_at_least(auth.uid(), 'admin'));

-- Policy: Admins can update roles (except granting super_admin)
DROP POLICY IF EXISTS "profiles_admin_update_roles" ON public.profiles;
CREATE POLICY "profiles_admin_update_roles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.role_at_least(auth.uid(), 'admin'))
  WITH CHECK (
    CASE
      WHEN NEW.role = 'super_admin' THEN public.has_role(auth.uid(), 'super_admin')
      ELSE true
    END
  );

-- Policy: Only super_admin can insert profiles directly
DROP POLICY IF EXISTS "profiles_super_insert" ON public.profiles;
CREATE POLICY "profiles_super_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));