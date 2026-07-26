-- =============================================================================
-- PIFH @payitforwardhealth.com email domain + sender registry
-- Additive / idempotent. PROD WRITE RISK: YES when applied.
-- =============================================================================

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_root_domain_id uuid;
  v_mail_domain_id uuid;
BEGIN
  -- Root sending domain
  INSERT INTO public.email_domains (
    org_id,
    organization_id,
    domain,
    status,
    dkim_verified,
    spf_verified,
    dmarc_verified,
    mx_verified,
    last_verified_at
  )
  VALUES (
    v_org_id,
    v_org_id,
    'payitforwardhealth.com',
    'verified',
    true,
    true,
    true,
    true,
    now()
  )
  ON CONFLICT (org_id, domain) DO UPDATE
  SET
    status = 'verified',
    dkim_verified = true,
    spf_verified = true,
    dmarc_verified = true,
    mx_verified = true,
    last_verified_at = now(),
    organization_id = EXCLUDED.organization_id,
    updated_at = now()
  RETURNING id INTO v_root_domain_id;

  IF v_root_domain_id IS NULL THEN
    SELECT id INTO v_root_domain_id
    FROM public.email_domains
    WHERE org_id = v_org_id AND domain = 'payitforwardhealth.com';
  END IF;

  -- Inbound subdomain (Resend receive → email-intake)
  INSERT INTO public.email_domains (
    org_id,
    organization_id,
    domain,
    status,
    dkim_verified,
    spf_verified,
    dmarc_verified,
    mx_verified,
    last_verified_at
  )
  VALUES (
    v_org_id,
    v_org_id,
    'mail.payitforwardhealth.com',
    'verified',
    true,
    true,
    true,
    true,
    now()
  )
  ON CONFLICT (org_id, domain) DO UPDATE
  SET
    status = 'verified',
    dkim_verified = true,
    spf_verified = true,
    dmarc_verified = true,
    mx_verified = true,
    last_verified_at = now(),
    organization_id = EXCLUDED.organization_id,
    updated_at = now()
  RETURNING id INTO v_mail_domain_id;

  IF v_mail_domain_id IS NULL THEN
    SELECT id INTO v_mail_domain_id
    FROM public.email_domains
    WHERE org_id = v_org_id AND domain = 'mail.payitforwardhealth.com';
  END IF;

  -- Sender addresses on root domain
  INSERT INTO public.email_sender_addresses (org_id, domain_id, email, name, is_default, is_verified)
  VALUES
    (v_org_id, v_root_domain_id, 'noreply@payitforwardhealth.com', 'Pay It Forward Health', true, true),
    (v_org_id, v_root_domain_id, 'support@payitforwardhealth.com', 'Pay It Forward Health Support', false, true),
    (v_org_id, v_root_domain_id, 'hello@payitforwardhealth.com', 'Pay It Forward Health', false, true),
    (v_org_id, v_root_domain_id, 'membership@payitforwardhealth.com', 'Pay It Forward Health Membership', false, true),
    (v_org_id, v_root_domain_id, 'info@payitforwardhealth.com', 'Pay It Forward Health', false, true),
    (v_org_id, v_root_domain_id, 'contact@payitforwardhealth.com', 'Pay It Forward Health', false, true),
    (v_org_id, v_root_domain_id, 'billing@payitforwardhealth.com', 'Pay It Forward Health Billing', false, true),
    (v_org_id, v_root_domain_id, 'admin@payitforwardhealth.com', 'Pay It Forward Health Admin', false, true),
    (v_org_id, v_root_domain_id, 'privacy@payitforwardhealth.com', 'Pay It Forward Health Privacy', false, true),
    (v_org_id, v_root_domain_id, 'compliance@payitforwardhealth.com', 'Pay It Forward Health Compliance', false, true),
    (v_org_id, v_root_domain_id, 'legal@payitforwardhealth.com', 'Pay It Forward Health Legal', false, true),
    (v_org_id, v_root_domain_id, 'enrollment@payitforwardhealth.com', 'Pay It Forward Health Enrollment', false, true),
    (v_org_id, v_root_domain_id, 'notifications@payitforwardhealth.com', 'Pay It Forward Health', false, true),
    (v_org_id, v_root_domain_id, 'advocacy@payitforwardhealth.com', 'Pay It Forward Health Advocacy', false, true),
    (v_org_id, v_root_domain_id, 'security@payitforwardhealth.com', 'Pay It Forward Health Security', false, true),
    (v_org_id, v_root_domain_id, 'wendy@payitforwardhealth.com', 'Wendy Scipione', false, true)
  ON CONFLICT (org_id, email) DO UPDATE
  SET
    name = EXCLUDED.name,
    domain_id = EXCLUDED.domain_id,
    is_verified = true,
    is_default = EXCLUDED.is_default;

  -- Ensure only noreply is default
  UPDATE public.email_sender_addresses
  SET is_default = (email = 'noreply@payitforwardhealth.com')
  WHERE org_id = v_org_id
    AND email LIKE '%@payitforwardhealth.com';
END $$;

-- Org email settings
INSERT INTO public.system_settings (
  organization_id,
  setting_key,
  setting_value,
  setting_type,
  category,
  label,
  is_active
)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'email_from_address', 'noreply@payitforwardhealth.com', 'string', 'email', 'From Email Address', true),
  ('00000000-0000-0000-0000-000000000001', 'email_from_name', 'Pay It Forward Health', 'string', 'email', 'From Name', true),
  ('00000000-0000-0000-0000-000000000001', 'email_reply_to', 'support@payitforwardhealth.com', 'string', 'email', 'Reply-To Email', true),
  ('00000000-0000-0000-0000-000000000001', 'email_domain', 'payitforwardhealth.com', 'string', 'email', 'Email Domain', true),
  ('00000000-0000-0000-0000-000000000001', 'email_provider', 'resend', 'string', 'email', 'Email Provider', true)
ON CONFLICT (organization_id, setting_key) DO UPDATE
SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

-- Admin notification targets
UPDATE public.admin_settings
SET
  admin_notification_email = COALESCE(admin_notification_email, 'admin@payitforwardhealth.com'),
  billing_notification_email = COALESCE(billing_notification_email, 'billing@payitforwardhealth.com'),
  updated_at = now()
WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Rollback notes:
-- DELETE FROM public.email_sender_addresses WHERE org_id = '00000000-0000-0000-0000-000000000001' AND email LIKE '%@payitforwardhealth.com';
-- DELETE FROM public.email_domains WHERE org_id = '00000000-0000-0000-0000-000000000001' AND domain IN ('payitforwardhealth.com', 'mail.payitforwardhealth.com');
