-- Fix: Salutation dropdown shows no options
-- The 202602140001_all_fields_fix migration inserted salutation as type 'select'
-- without setting options, causing ON CONFLICT to wipe previously seeded values.

UPDATE crm_fields
SET options = '["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."]'::jsonb
WHERE key = 'salutation'
  AND type = 'select'
  AND (options IS NULL OR options = '[]'::jsonb);
