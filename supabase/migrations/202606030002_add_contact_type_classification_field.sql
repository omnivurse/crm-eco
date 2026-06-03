-- =============================================================================
-- Migration: "Contact Type" classification field (Support / Partner / etc.)
-- =============================================================================
--
-- Client request: a way to differentiate a contact (e.g. a future business
-- "Partner Contact" or a "Support Contact") from ordinary member contacts.
--
-- Design: a single-select custom field on the CRM `contacts` (and `leads`)
-- modules. This is the platform-native mechanism (a `crm_fields` row) so the
-- field automatically appears on the record form / Quick Create, is editable
-- inline, and is filterable in the contacts list and reports.
--
-- Key choice: `contact_category` (NOT `contact_type`). The string `contact_type`
-- is referenced by a dormant indexed-column code path
-- (CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH) whose `crm_records.contact_type`
-- column does NOT exist in the live database — using that key would cause saves
-- to fail with "column contact_type does not exist". `contact_category` stays
-- safely in JSONB `data` only.
--
-- Options are intentionally simple and easy to adjust later (edit this row in
-- Settings → Modules → Contacts → Fields, or amend the array below).
--
-- Idempotent: ON CONFLICT (module_id, key) DO NOTHING. Additive and reversible
-- (DELETE the field row to roll back; stored values remain in JSONB `data`).
-- `org_id` is set explicitly; a tenant-key trigger mirrors it to
-- `organization_id` (same pattern as 202604290002_partner_agency_support_fields).
-- =============================================================================

DO $$
DECLARE
  v_mod record;
BEGIN
  FOR v_mod IN
    SELECT id, org_id, key FROM crm_modules WHERE key IN ('contacts', 'leads')
  LOOP
    INSERT INTO crm_fields (
      org_id,
      module_id,
      key,
      label,
      type,
      required,
      is_system,
      is_pinned,
      is_indexed,
      options,
      display_order,
      section,
      tooltip
    )
    VALUES (
      v_mod.org_id,
      v_mod.id,
      'contact_category',
      'Contact Type',
      'select',
      false,
      false,
      false,
      true,
      '["Member","Prospect","Partner Contact","Support Contact","Vendor","Other"]'::jsonb,
      6,
      'core',
      'How this contact relates to your organization (e.g. Partner Contact, Support Contact). Used to differentiate and filter contacts.'
    )
    ON CONFLICT (module_id, key) DO NOTHING;
  END LOOP;
END $$;
