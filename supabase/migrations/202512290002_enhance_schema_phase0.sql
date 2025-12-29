-- CRM-ECO Phase 0 Schema Enhancement
-- Adds additional fields specified in the Phase 0 requirements

-- ============================================================================
-- PROFILES - Add missing fields
-- ============================================================================
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS time_zone text DEFAULT 'America/New_York';

-- Update display_name from full_name for existing records
UPDATE profiles SET display_name = full_name WHERE display_name IS NULL;

-- ============================================================================
-- ADVISORS - Add missing fields
-- ============================================================================
ALTER TABLE advisors
  ADD COLUMN IF NOT EXISTS advisor_code text,
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS npn text,
  ADD COLUMN IF NOT EXISTS contract_date date,
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS primary_channel text,
  ADD COLUMN IF NOT EXISTS comp_level text;

-- Create index for advisor_code
CREATE INDEX IF NOT EXISTS idx_advisors_advisor_code ON advisors(advisor_code);
CREATE INDEX IF NOT EXISTS idx_advisors_agency_name ON advisors(agency_name);

-- ============================================================================
-- MEMBERS - Add missing fields
-- ============================================================================
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS member_number text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS household_id uuid,
  ADD COLUMN IF NOT EXISTS household_role text,
  ADD COLUMN IF NOT EXISTS coverage_type text,
  ADD COLUMN IF NOT EXISTS program_type text,
  ADD COLUMN IF NOT EXISTS renewal_month integer,
  ADD COLUMN IF NOT EXISTS termination_reason text,
  ADD COLUMN IF NOT EXISTS communication_preferences jsonb DEFAULT '{}'::jsonb;

-- Rename zip_code to postal_code for consistency (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'zip_code') THEN
    ALTER TABLE members RENAME COLUMN zip_code TO postal_code;
  END IF;
END $$;

-- Update status check constraint to match spec
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check 
  CHECK (status IN ('prospect', 'pending', 'active', 'paused', 'terminated', 'inactive'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_members_member_number ON members(member_number);
CREATE INDEX IF NOT EXISTS idx_members_household_id ON members(household_id);
CREATE INDEX IF NOT EXISTS idx_members_program_type ON members(program_type);

-- ============================================================================
-- LEADS - Add missing fields
-- ============================================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS campaign text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS household_size integer,
  ADD COLUMN IF NOT EXISTS desired_start_date date,
  ADD COLUMN IF NOT EXISTS current_coverage text;

-- Update status check constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check 
  CHECK (status IN ('new', 'contacted', 'working', 'qualified', 'unqualified', 'converted', 'lost'));

CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign);

-- ============================================================================
-- ACTIVITIES - Restructure for Phase 0
-- ============================================================================
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS created_by_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS via text,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

-- Migrate profile_id to created_by_profile_id
UPDATE activities SET created_by_profile_id = profile_id WHERE created_by_profile_id IS NULL AND profile_id IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activities_created_by_profile_id ON activities(created_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_activities_advisor_id ON activities(advisor_id);
CREATE INDEX IF NOT EXISTS idx_activities_member_id ON activities(member_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_occurred_at ON activities(occurred_at DESC);

-- ============================================================================
-- NEEDS - Add missing fields
-- ============================================================================
ALTER TABLE needs
  ADD COLUMN IF NOT EXISTS incident_date date,
  ADD COLUMN IF NOT EXISTS reimbursement_method text,
  ADD COLUMN IF NOT EXISTS reimbursement_account_last4 text;

-- Update status check constraint
ALTER TABLE needs DROP CONSTRAINT IF EXISTS needs_status_check;
ALTER TABLE needs ADD CONSTRAINT needs_status_check 
  CHECK (status IN ('open', 'in_review', 'processing', 'paid', 'closed'));

-- ============================================================================
-- NEED_EVENTS - Add missing fields
-- ============================================================================
ALTER TABLE need_events
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS old_status text,
  ADD COLUMN IF NOT EXISTS new_status text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz DEFAULT now();

-- Populate organization_id from needs table
UPDATE need_events ne 
SET organization_id = n.organization_id 
FROM needs n 
WHERE ne.need_id = n.id AND ne.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_need_events_organization_id ON need_events(organization_id);

-- ============================================================================
-- CUSTOM_FIELD_DEFINITIONS - Add missing fields
-- ============================================================================
ALTER TABLE custom_field_definitions
  ADD COLUMN IF NOT EXISTS field_key text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_filterable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;

-- Populate field_key from field_name
UPDATE custom_field_definitions SET field_key = field_name WHERE field_key IS NULL;

-- Update entity_type check constraint
ALTER TABLE custom_field_definitions DROP CONSTRAINT IF EXISTS custom_field_definitions_entity_type_check;
ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_definitions_entity_type_check 
  CHECK (entity_type IN ('advisor', 'member', 'lead', 'need', 'ticket'));

-- Update field_type check constraint  
ALTER TABLE custom_field_definitions DROP CONSTRAINT IF EXISTS custom_field_definitions_field_type_check;
ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_definitions_field_type_check 
  CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'json'));

-- ============================================================================
-- PROFILE BOOTSTRAP TRIGGER
-- ============================================================================
-- This function creates a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Get the default organization (first one created)
  SELECT id INTO default_org_id FROM organizations ORDER BY created_at LIMIT 1;
  
  -- If no organization exists, create a default one
  IF default_org_id IS NULL THEN
    INSERT INTO organizations (name, slug) 
    VALUES ('Default Organization', 'default')
    RETURNING id INTO default_org_id;
  END IF;
  
  -- Create profile for new user
  INSERT INTO profiles (user_id, organization_id, email, full_name, display_name, role)
  VALUES (
    NEW.id,
    default_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'staff'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- NEED_EVENTS RLS - Add organization scoping
-- ============================================================================
DROP POLICY IF EXISTS "Users can view need events" ON need_events;
DROP POLICY IF EXISTS "Users can create need events" ON need_events;

CREATE POLICY "Users can view need events"
  ON need_events FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create need events"
  ON need_events FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

