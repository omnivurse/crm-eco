-- Fix handle_new_user trigger to be more fault-tolerant
-- This trigger auto-creates a profile when a new user signs up

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create improved trigger function that handles errors gracefully
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Try to get the system-admin organization first, then fall back to any org
  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE slug = 'system-admin'
  LIMIT 1;

  -- If no system-admin org, try to get any org
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id
    FROM public.organizations
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- If still no organization exists, create a default one
  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug)
    VALUES ('Default Organization', 'default')
    RETURNING id INTO default_org_id;
  END IF;

  -- Create profile for new user (with error handling)
  BEGIN
    INSERT INTO public.profiles (
      user_id,
      organization_id,
      email,
      full_name,
      display_name,
      role,
      is_active
    )
    VALUES (
      NEW.id,
      default_org_id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'staff',
      true
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail - profile can be created later
    RAISE WARNING 'Could not auto-create profile for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure the trigger function has proper permissions
GRANT EXECUTE ON FUNCTION handle_new_user() TO supabase_auth_admin;
