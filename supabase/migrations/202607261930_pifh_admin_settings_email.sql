-- Ensure PIFH org has admin_settings with notification mailboxes.
-- Additive / idempotent. PROD WRITE RISK: YES when applied (1 row upsert).

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

-- Rollback:
-- UPDATE public.admin_settings
-- SET admin_notification_email = NULL, billing_notification_email = NULL
-- WHERE organization_id = '00000000-0000-0000-0000-000000000001';
