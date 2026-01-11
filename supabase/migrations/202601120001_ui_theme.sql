-- ============================================================================
-- CRM-ECO: UI Theme Preference
-- Adds ui_theme column to profiles for theme persistence
-- ============================================================================

-- Add ui_theme column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ui_theme text 
  DEFAULT 'light'
  CHECK (ui_theme IS NULL OR ui_theme IN ('light', 'dark', 'system'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_ui_theme ON profiles(ui_theme);

-- Comment for documentation
COMMENT ON COLUMN profiles.ui_theme IS 'User theme preference: light (default), dark, or system';
