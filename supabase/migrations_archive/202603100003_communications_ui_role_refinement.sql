-- ============================================================================
-- Communications + UI Role Refinement
-- Adds product_type to templates, capacity display support for contacts,
-- and profile capacity preferences.
-- ADDITIVE ONLY — does not alter existing columns or break existing queries.
-- ============================================================================

-- 1. Add product_type to crm_message_templates for capacity-aware template filtering
ALTER TABLE public.crm_message_templates
  ADD COLUMN IF NOT EXISTS product_type text;

COMMENT ON COLUMN public.crm_message_templates.product_type IS
  'Product type this template applies to: health_insurance, health_share, or NULL for general/all';

CREATE INDEX IF NOT EXISTS idx_crm_message_templates_product_type
  ON public.crm_message_templates (org_id, product_type)
  WHERE product_type IS NOT NULL;

-- 2. Add capacity_preferences to profiles for user-level capacity display
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS capacity_preferences text[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.capacity_preferences IS
  'User preferred product type capacities for filtering: health_insurance, health_share, or both';

-- ============================================================================
-- Done. All changes are additive and backward-compatible.
-- ============================================================================
