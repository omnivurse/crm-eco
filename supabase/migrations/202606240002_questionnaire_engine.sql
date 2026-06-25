-- Phase 0 / Questionnaire engine: normalized, org-scoped questionnaire schema. [B1]
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Status: DRAFT — not applied. Lives in supabase/drafts/ so it does NOT auto-run.
-- Risk: LOW — purely ADDITIVE: 5 new tables + 1 nullable FK column on plans + indexes,
--        RLS, helper fns, triggers. No existing object is altered or dropped. Idempotent
--        (IF NOT EXISTS / DROP-then-CREATE for policies, triggers, functions).
-- Rollback: see -- Rollback: block at end of file.
--
-- Design refs (all real, from 00000000000000_baseline.sql unless noted):
--   * org tenancy predicate  : public.get_user_organization_id()  (baseline L13349; SECURITY
--                              DEFINER, search_path-pinned). This IS the "admin organization_id
--                              model" — NOT has_crm_role. Mirrors commission_payout write RLS
--                              (migration 202606190001) and enrollment_steps (baseline L74497).
--   * role gate              : public.get_user_role()             (baseline L13386 → text)
--   * updated_at helper      : public.set_updated_at()            (baseline L20040; search_path
--                              pinned by migration 202606130003_linter_phase1_search_path).
--   * org FK shape           : enrollment_steps.organization_id_fkey -> organizations(id)
--                              ON DELETE CASCADE (baseline L67249); enrollment_id_fkey
--                              ON DELETE CASCADE (baseline L67241).
--   * enrollments FK target  : public.enrollments(id)             (baseline L23235)
--   * plans FK target        : public.plans(id)                   (baseline L35004) — the
--                              PLAN-KEYED catalog. plan linkage is added here as a nullable
--                              questionnaire_template_id on plans (which plan requires which
--                              questionnaire). Keyed on plans(id), consistent with
--                              enrollments.selected_plan_id -> plans(id).
--   * FK covering-index idiom: idx_<table>_<col>_fkey  (migration 202606150001)
--   * partial-unique idiom   : idx_email_signatures_default ... WHERE (is_default = true)
--                              (baseline L50150)
--   * shared operator vocab  : packages/lib/src/rules/operators.ts RULE_CONDITION_OPERATORS
--                              (= apps/crm/src/lib/approvals/types.ts ApprovalConditionOperator):
--                              eq, neq, gt, lt, gte, lte, contains, in, not_in,
--                              is_empty, is_not_empty.
-- NOTE: no explicit BEGIN/COMMIT — the Supabase migration runner wraps each file in one
--       transaction (matches templates 202606190001 / 202606230001 which use only SET lock_timeout).

SET lock_timeout = '5s';

-- ===========================================================================
-- (0) SHARED OPERATOR VOCABULARY — single source of truth at the DB layer.
--     A SQL helper so both the CHECK constraints and the logic-validate trigger
--     reference ONE array, kept byte-identical to RULE_CONDITION_OPERATORS in
--     packages/lib/src/rules/operators.ts. SECURITY DEFINER not needed (no table
--     access); IMMUTABLE + search_path-pinned per house linter policy (phase 1).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.questionnaire_logic_operators()
  RETURNS text[]
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'public'
  AS $$
  SELECT ARRAY[
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte',
    'contains', 'in', 'not_in', 'is_empty', 'is_not_empty'
  ]::text[]
$$;

COMMENT ON FUNCTION public.questionnaire_logic_operators() IS
  'Shared rule-condition operator vocabulary (mirror of packages/lib/src/rules/operators.ts RULE_CONDITION_OPERATORS / approvals ApprovalConditionOperator). Single source of truth for questionnaire_logic.condition operators.';

-- ===========================================================================
-- (1) TABLES
-- ===========================================================================

-- 1.1 questionnaire_templates — one row per (org, key, version). is_default marks the
--     active default template for an org. Org-scoped exactly like enrollment_steps.
CREATE TABLE IF NOT EXISTS public.questionnaire_templates (
  id              uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  key             text NOT NULL,
  name            text NOT NULL,
  version         integer DEFAULT 1 NOT NULL,
  status          text DEFAULT 'draft'::text NOT NULL,
  is_default      boolean DEFAULT false NOT NULL,
  description     text,
  metadata        jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT questionnaire_templates_pkey PRIMARY KEY (id),
  CONSTRAINT questionnaire_templates_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_templates_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT questionnaire_templates_version_check CHECK (version >= 1),
  CONSTRAINT questionnaire_templates_org_key_version_uniq
    UNIQUE (organization_id, key, version)
);

-- 1.2 questionnaire_questions — ordered questions belonging to a template.
CREATE TABLE IF NOT EXISTS public.questionnaire_questions (
  id              uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  template_id     uuid NOT NULL,
  key             text NOT NULL,
  label           text NOT NULL,
  type            text NOT NULL,
  options         jsonb DEFAULT '[]'::jsonb NOT NULL,
  ordinal         integer DEFAULT 0 NOT NULL,
  section         text,
  required        boolean DEFAULT false NOT NULL,
  help_text       text,
  metadata        jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT questionnaire_questions_pkey PRIMARY KEY (id),
  CONSTRAINT questionnaire_questions_template_id_fkey
    FOREIGN KEY (template_id) REFERENCES public.questionnaire_templates(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_questions_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_questions_type_check
    CHECK (type = ANY (ARRAY[
      'text'::text, 'number'::text, 'radio'::text, 'checkbox'::text,
      'select'::text, 'date'::text, 'upload'::text, 'section'::text
    ])),
  CONSTRAINT questionnaire_questions_template_key_uniq UNIQUE (template_id, key)
);

-- 1.3 questionnaire_logic — show/hide/require/skip rules wiring one question to another
--     WITHIN THE SAME TEMPLATE. condition jsonb carries operator from the shared vocab
--     ({ "field": ..., "operator": "eq"|..., "value": ... }). Same-template integrity and
--     operator-vocab are enforced by trg_questionnaire_logic_validate (below).
CREATE TABLE IF NOT EXISTS public.questionnaire_logic (
  id                 uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id    uuid NOT NULL,
  template_id        uuid NOT NULL,
  source_question_id uuid NOT NULL,
  target_question_id uuid NOT NULL,
  action             text NOT NULL,
  condition          jsonb DEFAULT '{}'::jsonb NOT NULL,
  ordinal            integer DEFAULT 0 NOT NULL,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT questionnaire_logic_pkey PRIMARY KEY (id),
  CONSTRAINT questionnaire_logic_template_id_fkey
    FOREIGN KEY (template_id) REFERENCES public.questionnaire_templates(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_logic_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_logic_source_question_id_fkey
    FOREIGN KEY (source_question_id) REFERENCES public.questionnaire_questions(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_logic_target_question_id_fkey
    FOREIGN KEY (target_question_id) REFERENCES public.questionnaire_questions(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_logic_action_check
    CHECK (action = ANY (ARRAY['show'::text, 'hide'::text, 'require'::text, 'skip'::text])),
  -- Belt-and-braces operator-vocab guard at the row level. The trigger gives the friendly
  -- error + same-template integrity; this CHECK is the immutable fallback. Tolerates an
  -- absent operator (logic rows may be authored before the condition is filled in).
  CONSTRAINT questionnaire_logic_operator_check
    CHECK (
      condition ->> 'operator' IS NULL
      OR (condition ->> 'operator') = ANY (ARRAY[
        'eq', 'neq', 'gt', 'lt', 'gte', 'lte',
        'contains', 'in', 'not_in', 'is_empty', 'is_not_empty'
      ])
    )
);

-- 1.4 questionnaire_responses — one response container per (enrollment, template).
--     enrollment_id FK -> enrollments (ON DELETE CASCADE matches enrollment_steps).
CREATE TABLE IF NOT EXISTS public.questionnaire_responses (
  id              uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  enrollment_id   uuid NOT NULL,
  template_id     uuid NOT NULL,
  status          text DEFAULT 'in_progress'::text NOT NULL,
  submitted_at    timestamp with time zone,
  metadata        jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT questionnaire_responses_pkey PRIMARY KEY (id),
  CONSTRAINT questionnaire_responses_enrollment_id_fkey
    FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_responses_template_id_fkey
    FOREIGN KEY (template_id) REFERENCES public.questionnaire_templates(id) ON DELETE RESTRICT,
  CONSTRAINT questionnaire_responses_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_responses_status_check
    CHECK (status = ANY (ARRAY[
      'in_progress'::text, 'submitted'::text, 'approved'::text, 'rejected'::text
    ])),
  CONSTRAINT questionnaire_responses_enrollment_template_uniq
    UNIQUE (enrollment_id, template_id)
);

-- 1.5 questionnaire_answers — normalized answers (SOURCE OF TRUTH; snapshot.questionnaire is
--     a derived mirror). value jsonb is canonical; typed shadow columns for indexable filters.
--     question_id FK ON DELETE RESTRICT so a question cannot be deleted out from under a
--     recorded answer (answer history is protected); question_key denormalized for stable
--     reference if a template is re-versioned.
CREATE TABLE IF NOT EXISTS public.questionnaire_answers (
  id              uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  response_id     uuid NOT NULL,
  question_id     uuid NOT NULL,
  question_key    text NOT NULL,
  value           jsonb,
  value_text      text,
  value_number    numeric,
  value_boolean   boolean,
  value_date      date,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT questionnaire_answers_pkey PRIMARY KEY (id),
  CONSTRAINT questionnaire_answers_response_id_fkey
    FOREIGN KEY (response_id) REFERENCES public.questionnaire_responses(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_answers_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questionnaire_questions(id) ON DELETE RESTRICT,
  CONSTRAINT questionnaire_answers_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_answers_response_question_uniq UNIQUE (response_id, question_id)
);

-- ===========================================================================
-- (2) PLAN LINKAGE — additive nullable column on plans: which questionnaire a plan requires.
--     Keyed on plans(id) per the resolved plan-keyed catalog model. Nullable: most plans
--     require no questionnaire. NOT VALID would be moot (table just created); plain FK is fine
--     since existing rows have NULL.
-- ===========================================================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS questionnaire_template_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plans_questionnaire_template_id_fkey'
      AND conrelid = 'public.plans'::regclass
  ) THEN
    ALTER TABLE public.plans
      ADD CONSTRAINT plans_questionnaire_template_id_fkey
      FOREIGN KEY (questionnaire_template_id)
      REFERENCES public.questionnaire_templates(id) ON DELETE SET NULL;
  END IF;
END
$$;

COMMENT ON COLUMN public.plans.questionnaire_template_id IS
  'Optional questionnaire required by this plan (FK -> questionnaire_templates.id). NULL = no questionnaire. Plan-keyed per the resolved catalog model.';

-- ===========================================================================
-- (3) INDEXES — FK covering indexes (idx_<table>_<col>_fkey idiom, migration 202606150001)
--     + partial-unique on default template per org (idx_email_signatures_default idiom).
-- ===========================================================================

-- questionnaire_templates
CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_organization_id_fkey
  ON public.questionnaire_templates (organization_id); -- questionnaire_templates_organization_id_fkey
-- Exactly one default template per org.
CREATE UNIQUE INDEX IF NOT EXISTS idx_questionnaire_templates_org_default
  ON public.questionnaire_templates (organization_id) WHERE (is_default = true);

-- questionnaire_questions
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_template_id_fkey
  ON public.questionnaire_questions (template_id); -- questionnaire_questions_template_id_fkey
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_organization_id_fkey
  ON public.questionnaire_questions (organization_id); -- questionnaire_questions_organization_id_fkey
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_template_ordinal
  ON public.questionnaire_questions (template_id, ordinal); -- ordered render path

-- questionnaire_logic
CREATE INDEX IF NOT EXISTS idx_questionnaire_logic_template_id_fkey
  ON public.questionnaire_logic (template_id); -- questionnaire_logic_template_id_fkey
CREATE INDEX IF NOT EXISTS idx_questionnaire_logic_organization_id_fkey
  ON public.questionnaire_logic (organization_id); -- questionnaire_logic_organization_id_fkey
CREATE INDEX IF NOT EXISTS idx_questionnaire_logic_source_question_id_fkey
  ON public.questionnaire_logic (source_question_id); -- questionnaire_logic_source_question_id_fkey
CREATE INDEX IF NOT EXISTS idx_questionnaire_logic_target_question_id_fkey
  ON public.questionnaire_logic (target_question_id); -- questionnaire_logic_target_question_id_fkey

-- questionnaire_responses
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_enrollment_id_fkey
  ON public.questionnaire_responses (enrollment_id); -- questionnaire_responses_enrollment_id_fkey
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_template_id_fkey
  ON public.questionnaire_responses (template_id); -- questionnaire_responses_template_id_fkey
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_organization_id_fkey
  ON public.questionnaire_responses (organization_id); -- questionnaire_responses_organization_id_fkey

-- questionnaire_answers
CREATE INDEX IF NOT EXISTS idx_questionnaire_answers_response_id_fkey
  ON public.questionnaire_answers (response_id); -- questionnaire_answers_response_id_fkey
CREATE INDEX IF NOT EXISTS idx_questionnaire_answers_question_id_fkey
  ON public.questionnaire_answers (question_id); -- questionnaire_answers_question_id_fkey
CREATE INDEX IF NOT EXISTS idx_questionnaire_answers_organization_id_fkey
  ON public.questionnaire_answers (organization_id); -- questionnaire_answers_organization_id_fkey

-- plans (covers the new FK)
CREATE INDEX IF NOT EXISTS idx_plans_questionnaire_template_id_fkey
  ON public.plans (questionnaire_template_id); -- plans_questionnaire_template_id_fkey

-- ===========================================================================
-- (4) updated_at TRIGGERS — reuse the search_path-pinned public.set_updated_at()
--     (baseline L20040; pinned by 202606130003). Drop-then-create = idempotent.
-- ===========================================================================
DROP TRIGGER IF EXISTS set_questionnaire_templates_updated_at ON public.questionnaire_templates;
CREATE TRIGGER set_questionnaire_templates_updated_at
  BEFORE UPDATE ON public.questionnaire_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_questionnaire_questions_updated_at ON public.questionnaire_questions;
CREATE TRIGGER set_questionnaire_questions_updated_at
  BEFORE UPDATE ON public.questionnaire_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_questionnaire_logic_updated_at ON public.questionnaire_logic;
CREATE TRIGGER set_questionnaire_logic_updated_at
  BEFORE UPDATE ON public.questionnaire_logic
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_questionnaire_responses_updated_at ON public.questionnaire_responses;
CREATE TRIGGER set_questionnaire_responses_updated_at
  BEFORE UPDATE ON public.questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_questionnaire_answers_updated_at ON public.questionnaire_answers;
CREATE TRIGGER set_questionnaire_answers_updated_at
  BEFORE UPDATE ON public.questionnaire_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===========================================================================
-- (5) LOGIC-VALIDATE TRIGGER — enforces (a) source & target questions belong to the SAME
--     template the logic row references, and (b) the condition operator (when present) is in
--     the shared vocabulary. SECURITY DEFINER + search_path-pinned per house linter policy.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.validate_questionnaire_logic()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
DECLARE
  v_src_template uuid;
  v_tgt_template uuid;
  v_operator     text;
BEGIN
  -- (a) Same-template integrity: both questions must live in NEW.template_id.
  SELECT template_id INTO v_src_template
  FROM public.questionnaire_questions
  WHERE id = NEW.source_question_id;

  SELECT template_id INTO v_tgt_template
  FROM public.questionnaire_questions
  WHERE id = NEW.target_question_id;

  IF v_src_template IS NULL OR v_tgt_template IS NULL THEN
    RAISE EXCEPTION 'questionnaire_logic: source/target question not found'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_src_template <> NEW.template_id OR v_tgt_template <> NEW.template_id THEN
    RAISE EXCEPTION 'questionnaire_logic: source and target questions must belong to template % (got source=%, target=%)',
      NEW.template_id, v_src_template, v_tgt_template
      USING ERRCODE = 'check_violation';
  END IF;

  -- (b) Operator-vocab guard against the shared vocabulary (when an operator is present).
  v_operator := NEW.condition ->> 'operator';
  IF v_operator IS NOT NULL
     AND NOT (v_operator = ANY (public.questionnaire_logic_operators())) THEN
    RAISE EXCEPTION 'questionnaire_logic: operator % is not in the shared rule operator vocabulary %',
      v_operator, public.questionnaire_logic_operators()
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_questionnaire_logic() IS
  'BEFORE INSERT/UPDATE guard on questionnaire_logic: enforces same-template source/target integrity and the shared rule operator vocabulary (questionnaire_logic_operators()).';

DROP TRIGGER IF EXISTS trg_questionnaire_logic_validate ON public.questionnaire_logic;
CREATE TRIGGER trg_questionnaire_logic_validate
  BEFORE INSERT OR UPDATE ON public.questionnaire_logic
  FOR EACH ROW EXECUTE FUNCTION public.validate_questionnaire_logic();

-- ===========================================================================
-- (6) SELF-SERVE READ PATH (SECURITY DEFINER) — let an authenticated enrollee/member read
--     the PUBLISHED template structure (template + questions + logic) for their org without
--     granting broad table read. Returns the resolved questionnaire for a plan, scoped to the
--     caller's org via get_user_organization_id(). Writes stay admin-only (see RLS below).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_questionnaire_for_plan(p_plan_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
DECLARE
  v_org      uuid := public.get_user_organization_id();
  v_template public.questionnaire_templates%ROWTYPE;
  v_result   jsonb;
BEGIN
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  -- Resolve the template the plan requires, scoped to the caller's org. The plan must
  -- belong to the caller's org AND the template must be published.
  SELECT t.* INTO v_template
  FROM public.plans p
  JOIN public.questionnaire_templates t
    ON t.id = p.questionnaire_template_id
  WHERE p.id = p_plan_id
    AND p.organization_id = v_org
    AND t.organization_id = v_org
    AND t.status = 'published'
  LIMIT 1;

  IF v_template.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'template', jsonb_build_object(
      'id', v_template.id,
      'key', v_template.key,
      'name', v_template.name,
      'version', v_template.version,
      'status', v_template.status
    ),
    'questions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'key', q.key,
          'label', q.label,
          'type', q.type,
          'options', q.options,
          'ordinal', q.ordinal,
          'section', q.section,
          'required', q.required,
          'help_text', q.help_text
        ) ORDER BY q.ordinal, q.created_at
      )
      FROM public.questionnaire_questions q
      WHERE q.template_id = v_template.id
    ), '[]'::jsonb),
    'logic', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'source_question_id', l.source_question_id,
          'target_question_id', l.target_question_id,
          'action', l.action,
          'condition', l.condition,
          'ordinal', l.ordinal
        ) ORDER BY l.ordinal, l.created_at
      )
      FROM public.questionnaire_logic l
      WHERE l.template_id = v_template.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_questionnaire_for_plan(uuid) IS
  'Self-serve read: returns the PUBLISHED questionnaire (template + questions + logic) required by a plan, scoped to the caller''s organization via get_user_organization_id(). SECURITY DEFINER so enrollees can read template structure without broad table grants.';

-- Self-serve callers are authenticated members/enrollees + service_role (portal). No anon.
REVOKE ALL ON FUNCTION public.get_questionnaire_for_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_questionnaire_for_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_questionnaire_for_plan(uuid) TO service_role;

-- ===========================================================================
-- (7) RLS — ENABLE + split-per-command on the admin organization_id model.
--     WRITE: organization_id = get_user_organization_id() AND get_user_role() IN
--            ('owner','admin','staff')  — mirrors commission_payout (202606190001) /
--            enrollment_steps (baseline L74497). NOT has_crm_role.
--     READ : authenticated org members may SELECT rows in their org (templates/questions/logic
--            also reachable via the SECURITY DEFINER fn above; direct SELECT supports the
--            admin builder UI). service_role full access (matches service_role_all_* pattern,
--            baseline L82342) for the portal's per-step persist (apps/portal enroll actions).
-- ===========================================================================

ALTER TABLE public.questionnaire_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_logic      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_answers    ENABLE ROW LEVEL SECURITY;

-- ---- questionnaire_templates ------------------------------------------------
DROP POLICY IF EXISTS "Org members can view questionnaire templates" ON public.questionnaire_templates;
CREATE POLICY "Org members can view questionnaire templates"
  ON public.questionnaire_templates
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Org staff can insert questionnaire templates" ON public.questionnaire_templates;
CREATE POLICY "Org staff can insert questionnaire templates"
  ON public.questionnaire_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can update questionnaire templates" ON public.questionnaire_templates;
CREATE POLICY "Org staff can update questionnaire templates"
  ON public.questionnaire_templates
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can delete questionnaire templates" ON public.questionnaire_templates;
CREATE POLICY "Org staff can delete questionnaire templates"
  ON public.questionnaire_templates
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS service_role_all_questionnaire_templates ON public.questionnaire_templates;
CREATE POLICY service_role_all_questionnaire_templates
  ON public.questionnaire_templates TO service_role USING (true) WITH CHECK (true);

-- ---- questionnaire_questions ------------------------------------------------
DROP POLICY IF EXISTS "Org members can view questionnaire questions" ON public.questionnaire_questions;
CREATE POLICY "Org members can view questionnaire questions"
  ON public.questionnaire_questions
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Org staff can insert questionnaire questions" ON public.questionnaire_questions;
CREATE POLICY "Org staff can insert questionnaire questions"
  ON public.questionnaire_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can update questionnaire questions" ON public.questionnaire_questions;
CREATE POLICY "Org staff can update questionnaire questions"
  ON public.questionnaire_questions
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can delete questionnaire questions" ON public.questionnaire_questions;
CREATE POLICY "Org staff can delete questionnaire questions"
  ON public.questionnaire_questions
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS service_role_all_questionnaire_questions ON public.questionnaire_questions;
CREATE POLICY service_role_all_questionnaire_questions
  ON public.questionnaire_questions TO service_role USING (true) WITH CHECK (true);

-- ---- questionnaire_logic ----------------------------------------------------
DROP POLICY IF EXISTS "Org members can view questionnaire logic" ON public.questionnaire_logic;
CREATE POLICY "Org members can view questionnaire logic"
  ON public.questionnaire_logic
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Org staff can insert questionnaire logic" ON public.questionnaire_logic;
CREATE POLICY "Org staff can insert questionnaire logic"
  ON public.questionnaire_logic
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can update questionnaire logic" ON public.questionnaire_logic;
CREATE POLICY "Org staff can update questionnaire logic"
  ON public.questionnaire_logic
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can delete questionnaire logic" ON public.questionnaire_logic;
CREATE POLICY "Org staff can delete questionnaire logic"
  ON public.questionnaire_logic
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS service_role_all_questionnaire_logic ON public.questionnaire_logic;
CREATE POLICY service_role_all_questionnaire_logic
  ON public.questionnaire_logic TO service_role USING (true) WITH CHECK (true);

-- ---- questionnaire_responses ------------------------------------------------
-- Org staff full CRUD; service_role drives the enrollee/portal write path (per-step persist).
DROP POLICY IF EXISTS "Org members can view questionnaire responses" ON public.questionnaire_responses;
CREATE POLICY "Org members can view questionnaire responses"
  ON public.questionnaire_responses
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Org staff can insert questionnaire responses" ON public.questionnaire_responses;
CREATE POLICY "Org staff can insert questionnaire responses"
  ON public.questionnaire_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can update questionnaire responses" ON public.questionnaire_responses;
CREATE POLICY "Org staff can update questionnaire responses"
  ON public.questionnaire_responses
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can delete questionnaire responses" ON public.questionnaire_responses;
CREATE POLICY "Org staff can delete questionnaire responses"
  ON public.questionnaire_responses
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS service_role_all_questionnaire_responses ON public.questionnaire_responses;
CREATE POLICY service_role_all_questionnaire_responses
  ON public.questionnaire_responses TO service_role USING (true) WITH CHECK (true);

-- ---- questionnaire_answers --------------------------------------------------
DROP POLICY IF EXISTS "Org members can view questionnaire answers" ON public.questionnaire_answers;
CREATE POLICY "Org members can view questionnaire answers"
  ON public.questionnaire_answers
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Org staff can insert questionnaire answers" ON public.questionnaire_answers;
CREATE POLICY "Org staff can insert questionnaire answers"
  ON public.questionnaire_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can update questionnaire answers" ON public.questionnaire_answers;
CREATE POLICY "Org staff can update questionnaire answers"
  ON public.questionnaire_answers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Org staff can delete questionnaire answers" ON public.questionnaire_answers;
CREATE POLICY "Org staff can delete questionnaire answers"
  ON public.questionnaire_answers
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS service_role_all_questionnaire_answers ON public.questionnaire_answers;
CREATE POLICY service_role_all_questionnaire_answers
  ON public.questionnaire_answers TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ===========================================================================
-- Rollback (B1) — drop in reverse dependency order. All objects are new in this file;
-- the only pre-existing table touched is plans (additive column + FK).
-- ===========================================================================
--   DROP FUNCTION IF EXISTS public.get_questionnaire_for_plan(uuid);
--   DROP TRIGGER IF EXISTS trg_questionnaire_logic_validate ON public.questionnaire_logic;
--   DROP FUNCTION IF EXISTS public.validate_questionnaire_logic();
--   DROP TABLE IF EXISTS public.questionnaire_answers;
--   DROP TABLE IF EXISTS public.questionnaire_responses;
--   DROP TABLE IF EXISTS public.questionnaire_logic;
--   DROP TABLE IF EXISTS public.questionnaire_questions;
--   ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_questionnaire_template_id_fkey;
--   DROP INDEX IF EXISTS public.idx_plans_questionnaire_template_id_fkey;
--   ALTER TABLE public.plans DROP COLUMN IF EXISTS questionnaire_template_id;
--   DROP TABLE IF EXISTS public.questionnaire_templates;
--   DROP FUNCTION IF EXISTS public.questionnaire_logic_operators();
--   -- (set_updated_at, get_user_organization_id, get_user_role are pre-existing — NOT dropped.)
