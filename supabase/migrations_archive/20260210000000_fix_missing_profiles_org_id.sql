/*
  # Fix Missing Profiles Organization ID

  1. Changes
    - Add `organization_id` column to `profiles` table if it doesn't exist
    - Add foreign key reference to `organizations` table
    - Add index for performance

  2. Rationale
    - The column appeared to be missing in generated types, likely due to suppressed errors in previous migrations or missing definition.
    - Required for app functionality.
*/

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'organization_id' AND table_schema = 'public') THEN
    ALTER TABLE profiles ADD COLUMN organization_id uuid REFERENCES organizations(id);
    CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
  END IF;
END $$;
