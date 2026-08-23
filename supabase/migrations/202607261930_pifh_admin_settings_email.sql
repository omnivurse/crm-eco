-- Ensure PIFH org has admin_settings with notification mailboxes.
-- Additive / idempotent. PROD WRITE RISK: YES when applied (1 row upsert).

SET lock_timeout = '5s';

-- 2026-08-23: wrapped in a guarded DO block (fresh-database safety, pattern of
-- commit 7c60dec8): the bare INSERT hit the admin_settings→organizations FK on
-- a fresh database (supabase start, the CI walk runner), where the PIFH org
-- does not exist yet. SQL preserved verbatim inside; production never re-runs
-- this file (its version is recorded in the migration ledger).
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000001') THEN
    RAISE NOTICE '202607261930_pifh_admin_settings_email: org not present (fresh database) — admin_settings upsert skipped';
    RETURN;
  END IF;

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
END $do$;

-- Rollback:
-- UPDATE public.admin_settings
-- SET admin_notification_email = NULL, billing_notification_email = NULL
-- WHERE organization_id = '00000000-0000-0000-0000-000000000001';
