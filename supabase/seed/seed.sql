-- Seed data for development/testing
-- Note: This creates a demo organization. Real users should be created via auth.

-- Create a demo organization
INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Healthshare',
  'demo-healthshare',
  '{"timezone": "America/New_York", "currency": "USD"}'::jsonb
);

-- Note: To create a full test user, you'll need to:
-- 1. Create a user in Supabase Auth (via dashboard or API)
-- 2. Then create a profile linked to that user

-- Example custom field definitions
INSERT INTO custom_field_definitions (organization_id, entity_type, field_name, field_type, field_label, options, display_order)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'member', 'referral_source', 'select', 'Referral Source', '["Web", "Friend", "Advisor", "Social Media", "Other"]'::jsonb, 1),
  ('00000000-0000-0000-0000-000000000001', 'member', 'preferred_contact', 'select', 'Preferred Contact Method', '["Email", "Phone", "Text"]'::jsonb, 2),
  ('00000000-0000-0000-0000-000000000001', 'advisor', 'years_experience', 'number', 'Years of Experience', '[]'::jsonb, 1),
  ('00000000-0000-0000-0000-000000000001', 'need', 'service_type', 'select', 'Service Type', '["Hospital", "Physician", "Lab", "Imaging", "Pharmacy", "Other"]'::jsonb, 1);

