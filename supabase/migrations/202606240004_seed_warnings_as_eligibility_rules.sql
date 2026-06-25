-- Phase 0 / Eligibility: fold the 2 hardcoded warnings.ts checks into ADVISORY product_eligibility_rules (data seed, idempotent). [C3]
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Status: PROMOTED to supabase/migrations/ — applied in version order by `supabase db push` (additive + idempotent).
-- Risk: TIER-1 — INSERTs data rows only (no DDL, no constraint/type change). Idempotent via a
--        NOT EXISTS guard keyed on (plan_id, rule_type, rule_name), so re-running is a no-op.
-- WHY: packages/lib/src/enrollment/warnings.ts hardcodes two ADVISORY enrollment checks that are
--        disconnected from the configurable product_eligibility_rules table:
--          1. has_mandate_warning — member resides in an individual-mandate state
--             (MANDATE_STATES = MA, NJ, DC, CA, RI, VT).
--          2. has_age65_warning  — member is age >= 65 (Medicare advisory).
--        The new DB-driven evaluator (packages/lib/src/enrollment/eligibility.ts, wired into the
--        enroll flow in BUILD C3) reads product_eligibility_rules. This seed expresses those two
--        hardcoded checks as CONFIGURED rules so the same advisories flow through the rule engine
--        for the self-serve / public path that warnings.ts never covered.
-- MAPPING (warnings.ts -> product_eligibility_rules):
--        1. has_mandate_warning  ->  rule_type='state',
--             config = {"mode":"exclude","states":["MA","NJ","DC","CA","RI","VT"]}
--             (a member IN a mandate state "fails" the exclude test -> advisory finding fires,
--              matching isMandateState()).
--        2. has_age65_warning    ->  rule_type='age',  config = {"min_age":0,"max_age":64}
--             (a member age >= 65 is outside the [0,64] band -> advisory finding fires,
--              matching isAge65OrOlder()).
-- SAFETY: BOTH rows are is_blocking = false (ADVISORY). Even with ELIGIBILITY_ENFORCE = 'true', an
--        advisory (warn) finding NEVER hard-gates plan selection and NEVER routes a submit to
--        pending_review — it only surfaces a notice. This preserves warnings.ts semantics exactly
--        (those checks were always advisory). warnings.ts itself is UNTOUCHED and still drives the
--        CRM advisor flow + status-card badges; this seed is additive and does not deprecate it.
-- SCOPE: seeds the rules onto PIFH's ACTIVE plans only (org 00000000-0000-0000-0000-000000000001;
--        the archived ac6e7228… org is intentionally excluded). Eligibility rules FK to plans(id);
--        org is reached through plans.organization_id (there is no organization_id column on the
--        rules table). RLS for these rows is the baseline product_eligibility_rules policy
--        (org-scoped via the plan) — no new RLS needed; this seed is run by the migration role.
-- NOTE: free-form text rule_type (no CHECK) + jsonb config — shapes mirror the admin writer
--        apps/admin/src/components/products/ProductEligibilityModal.tsx buildConfig().
-- Refs: baseline CREATE TABLE public.product_eligibility_rules L35487; FK plan_id->plans(id) L69824;
--        warnings.ts MANDATE_STATES + isAge65OrOlder; evaluator handlers (state/age) in
--        packages/lib/src/enrollment/eligibility.ts.
-- Rehearsal / dry-run: preview the plans that would receive rules, e.g.
--        SELECT id, name FROM public.plans
--          WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND is_active = true;
-- NOTE: no explicit BEGIN/COMMIT — the Supabase migration runner wraps each file in one transaction.

SET lock_timeout = '5s';

-- (1) has_mandate_warning -> ADVISORY state-exclude rule, one per active PIFH plan (idempotent).
INSERT INTO public.product_eligibility_rules
  (plan_id, rule_type, rule_name, description, config, is_blocking, error_message, sort_order, is_active)
SELECT
  p.id,
  'state',
  'Individual mandate state advisory',
  'Advisory: member resides in a state with an individual health insurance mandate. Health sharing plans may not satisfy the mandate requirement. Migrated from warnings.ts has_mandate_warning.',
  '{"mode":"exclude","states":["MA","NJ","DC","CA","RI","VT"]}'::jsonb,
  false,
  'This member resides in a state with an individual health insurance mandate. Health sharing plans may not satisfy the mandate requirement.',
  100,
  true
FROM public.plans p
WHERE p.organization_id = '00000000-0000-0000-0000-000000000001'
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.product_eligibility_rules r
    WHERE r.plan_id = p.id
      AND r.rule_type = 'state'
      AND r.rule_name = 'Individual mandate state advisory'
  );

-- (2) has_age65_warning -> ADVISORY age rule [0,64], one per active PIFH plan (idempotent).
INSERT INTO public.product_eligibility_rules
  (plan_id, rule_type, rule_name, description, config, is_blocking, error_message, sort_order, is_active)
SELECT
  p.id,
  'age',
  'Medicare age advisory (65+)',
  'Advisory: member is 65 or older and may be eligible for Medicare. Migrated from warnings.ts has_age65_warning.',
  '{"min_age":0,"max_age":64}'::jsonb,
  false,
  'This member is 65 or older and may be eligible for Medicare. Consider reviewing Medicare eligibility before proceeding.',
  101,
  true
FROM public.plans p
WHERE p.organization_id = '00000000-0000-0000-0000-000000000001'
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.product_eligibility_rules r
    WHERE r.plan_id = p.id
      AND r.rule_type = 'age'
      AND r.rule_name = 'Medicare age advisory (65+)'
  );

NOTIFY pgrst, 'reload schema';

-- Rollback (C3): remove only the two seeded advisory rule families.
--   DELETE FROM public.product_eligibility_rules
--     WHERE rule_type = 'state' AND rule_name = 'Individual mandate state advisory';
--   DELETE FROM public.product_eligibility_rules
--     WHERE rule_type = 'age'   AND rule_name = 'Medicare age advisory (65+)';
