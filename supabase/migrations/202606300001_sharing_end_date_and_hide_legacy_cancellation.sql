-- Add canonical HealthShare coverage end date field (one field per product line).
-- Major medical already uses health_insurance_end_date in health_insurance section.

DO $$
DECLARE
  v_org_id     uuid;
  v_module_id  uuid;
  v_module_key text;
BEGIN
  FOR v_org_id IN SELECT id FROM organizations ORDER BY id LOOP
    FOREACH v_module_key IN ARRAY ARRAY['leads', 'contacts', 'members'] LOOP
      SELECT id INTO v_module_id
      FROM crm_modules
      WHERE organization_id = v_org_id
        AND key = v_module_key
        AND is_enabled = true
      LIMIT 1;

      IF v_module_id IS NULL THEN
        CONTINUE;
      END IF;

      INSERT INTO crm_fields (
        org_id, module_id, key, label, type, required, is_system,
        display_order, section, width, tooltip, metadata
      )
      VALUES (
        v_org_id,
        v_module_id,
        'sharing_end_date',
        'Coverage End',
        'date',
        false,
        false,
        326,
        'health_sharing',
        'half',
        'Date HealthShare coverage ends',
        '{}'::jsonb
      )
      ON CONFLICT (module_id, key) DO UPDATE
      SET section = EXCLUDED.section,
          label = EXCLUDED.label,
          type = EXCLUDED.type,
          display_order = EXCLUDED.display_order,
          width = EXCLUDED.width,
          tooltip = EXCLUDED.tooltip,
          updated_at = now()
      WHERE crm_fields.section IS DISTINCT FROM EXCLUDED.section
         OR crm_fields.label IS DISTINCT FROM EXCLUDED.label;
    END LOOP;
  END LOOP;
END $$;

-- Hide legacy product-section cancellation_date from layouts where reps should
-- use the per-product end-date fields instead.
UPDATE crm_fields
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"ui_hidden": true}'::jsonb,
    updated_at = now()
WHERE key = 'cancellation_date'
  AND section = 'product'
  AND COALESCE(metadata->>'ui_hidden', 'false') <> 'true';
