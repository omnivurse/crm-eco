-- ============================================================================
-- Members CSV Gap Fill — Add all missing CSV-mapped columns (ADDITIVE ONLY)
-- Zero existing columns or data deleted
-- ============================================================================

-- Contact extensions & additional phones
ALTER TABLE members ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone_ext text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone2 text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone2_ext text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone3 text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone3_ext text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS fax text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS fax_ext text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS email2 text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS email3 text;

-- SSN (full, encrypted at application layer)
ALTER TABLE members ADD COLUMN IF NOT EXISTS ssn_encrypted text;

-- Identity / documents
ALTER TABLE members ADD COLUMN IF NOT EXISTS drivers_license text;

-- Employment / business
ALTER TABLE members ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS "position" text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS division text;

-- System cross-references
ALTER TABLE members ADD COLUMN IF NOT EXISTS external_username text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS internal_id text;

-- Acquisition
ALTER TABLE members ADD COLUMN IF NOT EXISTS referral text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS source text;

-- Classification
ALTER TABLE members ADD COLUMN IF NOT EXISTS member_type text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS member_type2 text;

-- Communication preferences
ALTER TABLE members ADD COLUMN IF NOT EXISTS do_not_call boolean DEFAULT false;

-- Demographics
ALTER TABLE members ADD COLUMN IF NOT EXISTS ethnicity text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS height text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS weight text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS disability text;

-- Sales pipeline / CRM tracking
ALTER TABLE members ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS number_of_calls integer DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS call_status text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS best_call_time text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS next_step text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS next_step_date date;
ALTER TABLE members ADD COLUMN IF NOT EXISTS source_only text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS probability integer;

NOTIFY pgrst, 'reload schema';
