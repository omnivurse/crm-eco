-- ============================================================================
-- Partner workflow fields: Agency, Partners, Support Team
-- Added to contacts + leads for every org (Quick Create / record forms).
-- is_indexed enables module text search on these columns.
-- ============================================================================

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
      display_order,
      section,
      tooltip
    )
    VALUES
      (
        v_mod.org_id,
        v_mod.id,
        'agency',
        'Agency',
        'text',
        false,
        false,
        false,
        true,
        117,
        'relationships',
        'Agency or organization associated with this contact'
      ),
      (
        v_mod.org_id,
        v_mod.id,
        'partners',
        'Partners',
        'textarea',
        false,
        false,
        false,
        true,
        118,
        'relationships',
        'Partners you collaborate with on this account'
      ),
      (
        v_mod.org_id,
        v_mod.id,
        'support_team',
        'Support Team',
        'text',
        false,
        false,
        false,
        true,
        119,
        'relationships',
        'Support team members responsible for this contact'
      )
    ON CONFLICT (module_id, key) DO NOTHING;
  END LOOP;
END $$;
