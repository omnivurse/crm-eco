-- ============================================================================
-- Migration: 202605220005_enrollment_stripe_payment_columns
-- Purpose:   Add the Stripe-side payment columns that the webhook handler
--            (apps/crm/src/lib/integrations/webhooks/handlers/stripe.ts)
--            already writes to but were missing on PIFH.
--
--            PIFH's primary processor is Authorize.Net (lives on
--            payment_profiles / billing_schedules / billing_transactions),
--            but the codebase also handles Stripe events. Without these
--            columns, every Stripe payment_intent webhook silently dropped
--            its update (PGRST204) and the enrollment never reflected the
--            payment state.
--
--            Adds:
--              enrollments.payment_status        text
--              enrollments.stripe_payment_id     text  (+ partial index)
--              enrollments.payment_amount        numeric(10,2)
--              enrollments.paid_at               timestamptz
--              enrollments.last_payment_error    text
--
--            100% additive — no DROP, no rename, no destructive ALTER. Both
--            the Authorize.Net and Stripe flows now persist correctly.
--
-- Audit refs (.audit/findings.json):
--   - "enrollments.payment_status referenced in code but column does not exist"
--   - "enrollments.stripe_payment_id referenced in code but column does not exist"
--   - "enrollments.payment_amount referenced in code but column does not exist"
--   - "enrollments.paid_at referenced in code but column does not exist"
--   - "enrollments.last_payment_error referenced in code but column does not exist"
--
-- Rollback (rarely needed):
--   BEGIN;
--     ALTER TABLE enrollments DROP COLUMN IF EXISTS payment_status;
--     ALTER TABLE enrollments DROP COLUMN IF EXISTS stripe_payment_id;
--     ALTER TABLE enrollments DROP COLUMN IF EXISTS payment_amount;
--     ALTER TABLE enrollments DROP COLUMN IF EXISTS paid_at;
--     ALTER TABLE enrollments DROP COLUMN IF EXISTS last_payment_error;
--   COMMIT;
-- ============================================================================

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
      AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE public.enrollments
      ADD COLUMN payment_status text;
    COMMENT ON COLUMN public.enrollments.payment_status IS
      'Latest known external-processor payment outcome (paid|failed|pending). Distinct from enrollments.status, which is the enrollment lifecycle.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
      AND column_name = 'stripe_payment_id'
  ) THEN
    ALTER TABLE public.enrollments
      ADD COLUMN stripe_payment_id text;
    COMMENT ON COLUMN public.enrollments.stripe_payment_id IS
      'Stripe PaymentIntent ID (pi_…) recorded by the Stripe webhook handler.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
      AND column_name = 'payment_amount'
  ) THEN
    ALTER TABLE public.enrollments
      ADD COLUMN payment_amount numeric(10,2);
    COMMENT ON COLUMN public.enrollments.payment_amount IS
      'Captured amount of the latest successful payment in major units (e.g. dollars).';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
      AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE public.enrollments
      ADD COLUMN paid_at timestamptz;
    COMMENT ON COLUMN public.enrollments.paid_at IS
      'Timestamp of the latest successful payment. Updated by webhook handlers.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
      AND column_name = 'last_payment_error'
  ) THEN
    ALTER TABLE public.enrollments
      ADD COLUMN last_payment_error text;
    COMMENT ON COLUMN public.enrollments.last_payment_error IS
      'Latest payment error message (Stripe.last_payment_error?.message). Cleared on next success.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS enrollments_stripe_payment_id_idx
  ON public.enrollments (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS enrollments_payment_status_idx
  ON public.enrollments (organization_id, payment_status)
  WHERE payment_status IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
