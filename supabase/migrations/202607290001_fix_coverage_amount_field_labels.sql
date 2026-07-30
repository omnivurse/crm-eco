-- Idempotent label repair: never show two "Monthly Premium" amount fields
-- on the same person module (leads / contacts / members).
--
-- Root cause: legacy Zoho `monthly_premium` and dedicated
-- `health_insurance_premium` / `insurance_premium` were both labeled
-- "Monthly Premium". Client terminology wants Premium + Contribution.
--
-- Rollback: restore prior labels from backup / re-seed if needed.
--   UPDATE crm_fields SET label = 'Monthly Premium' WHERE key = 'monthly_premium';
-- This migration only changes labels (no data/JSONB mutations).

SET lock_timeout = '5s';

-- 1) Dedicated insurance premium keys → Monthly Premium
UPDATE crm_fields f
SET label = 'Monthly Premium',
    updated_at = now()
FROM crm_modules m
WHERE f.module_id = m.id
  AND m.key IN ('leads', 'contacts', 'members')
  AND f.key IN ('health_insurance_premium', 'insurance_premium')
  AND lower(trim(f.label)) IS DISTINCT FROM 'monthly premium';

-- 2) Dedicated contribution keys must never say Monthly Premium
UPDATE crm_fields f
SET label = 'Monthly Contribution',
    updated_at = now()
FROM crm_modules m
WHERE f.module_id = m.id
  AND m.key IN ('leads', 'contacts', 'members')
  AND f.key IN ('monthly_contribution', 'monthly_share', 'share_amount')
  AND lower(trim(f.label)) = 'monthly premium';

-- 3) When a dedicated premium exists on the same module, monthly_premium is
--    the contribution slot (phase-2 terminology + client request).
UPDATE crm_fields f
SET label = 'Monthly Contribution',
    updated_at = now()
FROM crm_modules m
WHERE f.module_id = m.id
  AND m.key IN ('leads', 'contacts', 'members')
  AND f.key = 'monthly_premium'
  AND lower(trim(f.label)) IN ('monthly premium', 'monthlypremium')
  AND EXISTS (
    SELECT 1
    FROM crm_fields f2
    WHERE f2.module_id = f.module_id
      AND f2.key IN ('health_insurance_premium', 'insurance_premium')
  );
