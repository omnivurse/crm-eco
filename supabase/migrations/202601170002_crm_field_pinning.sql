-- Migration: Add field pinning/starring feature
-- Description: Allows users to "pin" or "star" fields so they always show in 
--              list views and forms, regardless of default visibility settings.

-- Add is_pinned column to crm_fields
ALTER TABLE crm_fields
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN crm_fields.is_pinned IS 'When true, field is starred/pinned and will always appear in list views and forms';

-- Create index for efficient queries on pinned fields
CREATE INDEX IF NOT EXISTS idx_crm_fields_module_pinned 
ON crm_fields(module_id, is_pinned) 
WHERE is_pinned = true;

-- By default, pin required fields that are commonly displayed:
-- - title fields (like first_name, last_name, company_name)
-- - email fields
-- - phone fields
UPDATE crm_fields
SET is_pinned = true
WHERE is_title_field = true
   OR type IN ('email', 'phone')
   OR key IN ('first_name', 'last_name', 'company_name', 'email', 'phone', 'contact_name');
