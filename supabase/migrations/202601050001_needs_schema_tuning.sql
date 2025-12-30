-- ============================================================================
-- Needs Schema Tuning + SLA Logic
-- ============================================================================
-- This migration upgrades the needs table to a proper SLA-driven workflow:
-- 1. Adds financial + IUA tracking fields
-- 2. Adds target timeline fields for SLA
-- 3. Expands status to granular workflow states
-- 4. Wires urgency_light to date-based trigger logic
-- ============================================================================

-- ============================================================================
-- 1. FINANCIAL + IUA FIELDS
-- ============================================================================
-- Note: total_amount, eligible_amount, reimbursed_amount, iua_amount already exist

ALTER TABLE public.needs
  ADD COLUMN IF NOT EXISTS billed_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS approved_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS member_responsibility_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS iua_remaining numeric(12,2),
  ADD COLUMN IF NOT EXISTS iua_met boolean DEFAULT false;

-- ============================================================================
-- 2. TIMELINE / SLA FIELDS
-- ============================================================================
-- Note: sla_target_date already exists but we're adding more granular targets

ALTER TABLE public.needs
  ADD COLUMN IF NOT EXISTS target_initial_review_date date,
  ADD COLUMN IF NOT EXISTS target_member_response_date date,
  ADD COLUMN IF NOT EXISTS target_completion_date date,
  ADD COLUMN IF NOT EXISTS last_status_change_at timestamptz;

-- ============================================================================
-- 3. EXPANDED STATUS CONSTRAINT
-- ============================================================================
-- Drop existing constraint and add expanded one with all workflow states
-- Maintains backwards compatibility with existing statuses

ALTER TABLE public.needs DROP CONSTRAINT IF EXISTS needs_status_check;

ALTER TABLE public.needs ADD CONSTRAINT needs_status_check
  CHECK (status IN (
    -- Active/Open statuses
    'new',                      -- Just created
    'open',                     -- Legacy/alias for new (backwards compat)
    'submitted',                -- Member submitted (existing)
    'intake',                   -- Initial intake processing
    'awaiting_member_docs',     -- Waiting on member documents
    'awaiting_provider_docs',   -- Waiting on provider/records
    'in_review',                -- Internal review (existing)
    'pricing',                  -- Pricing / negotiation
    'approved',                 -- Approved for sharing
    'reimbursement_pending',    -- Approved, waiting to reimburse member
    'processing',               -- Processing (existing)
    -- Terminal statuses
    'paid',                     -- Funds disbursed / shared (existing)
    'closed',                   -- Administratively closed (existing)
    'denied',                   -- Not approved
    'cancelled'                 -- Cancelled by member or system
  ));

-- ============================================================================
-- 4. SLA TRIGGER FUNCTION
-- ============================================================================
-- Replace the existing trigger with enhanced logic that:
-- - Sets default target dates on INSERT
-- - Tracks status change timestamps
-- - Computes urgency_light based on target_completion_date

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trg_set_need_urgency ON public.needs;
DROP TRIGGER IF EXISTS trg_needs_apply_sla ON public.needs;
DROP FUNCTION IF EXISTS public.compute_need_urgency(text, date);
DROP FUNCTION IF EXISTS public.set_need_urgency_from_sla();
DROP FUNCTION IF EXISTS public.needs_apply_sla();

-- Create the new SLA trigger function
CREATE OR REPLACE FUNCTION public.needs_apply_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  days_to_target integer;
BEGIN
  -- ========================================
  -- Track status change time
  -- ========================================
  IF TG_OP = 'INSERT' THEN
    -- Set initial status change timestamp
    IF NEW.last_status_change_at IS NULL THEN
      NEW.last_status_change_at := now();
    END IF;

    -- Set default target dates if not provided
    -- TODO: These SLA durations can be tuned per organization
    IF NEW.target_initial_review_date IS NULL THEN
      NEW.target_initial_review_date := (current_date + 3);   -- 3 days for initial review
    END IF;

    IF NEW.target_completion_date IS NULL THEN
      NEW.target_completion_date := (current_date + 45);      -- 45 days for completion
    END IF;

    -- Also set sla_target_date if not set (for backwards compatibility)
    IF NEW.sla_target_date IS NULL THEN
      NEW.sla_target_date := NEW.target_completion_date;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Track when status changes
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.last_status_change_at := now();
    END IF;
  END IF;

  -- ========================================
  -- Compute urgency_light
  -- ========================================

  -- Terminal/completed statuses are always green (no outstanding SLA)
  IF NEW.status IN ('paid', 'closed', 'denied', 'cancelled') THEN
    NEW.urgency_light := 'green';
    RETURN NEW;
  END IF;

  -- If no target date, default to green unless explicitly set
  IF NEW.target_completion_date IS NULL THEN
    IF NEW.urgency_light IS NULL THEN
      NEW.urgency_light := 'green';
    END IF;
    RETURN NEW;
  END IF;

  -- Compute days to target completion (today-based simple SLA)
  days_to_target := NEW.target_completion_date - current_date;

  -- Apply urgency thresholds
  -- TODO: These thresholds can be tuned per organization
  IF days_to_target >= 5 THEN
    NEW.urgency_light := 'green';   -- Comfortably on track (5+ days)
  ELSIF days_to_target >= 0 THEN
    NEW.urgency_light := 'orange';  -- Approaching deadline (0-4 days)
  ELSE
    NEW.urgency_light := 'red';     -- Past target date (overdue)
  END IF;

  RETURN NEW;
END;
$$;

-- Comment for documentation
COMMENT ON FUNCTION public.needs_apply_sla() IS 
  'Trigger function that manages SLA logic for needs: sets default target dates, tracks status changes, and computes urgency_light based on target_completion_date.';

-- ============================================================================
-- 5. ATTACH TRIGGER
-- ============================================================================

CREATE TRIGGER trg_needs_apply_sla
  BEFORE INSERT OR UPDATE ON public.needs
  FOR EACH ROW
  EXECUTE FUNCTION public.needs_apply_sla();

COMMENT ON TRIGGER trg_needs_apply_sla ON public.needs IS 
  'Automatically manages SLA: default target dates on INSERT, status change tracking, and urgency_light computation.';

-- ============================================================================
-- 6. HELPFUL INDEXES
-- ============================================================================
-- Support SLA queues, dashboards, and member portal filters

CREATE INDEX IF NOT EXISTS idx_needs_status ON public.needs(status);
CREATE INDEX IF NOT EXISTS idx_needs_target_completion ON public.needs(target_completion_date);
CREATE INDEX IF NOT EXISTS idx_needs_target_initial_review ON public.needs(target_initial_review_date);
CREATE INDEX IF NOT EXISTS idx_needs_last_status_change ON public.needs(last_status_change_at);
-- idx_needs_urgency_light already exists from init migration

-- ============================================================================
-- 7. REFRESH EXISTING ROWS (Optional)
-- ============================================================================
-- Run all existing needs through the trigger to set default dates and 
-- recalculate urgency_light. This is safe for moderate dataset sizes.

UPDATE public.needs 
SET status = status 
WHERE target_completion_date IS NULL 
   OR last_status_change_at IS NULL;

-- ============================================================================
-- NOTE: After applying this migration, run:
--   supabase gen types typescript --project-id <project-id> > packages/lib/src/types/database.ts
-- to refresh the TypeScript Database types.
-- ============================================================================

