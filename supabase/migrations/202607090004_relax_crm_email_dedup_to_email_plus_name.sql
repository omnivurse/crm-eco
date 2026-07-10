-- ============================================================================
-- Relax crm_records email de-dup from EMAIL-ONLY to EMAIL + NAME, so family
-- members can share one email address — e.g. a child dependent (River Close)
-- who needs her own record but is reachable at her mother's (Andrea Beacham's)
-- email.
--
--   Before: idx_crm_records_unique_email = UNIQUE(org_id, module_id, lower(email))
--           → two records in a module could NEVER share an email (blocked a
--             parent + child from both existing as Leads/Contacts).
--   After:  UNIQUE(org_id, module_id, lower(email), lower(first_name), lower(last_name))
--           → the same email is allowed as long as the NAME differs; an exact
--             same-email + same-name record is still rejected (a true duplicate).
--
-- This mirrors rules the system already applies elsewhere:
--   * the enrollment `members` table: members_org_email_name_active_uniq keys on
--     (org, email, first_name, last_name) — family members already share email;
--   * the members-module exemption added in 202606170001, which explicitly
--     flagged relaxing contacts/leads email-dedup as a product decision to make.
--     This migration makes that decision.
--
-- Safety: the new key is strictly LOOSER than the old one, so no existing row can
-- violate it (email-unique implies email+name-unique) — the CREATE cannot fail on
-- current data. Members-sourced records stay exempt (WHERE clause unchanged).
-- Follows the proven 202606170001 rescope pattern (DROP + CREATE, lock_timeout).
-- ============================================================================

SET lock_timeout = '4s';
SET statement_timeout = '0';

DROP INDEX IF EXISTS idx_crm_records_unique_email;

CREATE UNIQUE INDEX idx_crm_records_unique_email
  ON crm_records (
    org_id,
    module_id,
    lower(email),
    lower(btrim(coalesce(data->>'first_name', ''))),
    lower(btrim(coalesce(data->>'last_name', '')))
  )
  WHERE email IS NOT NULL
    AND email <> ''
    AND (system->>'source_table') IS DISTINCT FROM 'members';

COMMENT ON INDEX idx_crm_records_unique_email IS
  'Per org+module uniqueness on email + first/last name (not email alone), so family members (e.g. a child dependent) can share one email; exact same-email+same-name is still blocked. Members-sourced records are exempt (deduped by source_id).';
