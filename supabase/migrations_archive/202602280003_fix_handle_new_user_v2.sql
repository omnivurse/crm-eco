-- Fix handle_new_user trigger to properly handle profiles schema
-- profiles.id is auto-generated, profiles.user_id references auth.users
-- organization_id is required (NOT NULL)

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Get the system-admin organization first, then fall back to any org
  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE slug = 'system-admin'
  LIMIT 1;

  -- If no system-admin org, try default org
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id
    FROM public.organizations
    WHERE slug = 'default'
    LIMIT 1;
  END IF;

  -- If still no org, get any org
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id
    FROM public.organizations
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- If no org exists at all, create one
  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug)
    VALUES ('Default Organization', 'default')
    RETURNING id INTO default_org_id;
  END IF;

  -- Insert profile (id is auto-generated, user_id references auth.users)
  INSERT INTO public.profiles (
    user_id,
    organization_id,
    email,
    full_name,
    display_name,
    role,
    crm_role,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    default_org_id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    'staff',
    'crm_viewer',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, organization_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail - profile can be created later
  RAISE WARNING 'Could not auto-create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
