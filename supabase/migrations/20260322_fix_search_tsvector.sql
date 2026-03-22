-- Fix CRM search tsvector to include spouse/child names and support full-name searching
-- The existing GENERATED ALWAYS column only indexes: title, first_name, last_name, email, phone
-- This migration expands it to also index family member data and concatenated full name

-- Drop the existing generated column
ALTER TABLE crm_records DROP COLUMN IF EXISTS search;

-- Recreate as a generated column with family member data and full-name concatenation
ALTER TABLE crm_records ADD COLUMN search tsvector GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(data->>'first_name', '') || ' ' ||
    coalesce(data->>'last_name', '') || ' ' ||
    coalesce(data->>'first_name', '') || ' ' || coalesce(data->>'last_name', '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(data->>'spouse', '') || ' ' ||
    coalesce(data->>'spouse_phone_number', '') || ' ' ||
    coalesce(data->>'spouse_email', '') || ' ' ||
    coalesce(data->>'child_1', '') || ' ' ||
    coalesce(data->>'child_2', '') || ' ' ||
    coalesce(data->>'child_3', '') || ' ' ||
    coalesce(data->>'child_4', '') || ' ' ||
    coalesce(data->>'child_5', '') || ' ' ||
    coalesce(data->>'contact_name', '')
  )
) STORED;

-- Recreate the GIN index
DROP INDEX IF EXISTS idx_crm_records_search;
CREATE INDEX idx_crm_records_search ON crm_records USING gin(search);
