-- Additive processor tag on payment_profiles so NMI and Authorize.Net
-- vault ids can coexist. Existing rows stay on Authorize.Net.
-- Rollback: ALTER TABLE public.payment_profiles DROP COLUMN IF EXISTS processor;

SET lock_timeout = '5s';

ALTER TABLE public.payment_profiles
  ADD COLUMN IF NOT EXISTS processor text NOT NULL DEFAULT 'authorizenet';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_profiles_processor_check'
      AND conrelid = 'public.payment_profiles'::regclass
  ) THEN
    ALTER TABLE public.payment_profiles
      ADD CONSTRAINT payment_profiles_processor_check
      CHECK (processor IN ('authorizenet', 'nmi', 'placeholder', 'http'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_payment_profiles_processor
  ON public.payment_profiles (processor);

COMMENT ON COLUMN public.payment_profiles.processor IS
  'Gateway that issued authorize_* vault ids. authorizenet for existing CIM profiles; nmi for Customer Vault.';
