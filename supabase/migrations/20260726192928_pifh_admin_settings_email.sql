-- Backfilled from the production migration ledger.
-- This migration was applied directly to production on 2026-07-26 19:29:28 UTC
-- (outside the repo) and was missing from version control. The SQL below is
-- reproduced verbatim from supabase_migrations.schema_migrations so that a
-- rebuild from migrations reproduces production. Already recorded as applied
-- in production -- it will not re-run there.

SET lock_timeout = '5s';

INSERT INTO public.admin_settings (
  organization_id,
  company_name,
  admin_notification_email,
  billing_notification_email
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Pay It Forward Health',
  'admin@payitforwardhealth.com',
  'billing@payitforwardhealth.com'
)
ON CONFLICT (organization_id) DO UPDATE
SET
  admin_notification_email = 'admin@payitforwardhealth.com',
  billing_notification_email = 'billing@payitforwardhealth.com',
  company_name = COALESCE(public.admin_settings.company_name, EXCLUDED.company_name),
  updated_at = now();
