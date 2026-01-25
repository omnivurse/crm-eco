/*
  # Add Theme Preference Column

  ## Changes
  - Add `theme_preference` column to profiles table
    - Type: text with constraint for 'light' or 'dark'
    - Default value: 'light'
    - Allows users to persist their theme preference across devices

  ## Implementation Notes
  - This migration adds a simple text column to store user theme preference
  - The column is optional and defaults to 'light' mode
  - Theme preference will be synced automatically by the ThemeProvider
*/

DO $$
BEGIN
  -- Add theme_preference column to profiles if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN theme_preference text DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark'));
  END IF;
END $$;
