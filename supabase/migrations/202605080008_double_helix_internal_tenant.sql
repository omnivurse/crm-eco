-- Provisions the internal Double Helix Software tenant org and its Leads
-- module. The doublehelixhub.com lead-capture endpoint writes incoming
-- inquiries into crm_records under this org/module pair.
--
-- The UUIDs are intentionally fixed so the marketing app can reference them
-- as compile-time constants without env-var indirection. The org is flagged
-- internal=true in settings to distinguish it from real licensee tenants.

INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '00000000-d0d0-4000-8000-000000000001',
  'Double Helix Software',
  'double-helix-software',
  jsonb_build_object(
    'internal', true,
    'description', 'Internal tenant for Double Helix-the-company; receives leads from doublehelixhub.com'
  )
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_modules (
  id, org_id, key, name, name_plural, icon, description,
  is_system, is_enabled, display_order
)
VALUES (
  '00000000-d0d0-4000-8000-000000000002',
  '00000000-d0d0-4000-8000-000000000001',
  'Leads',
  'Lead',
  'Leads',
  'sparkles',
  'Inbound inquiries from the doublehelixhub.com marketing site.',
  false,
  true,
  0
)
ON CONFLICT (org_id, key) DO NOTHING;
