-- ============================================================================
-- Phase 1: Reunify split organization data
-- ============================================================================
-- Problem: 13,946 records are under org 00000000-0000-0000-0000-000000000001
-- (default/seed) instead of the real org ac6e7228-2ea0-4582-8464-562c3e8ac56e.
-- These records are invisible to users because API filters by org_id.
--
-- Strategy:
--   1. Remap 8 unique notes from default-org duplicates → real-org records
--   2. Move 480 orphaned records (no match in real org) to real org
--   3. Move 4 notes on orphaned records to real org
--   4. Delete duplicate records from default org (13,466 records)
--   5. Delete duplicate notes from default org
--   6. Clean up orphaned default-org modules
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Remap unique notes from default-org duplicates to real-org records
-- These are 8 notes that exist ONLY on the default org copy, not on the real copy
-- ============================================================================
UPDATE crm_notes n
SET
  record_id = real_rec.id,
  org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
FROM crm_records def_rec
JOIN crm_records real_rec ON def_rec.email = real_rec.email
  AND real_rec.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
  AND def_rec.email IS NOT NULL AND def_rec.email != ''
WHERE n.record_id = def_rec.id
  AND def_rec.org_id = '00000000-0000-0000-0000-000000000001'
  AND n.org_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM crm_notes n2
    JOIN crm_records b ON n2.record_id = b.id
    WHERE b.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
      AND b.email = def_rec.email
      AND n2.body = n.body
  );

-- ============================================================================
-- Step 2: Delete remaining duplicate notes on default-org records
-- (these are identical copies of notes that already exist on real-org records)
-- ============================================================================
DELETE FROM crm_notes n
USING crm_records r
WHERE n.record_id = r.id
  AND r.org_id = '00000000-0000-0000-0000-000000000001'
  AND n.org_id = '00000000-0000-0000-0000-000000000001'
  AND EXISTS (
    SELECT 1 FROM crm_records real_rec
    WHERE real_rec.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND real_rec.email = r.email AND r.email IS NOT NULL AND r.email != ''
  );

-- ============================================================================
-- Step 3: Move 480 orphaned records to the real org
-- These records have no matching email in the real org
-- ============================================================================

-- 3a: Move orphaned notes first (update org_id)
UPDATE crm_notes n
SET org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
FROM crm_records r
WHERE n.record_id = r.id
  AND r.org_id = '00000000-0000-0000-0000-000000000001'
  AND n.org_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM crm_records real_rec
    WHERE real_rec.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND real_rec.email = r.email AND r.email IS NOT NULL AND r.email != ''
  );

-- 3b: Move orphaned records — update org_id and module_id
-- Contacts module: 5c26eeee → 7913796d
UPDATE crm_records
SET
  org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e',
  module_id = '7913796d-bda6-4fff-b81d-5f707b06b71b'
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND module_id = '5c26eeee-ec93-406d-94eb-1e947ee75aaa'
  AND NOT EXISTS (
    SELECT 1 FROM crm_records real_rec
    WHERE real_rec.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND real_rec.email = crm_records.email
    AND crm_records.email IS NOT NULL AND crm_records.email != ''
  );

-- Leads module: bc1df20f → d2eebec8
UPDATE crm_records
SET
  org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e',
  module_id = 'd2eebec8-1612-4ed2-a240-0c40fefe6ec5'
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND module_id = 'bc1df20f-b19d-45fd-a45e-a1acd41a9e6c'
  AND NOT EXISTS (
    SELECT 1 FROM crm_records real_rec
    WHERE real_rec.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND real_rec.email = crm_records.email
    AND crm_records.email IS NOT NULL AND crm_records.email != ''
  );

-- Deals module: 711bfb4a → 692a7da1
UPDATE crm_records
SET
  org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e',
  module_id = '692a7da1-dfbf-46bf-a22e-6c0a79af1593'
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND module_id = '711bfb4a-16d5-45c2-8ef1-05e58928c0f5'
  AND NOT EXISTS (
    SELECT 1 FROM crm_records real_rec
    WHERE real_rec.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND real_rec.email = crm_records.email
    AND crm_records.email IS NOT NULL AND crm_records.email != ''
  );

-- Accounts module: 34b67ec1 → 978c8572
UPDATE crm_records
SET
  org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e',
  module_id = '978c8572-e679-4fda-bf61-cb5f0686ffe7'
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND module_id = '34b67ec1-ae21-4aeb-b061-78dacb76b374'
  AND NOT EXISTS (
    SELECT 1 FROM crm_records real_rec
    WHERE real_rec.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND real_rec.email = crm_records.email
    AND crm_records.email IS NOT NULL AND crm_records.email != ''
  );

-- Members module: 514b3205 → c9a8761a
UPDATE crm_records
SET
  org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e',
  module_id = 'c9a8761a-7899-4a7c-a428-117e7685fbaa'
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND module_id = '514b3205-a998-4fef-a115-91e8346d32cc'
  AND NOT EXISTS (
    SELECT 1 FROM crm_records real_rec
    WHERE real_rec.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND real_rec.email = crm_records.email
    AND crm_records.email IS NOT NULL AND crm_records.email != ''
  );

-- Advisors module: f1cb9492 → df1efbb3
UPDATE crm_records
SET
  org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e',
  module_id = 'df1efbb3-5306-4fa1-8582-858bb3a405f1'
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND module_id = 'f1cb9492-fc56-4b03-b675-fec7465bc792'
  AND NOT EXISTS (
    SELECT 1 FROM crm_records real_rec
    WHERE real_rec.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND real_rec.email = crm_records.email
    AND crm_records.email IS NOT NULL AND crm_records.email != ''
  );

-- ============================================================================
-- Step 4: Delete duplicate records from default org
-- At this point, only duplicates remain (their notes are already handled)
-- ============================================================================
DELETE FROM crm_records
WHERE org_id = '00000000-0000-0000-0000-000000000001';

-- ============================================================================
-- Step 5: Clean up default-org modules (no longer needed)
-- Keep the prospects module as it only exists in default org
-- ============================================================================
DELETE FROM crm_modules
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND key != 'prospects';

-- Move prospects module to real org if it doesn't exist there
UPDATE crm_modules
SET org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND key = 'prospects';

COMMIT;
