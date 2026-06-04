-- ============================================================================
-- Dependents & Enrollment Dependents CSV Gap Fill (ADDITIVE ONLY)
-- Zero existing columns or data deleted
-- ============================================================================

-- Dependents: student status
ALTER TABLE dependents ADD COLUMN IF NOT EXISTS is_student boolean DEFAULT false;

-- Dependents: external system reference ID
ALTER TABLE dependents ADD COLUMN IF NOT EXISTS external_dependent_id text;

-- Enrollment Dependents: per-dependent product fee from CSV
ALTER TABLE enrollment_dependents ADD COLUMN IF NOT EXISTS dependent_product_fee numeric(10,2);

NOTIFY pgrst, 'reload schema';
