-- ============================================================================
-- Migration: 202605220003_member_subscription_and_merge_columns
-- Purpose:   Add missing columns on `members` that production code already
--            writes to (silent PGRST204 failures today). 100% additive.
--
--            Adds:
--              members.subscription_status                 text
--              members.subscription_current_period_end     timestamptz
--              members.stripe_customer_id                  text  (+ index)
--              members.stripe_subscription_id              text  (+ index)
--              members.merged_into_id                      uuid  -> members(id) ON DELETE SET NULL
--              members.merged_at                           timestamptz
--              members.market_type                         text  (mirror of crm_records.market_type for member-level filtering)
--
-- Audit refs (.audit/findings.json):
--   - "members.subscription_status referenced in code but column does not exist"
--   - "members.subscription_current_period_end referenced in code but column does not exist"
--   - "members.merged_into_id referenced in code but column does not exist"
--   - "members.merged_at referenced in code but column does not exist"
--   - "members.market_type referenced in code but column does not exist"
--
-- Guardrails:
--   - No DROP, no destructive ALTER, no data movement.
--   - Every change wrapped in IF NOT EXISTS via information_schema check.
--   - Indexes are partial (WHERE col IS NOT NULL) to stay tiny.
--   - Wrapped in BEGIN/COMMIT so partial failure is impossible.
--
-- Rollback (manual, only if absolutely needed):
--   BEGIN;
--     ALTER TABLE members DROP COLUMN IF EXISTS subscription_status;
--     ALTER TABLE members DROP COLUMN IF EXISTS subscription_current_period_end;
--     ALTER TABLE members DROP COLUMN IF EXISTS stripe_customer_id;
--     ALTER TABLE members DROP COLUMN IF EXISTS stripe_subscription_id;
--     ALTER TABLE members DROP COLUMN IF EXISTS merged_into_id;
--     ALTER TABLE members DROP COLUMN IF EXISTS merged_at;
--     ALTER TABLE members DROP COLUMN IF EXISTS market_type;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ── 1. Subscription tracking (Stripe webhook target) ────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.members
      ADD COLUMN subscription_status text;
    COMMENT ON COLUMN public.members.subscription_status IS
      'Stripe subscription status (active|trialing|past_due|canceled|unpaid|incomplete|incomplete_expired|paused). Written by Stripe webhook handler.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'subscription_current_period_end'
  ) THEN
    ALTER TABLE public.members
      ADD COLUMN subscription_current_period_end timestamptz;
    COMMENT ON COLUMN public.members.subscription_current_period_end IS
      'Stripe subscription current_period_end timestamp. Written by Stripe webhook handler.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.members
      ADD COLUMN stripe_customer_id text;
    COMMENT ON COLUMN public.members.stripe_customer_id IS
      'Stripe Customer ID (cus_…) for this member. Set when subscription is created.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE public.members
      ADD COLUMN stripe_subscription_id text;
    COMMENT ON COLUMN public.members.stripe_subscription_id IS
      'Stripe Subscription ID (sub_…) currently linked to this member.';
  END IF;
END $$;

-- ── 2. Member merge bookkeeping (MergeMembersModal target) ──────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'merged_into_id'
  ) THEN
    ALTER TABLE public.members
      ADD COLUMN merged_into_id uuid REFERENCES public.members(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.members.merged_into_id IS
      'When this member was deduped into another, the surviving member''s id. Paired with merged_at.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'merged_at'
  ) THEN
    ALTER TABLE public.members
      ADD COLUMN merged_at timestamptz;
    COMMENT ON COLUMN public.members.merged_at IS
      'Timestamp when this member was merged into merged_into_id.';
  END IF;
END $$;

-- ── 3. market_type filter (used on admin members list) ──────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'market_type'
  ) THEN
    ALTER TABLE public.members
      ADD COLUMN market_type text;
    COMMENT ON COLUMN public.members.market_type IS
      'Member-level mirror of the market segment the member belongs to (healthshare|insurance|other). Mirrors crm_records.market_type when synced.';
  END IF;
END $$;

-- ── 4. Indexes for webhook lookups + filter screens ─────────────────────────
-- Partial WHERE col IS NOT NULL keeps the index tiny — only ~5% of rows have
-- subscription/Stripe metadata on day one.

CREATE INDEX IF NOT EXISTS members_stripe_customer_id_idx
  ON public.members (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS members_stripe_subscription_id_idx
  ON public.members (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS members_subscription_status_idx
  ON public.members (organization_id, subscription_status)
  WHERE subscription_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS members_merged_into_id_idx
  ON public.members (merged_into_id)
  WHERE merged_into_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS members_market_type_idx
  ON public.members (organization_id, market_type)
  WHERE market_type IS NOT NULL;

-- ── 5. Reload PostgREST so PostgREST sees the new columns immediately ───────

NOTIFY pgrst, 'reload schema';

COMMIT;
