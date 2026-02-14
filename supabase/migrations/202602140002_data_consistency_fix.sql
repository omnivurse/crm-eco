-- One-time data consistency fix: copy email/phone from system columns into data JSONB
-- This ensures both code paths (system columns and data JSONB) return correct values

UPDATE crm_records
SET data = data
  || CASE WHEN email IS NOT NULL AND (data->>'email') IS NULL
     THEN jsonb_build_object('email', email) ELSE '{}'::jsonb END
  || CASE WHEN phone IS NOT NULL AND (data->>'phone') IS NULL
     THEN jsonb_build_object('phone', phone) ELSE '{}'::jsonb END
WHERE email IS NOT NULL OR phone IS NOT NULL;
