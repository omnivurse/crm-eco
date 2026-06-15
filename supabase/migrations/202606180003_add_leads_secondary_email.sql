-- Add Secondary Email to Leads module (parity with Contacts).
-- Field data already flows through JSONB on save/convert; this restores UI visibility.

SET lock_timeout = '5s';

INSERT INTO crm_fields (
  org_id,
  organization_id,
  module_id,
  key,
  label,
  type,
  required,
  is_system,
  display_order,
  section,
  width,
  tooltip
)
SELECT
  m.org_id,
  m.organization_id,
  m.id,
  'secondary_email',
  'Secondary Email',
  'email',
  false,
  false,
  7,
  'core',
  'half',
  'Alternate email address for this lead'
FROM crm_modules m
WHERE m.key = 'leads'
  AND m.is_enabled = true
ON CONFLICT (module_id, key) DO UPDATE
SET label = EXCLUDED.label,
    type = EXCLUDED.type,
    section = EXCLUDED.section,
    display_order = EXCLUDED.display_order,
    width = EXCLUDED.width,
    tooltip = EXCLUDED.tooltip,
    updated_at = now();
