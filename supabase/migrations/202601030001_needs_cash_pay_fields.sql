-- ============================================================================
-- Needs Cash-Pay and Reimbursement Fields
-- ============================================================================
-- This migration adds fields to support member self-serve need submission
-- with cash-pay tracking and reimbursement status.
-- ============================================================================

-- Add facility/provider name
ALTER TABLE needs
  ADD COLUMN IF NOT EXISTS facility_name text;

-- Add payment tracking fields
ALTER TABLE needs
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'not_paid',
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) DEFAULT 0;

-- Add payment_status check constraint
ALTER TABLE needs DROP CONSTRAINT IF EXISTS needs_payment_status_check;
ALTER TABLE needs ADD CONSTRAINT needs_payment_status_check
  CHECK (payment_status IN ('not_paid', 'partial', 'paid'));

-- Add reimbursement status field
ALTER TABLE needs
  ADD COLUMN IF NOT EXISTS reimbursement_status text DEFAULT 'not_requested';

-- Add reimbursement_status check constraint  
ALTER TABLE needs DROP CONSTRAINT IF EXISTS needs_reimbursement_status_check;
ALTER TABLE needs ADD CONSTRAINT needs_reimbursement_status_check
  CHECK (reimbursement_status IN ('not_requested', 'pending', 'processing', 'completed'));

-- Add member consent flag
ALTER TABLE needs
  ADD COLUMN IF NOT EXISTS has_member_consent boolean DEFAULT false;

-- Update status check to include 'submitted' for member self-serve flow
ALTER TABLE needs DROP CONSTRAINT IF EXISTS needs_status_check;
ALTER TABLE needs ADD CONSTRAINT needs_status_check
  CHECK (status IN ('open', 'submitted', 'in_review', 'processing', 'paid', 'closed'));

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_needs_payment_status ON needs(payment_status);
CREATE INDEX IF NOT EXISTS idx_needs_reimbursement_status ON needs(reimbursement_status);

-- ============================================================================
-- RLS Policy for member self-serve need creation
-- ============================================================================

-- Allow members to view their own needs
CREATE POLICY IF NOT EXISTS "Members can view their own needs"
  ON needs FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND member_id IN (
      SELECT m.id FROM members m
      JOIN profiles p ON p.email = m.email
      WHERE p.user_id = auth.uid()
      AND m.organization_id = get_user_organization_id()
    )
  );

-- Allow members to create their own needs
CREATE POLICY IF NOT EXISTS "Members can create their own needs"
  ON needs FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND member_id IN (
      SELECT m.id FROM members m
      JOIN profiles p ON p.email = m.email
      WHERE p.user_id = auth.uid()
      AND m.organization_id = get_user_organization_id()
    )
  );

-- Allow members to update their own needs (limited to certain fields via application logic)
CREATE POLICY IF NOT EXISTS "Members can update their own needs"
  ON needs FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND member_id IN (
      SELECT m.id FROM members m
      JOIN profiles p ON p.email = m.email
      WHERE p.user_id = auth.uid()
      AND m.organization_id = get_user_organization_id()
    )
  );

-- Allow members to create need events for their own needs
CREATE POLICY IF NOT EXISTS "Members can create events for their own needs"
  ON need_events FOR INSERT
  WITH CHECK (
    need_id IN (
      SELECT n.id FROM needs n
      JOIN members m ON m.id = n.member_id
      JOIN profiles p ON p.email = m.email
      WHERE p.user_id = auth.uid()
      AND n.organization_id = get_user_organization_id()
    )
  );

