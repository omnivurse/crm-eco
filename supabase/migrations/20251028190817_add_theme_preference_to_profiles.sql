/*
  # Add theme_preference Column to Profiles

  1. Issue
    - Code is trying to query profiles.theme_preference column
    - Column does not exist in profiles table
    - Error: "column profiles.theme_preference does not exist"
    
  2. Changes
    - Add theme_preference column to profiles table
    - Set default to 'system' (respects user's OS preference)
    - Allow NULL for backward compatibility
    
  3. Valid Values
    - 'light': Force light theme
    - 'dark': Force dark theme  
    - 'system': Follow OS preference (default)
*/

-- Add theme_preference column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'system';

-- Add check constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_theme_preference_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_theme_preference_check
    CHECK (theme_preference IN ('light', 'dark', 'system'));
  END IF;
END $$;

-- Log the change
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    INSERT INTO public.audit_logs (actor_id, action, details)
    VALUES (
      NULL,
      'add_theme_preference_column',
      jsonb_build_object(
        'timestamp', now(),
        'table', 'profiles',
        'column', 'theme_preference',
        'type', 'TEXT',
        'default', 'system',
        'valid_values', jsonb_build_array('light', 'dark', 'system')
      )
    );
  END IF;
END $$;
