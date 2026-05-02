-- Multi-tenant licensing gates: seat limits per plan + feature checks.
--
-- The `organizations` table already has a `plan` column (trial/standard/pro/
-- enterprise). What was missing: a numeric seat ceiling per plan and a way
-- for the app to ask "is org X allowed to use feature Y?" without
-- duplicating the plan-tier matrix in every API route.
--
-- This migration:
--   1. Adds `seats_limit` to `organizations` and backfills sensible defaults.
--   2. Creates `count_org_active_seats(p_org_id)` so the app can show
--      "3 / 10 seats used".
--   3. Creates `check_org_seat_capacity(p_org_id)` returning true when an
--      additional seat can be added (used to gate invites).
--   4. Creates `check_org_plan_feature(p_org_id, p_feature_key)` for
--      feature gating in API routes / UI ("custom_fields", "automations",
--      "advanced_reports", etc.). The matrix is hard-coded — moving it to
--      a settings table later is one ALTER away when the marketing team
--      starts asking for tweaks.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. seats_limit on organizations
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS seats_limit int;

-- Defaults per plan: trial = 3, standard = 10, pro = 50, enterprise = NULL
-- (unlimited). Only set when null so we don't stomp manually-tuned limits.
UPDATE public.organizations
   SET seats_limit = CASE plan
                       WHEN 'trial'      THEN 3
                       WHEN 'standard'   THEN 10
                       WHEN 'pro'        THEN 50
                       WHEN 'enterprise' THEN NULL
                       ELSE 10
                     END
 WHERE seats_limit IS NULL AND plan != 'enterprise';

COMMENT ON COLUMN public.organizations.seats_limit IS
  'Max active members allowed for this org. NULL = unlimited (enterprise).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. count_org_active_seats — used by /settings/billing UI
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.count_org_active_seats(p_org_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
    FROM public.organization_members
   WHERE organization_id = p_org_id
     AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.count_org_active_seats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_org_active_seats(uuid) TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. check_org_seat_capacity — return false when the org is full
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_org_seat_capacity(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_used  int;
BEGIN
  SELECT seats_limit INTO v_limit
    FROM public.organizations
   WHERE id = p_org_id;

  IF v_limit IS NULL THEN
    RETURN true;  -- unlimited
  END IF;

  SELECT public.count_org_active_seats(p_org_id) INTO v_used;
  RETURN v_used < v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_org_seat_capacity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_org_seat_capacity(uuid) TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. check_org_plan_feature — feature flag matrix
-- ────────────────────────────────────────────────────────────────────────────
-- Plan → set of allowed feature keys. Edit this list when marketing changes
-- tier benefits. Returns true if the org's plan includes the feature, false
-- otherwise (defaults to "false" for unknown keys so new features are
-- explicitly gated until added here).
CREATE OR REPLACE FUNCTION public.check_org_plan_feature(
  p_org_id      uuid,
  p_feature_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_features_by_plan constant jsonb := '{
    "trial":      ["basic_crm", "basic_reports", "basic_enrollments"],
    "standard":   ["basic_crm", "basic_reports", "basic_enrollments",
                   "custom_fields", "email_templates", "advisor_hierarchy"],
    "pro":        ["basic_crm", "basic_reports", "basic_enrollments",
                   "custom_fields", "email_templates", "advisor_hierarchy",
                   "automations", "advanced_reports", "carrier_database",
                   "premium_compare", "audit_logs"],
    "enterprise": ["basic_crm", "basic_reports", "basic_enrollments",
                   "custom_fields", "email_templates", "advisor_hierarchy",
                   "automations", "advanced_reports", "carrier_database",
                   "premium_compare", "audit_logs",
                   "api_access", "sso", "white_label", "dedicated_support",
                   "data_export", "custom_branding"]
  }'::jsonb;
BEGIN
  SELECT plan INTO v_plan
    FROM public.organizations
   WHERE id = p_org_id;

  IF v_plan IS NULL THEN RETURN false; END IF;

  RETURN (v_features_by_plan->v_plan) ? p_feature_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_org_plan_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_org_plan_feature(uuid, text) TO service_role;

COMMENT ON FUNCTION public.check_org_plan_feature(uuid, text) IS
  'Returns true if org_id''s plan tier includes feature key. Plan-feature '
  'matrix is hard-coded inside the function body for now; lift into a '
  'settings table when the matrix needs to change without a migration.';

NOTIFY pgrst, 'reload schema';
