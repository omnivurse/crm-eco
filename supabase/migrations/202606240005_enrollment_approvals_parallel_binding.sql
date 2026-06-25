-- Phase 0 / Enrollment Review: PARALLEL-BINDING approval + review tables (ADDITIVE, idempotent). [D-decision]
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Status: DRAFT — not applied. Lives in supabase/drafts/ so it does NOT auto-run.
--
-- DECISION (CTO-approved): PARALLEL BINDING. These two NEW tables REUSE the existing approval
--   definitions (crm_approval_rules / crm_approval_processes, already widened to allow
--   trigger_type='enrollment_submit' by draft 202606240003) and the shared evaluator
--   (@crm-eco/lib/rules), WITHOUT touching the live public.crm_approvals.record_id FK or its
--   has_crm_role RLS. crm_approvals is NOT made polymorphic. enrollment_approvals binds to
--   public.enrollments(id) instead of crm_records — that is the entire point of the parallel table.
--
-- Risk: LOW-MEDIUM. Pure additive: two CREATE TABLE IF NOT EXISTS, indexes IF NOT EXISTS, ENABLE
--   RLS, DROP POLICY IF EXISTS + CREATE POLICY, and BEFORE-trigger attach guarded by pg_trigger
--   existence. No existing table/column/policy/constraint is altered or dropped. Re-runnable.
--
-- SAFETY:
--   * RLS uses the ADMIN tenant model (organization_id = get_user_organization_id() + admin role),
--     mirroring the existing enrollments admin policies — NOT has_crm_role (per task safety rule).
--   * The auto-fire INSERT path (apps/portal submit route, D1) uses the SERVICE-ROLE client, which
--     bypasses RLS, so no anon/authenticated INSERT policy is granted for the public write path.
--   * Applicant visibility: there is NO members.user_id / member->auth FK in baseline (members link
--     to portal users by EMAIL only). So we deliberately do NOT add an enrollee-keyed SELECT policy
--     here — enrollment_approvals stays admin-internal; the portal exposes only an applicant-safe
--     projection of enrollment_reviews (visibility='applicant') via its existing service-role/SSR
--     path. Internal notes columns (context / entity_snapshot / internal review bodies) are never in
--     any applicant-facing policy. A true enrollee RLS policy is deferred until a member<->auth link
--     exists.
--
-- Refs (baseline 00000000000000_baseline.sql):
--   crm_approvals CREATE L27118 (mirrored column set; record_id REPLACED by enrollment_id);
--   crm_approvals status CHECK L27138 (pending/approved/rejected/changes_requested/cancelled/expired);
--   crm_approval_decisions CREATE L27042 (decision audit shape → enrollment_reviews mirrors decided_by/at);
--   idx_crm_approvals_idempotency L46902 (unique partial idx on idempotency_key — mirrored);
--   set_updated_at() L20040 + update_updated_at_column trigger idiom (crm_approvals L59404);
--   sync_org_tenant_key() L20809 + trg_sync_org_tenant_key on crm_approvals L60916 (dual-org fill);
--   get_user_organization_id() L13349; get_user_role() L13386; is_admin() L14167; is_super_admin() L14345;
--   enrollments FK target id L23236 / organization_id L23237;
--   enrollments admin RLS: "Admins can manage enrollments" L71670, "Admins can view all enrollments" L72116.
-- PRE-REQ chain: 202606240001 (pending_review/more_info status) + 202606240003 (enrollment_submit trigger_type).
-- NOTE: no explicit BEGIN/COMMIT — the Supabase migration runner wraps each file in one transaction
--   (matches existing phase-0 drafts which use only SET lock_timeout).

SET lock_timeout = '5s';

-- ===========================================================================
-- (1) enrollment_approvals — the parallel-binding parent row.
--     Mirrors the USEFUL crm_approvals columns but binds to enrollments(id).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.enrollment_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    organization_id uuid,                            -- dual-org idiom; trg_sync_org_tenant_key fills it
    enrollment_id uuid NOT NULL,                     -- PARALLEL-BINDING FK (NOT record_id/crm_records)
    process_id uuid NOT NULL,                        -- -> crm_approval_processes (reused, no FK required)
    rule_id uuid,                                    -- -> crm_approval_rules (reused, the matched rule)
    status text DEFAULT 'pending'::text NOT NULL,
    current_step integer DEFAULT 0,
    context jsonb DEFAULT '{}'::jsonb,               -- INTERNAL — never applicant-facing
    entity_snapshot jsonb,                           -- INTERNAL — never applicant-facing
    action_payload jsonb,
    requested_by uuid,                               -- nullable: public submit has no auth requester
    resolved_by uuid,                                -- admin profile that approved/rejected
    resolved_at timestamp with time zone,
    decided_by uuid,                                 -- denormalized convenience (admin profile)
    decided_at timestamp with time zone,
    decision_reason text,                            -- admin-entered reason (reject/more_info note label)
    expires_at timestamp with time zone,
    applied_at timestamp with time zone,
    idempotency_key text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enrollment_approvals_pkey PRIMARY KEY (id),
    CONSTRAINT enrollment_approvals_status_check CHECK ((status = ANY (ARRAY[
      'pending'::text,
      'approved'::text,
      'rejected'::text,
      'changes_requested'::text,
      'cancelled'::text,
      'expired'::text
    ])))
);

-- FK to enrollments (the parallel binding). Guarded — ADD CONSTRAINT has no IF NOT EXISTS in this PG line.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollment_approvals_enrollment_id_fkey'
      AND conrelid = 'public.enrollment_approvals'::regclass
  ) THEN
    ALTER TABLE public.enrollment_approvals
      ADD CONSTRAINT enrollment_approvals_enrollment_id_fkey
      FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- Indexes (covering the FK + admin queue lookups + idempotency dedup).
CREATE INDEX IF NOT EXISTS idx_enrollment_approvals_enrollment_id
  ON public.enrollment_approvals USING btree (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_approvals_org_status
  ON public.enrollment_approvals USING btree (organization_id, status);
-- Partial UNIQUE index = the conflict arbiter for the D1 submit-route upsert
--   (apps/portal .../enroll/submit/route.ts does .upsert({...}, { onConflict: 'enrollment_id',
--   ignoreDuplicates: true })). A partial unique index on (enrollment_id) WHERE status='pending'
--   both (a) guarantees AT MOST ONE OPEN approval per enrollment, and (b) serves as the inferable
--   ON CONFLICT (enrollment_id) arbiter PostgREST resolves for that upsert. It is partial on
--   status='pending' so a NEW review cycle (after a prior approval was resolved away from 'pending')
--   can still open a fresh row for the same enrollment.
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_approvals_open
  ON public.enrollment_approvals USING btree (enrollment_id)
  WHERE (status = 'pending'::text);
-- Mirror crm_approvals' unique partial idempotency index (belt-and-suspenders against double-insert).
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_approvals_idempotency
  ON public.enrollment_approvals USING btree (idempotency_key)
  WHERE (idempotency_key IS NOT NULL);

-- ===========================================================================
-- (2) enrollment_reviews — the review thread (decision notes + more-info requests).
--     Mirrors crm_approval_decisions' decided_by/decided_at/comment shape, plus a
--     visibility flag so applicant-facing rows can be separated from internal notes.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.enrollment_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    organization_id uuid,                            -- dual-org idiom; trg_sync_org_tenant_key fills it
    enrollment_id uuid NOT NULL,
    approval_id uuid,                                -- -> enrollment_approvals(id) (nullable for free notes)
    kind text NOT NULL,                              -- 'decision_note' | 'more_info_request' | 'applicant_response'
    visibility text DEFAULT 'internal'::text NOT NULL,  -- 'internal' (admin-only) | 'applicant' (enrollee-visible)
    body text,                                       -- the note / request message
    requested_fields jsonb DEFAULT '[]'::jsonb,      -- for more_info_request: which fields the enrollee must supply
    author_profile_id uuid,                          -- admin profile (null for applicant_response, set later by portal)
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enrollment_reviews_pkey PRIMARY KEY (id),
    CONSTRAINT enrollment_reviews_kind_check CHECK ((kind = ANY (ARRAY[
      'decision_note'::text,
      'more_info_request'::text,
      'applicant_response'::text
    ]))),
    CONSTRAINT enrollment_reviews_visibility_check CHECK ((visibility = ANY (ARRAY[
      'internal'::text,
      'applicant'::text
    ])))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollment_reviews_enrollment_id_fkey'
      AND conrelid = 'public.enrollment_reviews'::regclass
  ) THEN
    ALTER TABLE public.enrollment_reviews
      ADD CONSTRAINT enrollment_reviews_enrollment_id_fkey
      FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollment_reviews_approval_id_fkey'
      AND conrelid = 'public.enrollment_reviews'::regclass
  ) THEN
    ALTER TABLE public.enrollment_reviews
      ADD CONSTRAINT enrollment_reviews_approval_id_fkey
      FOREIGN KEY (approval_id) REFERENCES public.enrollment_approvals(id) ON DELETE CASCADE;
  END IF;
  -- FK to profiles for the author (mirrors the enrollments->profiles ON DELETE SET NULL
  -- idiom). Also lets PostgREST embed `author:profiles!enrollment_reviews_author_profile_id_fkey`
  -- on the admin [id] page.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollment_reviews_author_profile_id_fkey'
      AND conrelid = 'public.enrollment_reviews'::regclass
  ) THEN
    ALTER TABLE public.enrollment_reviews
      ADD CONSTRAINT enrollment_reviews_author_profile_id_fkey
      FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_enrollment_reviews_enrollment_id
  ON public.enrollment_reviews USING btree (enrollment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_reviews_approval_id
  ON public.enrollment_reviews USING btree (approval_id);
-- Partial index for the applicant-visible projection the portal reads.
CREATE INDEX IF NOT EXISTS idx_enrollment_reviews_applicant
  ON public.enrollment_reviews USING btree (enrollment_id, created_at DESC)
  WHERE (visibility = 'applicant'::text);

-- ===========================================================================
-- (3) Triggers — reuse the house idioms (updated_at stamp + dual-org sync).
--     Attaches guarded by pg_trigger existence so re-running is idempotent.
-- ===========================================================================
DO $$
BEGIN
  -- enrollment_approvals: updated_at + dual-org sync
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_enrollment_approvals'
                 AND tgrelid = 'public.enrollment_approvals'::regclass) THEN
    CREATE TRIGGER set_updated_at_enrollment_approvals BEFORE UPDATE ON public.enrollment_approvals
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_org_tenant_key_enrollment_approvals'
                 AND tgrelid = 'public.enrollment_approvals'::regclass) THEN
    CREATE TRIGGER trg_sync_org_tenant_key_enrollment_approvals BEFORE INSERT OR UPDATE ON public.enrollment_approvals
      FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key();
  END IF;

  -- enrollment_reviews: updated_at + dual-org sync
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_enrollment_reviews'
                 AND tgrelid = 'public.enrollment_reviews'::regclass) THEN
    CREATE TRIGGER set_updated_at_enrollment_reviews BEFORE UPDATE ON public.enrollment_reviews
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_org_tenant_key_enrollment_reviews'
                 AND tgrelid = 'public.enrollment_reviews'::regclass) THEN
    CREATE TRIGGER trg_sync_org_tenant_key_enrollment_reviews BEFORE INSERT OR UPDATE ON public.enrollment_reviews
      FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key();
  END IF;
END
$$;

-- ===========================================================================
-- (4) RLS — ADMIN tenant model (NOT has_crm_role). Mirrors the enrollments admin policies.
--     service_role bypasses RLS (the auto-fire submit insert path needs no policy).
-- ===========================================================================
ALTER TABLE public.enrollment_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_reviews   ENABLE ROW LEVEL SECURITY;

-- 4.1 enrollment_approvals: admin/staff read within their org (mirror "Admins can view all enrollments").
DROP POLICY IF EXISTS "Admins can view enrollment approvals" ON public.enrollment_approvals;
CREATE POLICY "Admins can view enrollment approvals"
  ON public.enrollment_approvals
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

-- 4.2 enrollment_approvals: admins manage within their org (mirror "Admins can manage enrollments").
DROP POLICY IF EXISTS "Admins can manage enrollment approvals" ON public.enrollment_approvals;
CREATE POLICY "Admins can manage enrollment approvals"
  ON public.enrollment_approvals
  FOR ALL
  TO authenticated
  USING      (public.is_admin() AND (public.is_super_admin() OR organization_id = public.get_user_organization_id()))
  WITH CHECK (public.is_admin() AND (public.is_super_admin() OR organization_id = public.get_user_organization_id()));

-- 4.3 enrollment_approvals: explicit service_role bypass (mirror service_role_all_enrollment_audit_log L82335).
DROP POLICY IF EXISTS service_role_all_enrollment_approvals ON public.enrollment_approvals;
CREATE POLICY service_role_all_enrollment_approvals
  ON public.enrollment_approvals
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4.4 enrollment_reviews: admin/staff read within their org (ALL rows, including internal notes).
DROP POLICY IF EXISTS "Admins can view enrollment reviews" ON public.enrollment_reviews;
CREATE POLICY "Admins can view enrollment reviews"
  ON public.enrollment_reviews
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

-- 4.5 enrollment_reviews: admins manage within their org.
DROP POLICY IF EXISTS "Admins can manage enrollment reviews" ON public.enrollment_reviews;
CREATE POLICY "Admins can manage enrollment reviews"
  ON public.enrollment_reviews
  FOR ALL
  TO authenticated
  USING      (public.is_admin() AND (public.is_super_admin() OR organization_id = public.get_user_organization_id()))
  WITH CHECK (public.is_admin() AND (public.is_super_admin() OR organization_id = public.get_user_organization_id()));

-- 4.6 enrollment_reviews: explicit service_role bypass (the portal applicant projection reads via service-role).
DROP POLICY IF EXISTS service_role_all_enrollment_reviews ON public.enrollment_reviews;
CREATE POLICY service_role_all_enrollment_reviews
  ON public.enrollment_reviews
  TO service_role
  USING (true)
  WITH CHECK (true);

-- NOTE: NO applicant-keyed authenticated SELECT policy is added (no member<->auth FK in baseline).
--   Applicant-visible review rows (visibility='applicant') are surfaced to the enrollee ONLY through
--   the portal's service-role/SSR path with an explicit visibility='applicant' filter — internal
--   rows (visibility='internal'), context, and entity_snapshot are never exposed there.

NOTIFY pgrst, 'reload schema';

-- Rollback (D-decision): both tables are NEW and additive — safe to drop entirely on rollback,
--   provided no other slice depends on them yet.
--   DROP TABLE IF EXISTS public.enrollment_reviews;     -- (children/indexes/policies/triggers cascade)
--   DROP TABLE IF EXISTS public.enrollment_approvals;
