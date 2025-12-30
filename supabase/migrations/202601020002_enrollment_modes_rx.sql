-- CRM-ECO: Enrollment Modes + Rx Pricing Extension
-- Adds enrollment_mode column for advisor-assisted / member self-serve / internal ops flows
-- Adds rx_medications and rx_pricing_result for AI-ready prescription pricing

-- ============================================================================
-- ENROLLMENT MODE
-- ============================================================================
-- Determines how this enrollment was run:
--   advisor_assisted   - Advisor is guiding the member through enrollment
--   member_self_serve  - Member completing enrollment independently (future portal)
--   internal_ops       - Back-office staff doing admin/cleanup enrollments

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS enrollment_mode text NOT NULL DEFAULT 'advisor_assisted'
    CHECK (enrollment_mode IN ('advisor_assisted', 'member_self_serve', 'internal_ops'));

COMMENT ON COLUMN public.enrollments.enrollment_mode IS 
  'How this enrollment was conducted: advisor_assisted (default), member_self_serve, or internal_ops';

-- ============================================================================
-- RX MEDICATIONS
-- ============================================================================
-- JSON array of medications captured during plan selection step
-- Structure: [{ name, dosage, frequency, currentMonthlyCost, preferredPharmacy }]

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS rx_medications jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.enrollments.rx_medications IS 
  'Array of medications: [{ name, dosage, frequency, currentMonthlyCost?, preferredPharmacy? }]';

-- ============================================================================
-- RX PRICING RESULT
-- ============================================================================
-- AI/API pricing response payload for display and audit
-- Structure: { options: [{ medicationName, pharmacy, estimatedMonthlyCost, notes, source }], summary }

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS rx_pricing_result jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.enrollments.rx_pricing_result IS 
  'Rx pricing estimate result: { options: RxOption[], summary: string }';

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Index for filtering/reporting by enrollment mode
CREATE INDEX IF NOT EXISTS idx_enrollments_mode ON public.enrollments(enrollment_mode);

-- Index for finding enrollments with Rx data (for future reporting)
CREATE INDEX IF NOT EXISTS idx_enrollments_has_rx ON public.enrollments((rx_medications != '[]'::jsonb));

