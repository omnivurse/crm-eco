-- ============================================================================
-- Member Rate Book — persisted cash-price clips (portal)
-- ----------------------------------------------------------------------------
-- Live state (2026-08-22, project sffisarikcreyyjzdjvb):
--   public.rate_books / public.rate_clips do not exist.
--   private.get_user_member_id() and private.get_user_organization_id() exist.
--   public.get_user_organization_id() / public.get_user_role() / public.set_updated_at() exist.
--
-- Purpose: named lists of dated HCL snapshots for an active member. A clip is
-- a snapshot, not a live HCL id. RLS is member-self via private.get_user_member_id().
--
-- Additive + idempotent. PROD WRITE RISK: YES (new tables + policies).
-- Do not apply until explicitly approved.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.rate_clips;
--   DROP TABLE IF EXISTS public.rate_books;
-- ============================================================================

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.rate_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Saved rates',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_books_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 60)
);

CREATE TABLE IF NOT EXISTS public.rate_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  rate_book_id uuid NOT NULL REFERENCES public.rate_books(id) ON DELETE CASCADE,
  hcl_rate_id text NOT NULL,
  hospital_id bigint,
  facility_name text NOT NULL,
  city text,
  state text,
  procedure_code text NOT NULL,
  code_description text,
  category text,
  rate numeric(12,2) NOT NULL,
  payment_method text,
  cms_relativity numeric,
  query_state_name text,
  query_msa_name text,
  query_specialty text,
  slice_high numeric(12,2),
  slice_median numeric(12,2),
  file_size bigint,
  notes text,
  clipped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_books_member
  ON public.rate_books (member_id);

CREATE UNIQUE INDEX IF NOT EXISTS rate_books_one_default_uidx
  ON public.rate_books (member_id)
  WHERE is_default;

CREATE UNIQUE INDEX IF NOT EXISTS rate_books_member_name_uidx
  ON public.rate_books (member_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_rate_clips_member
  ON public.rate_clips (member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_clips_book
  ON public.rate_clips (rate_book_id);

CREATE UNIQUE INDEX IF NOT EXISTS rate_clips_identity_uidx
  ON public.rate_clips (rate_book_id, hcl_rate_id, procedure_code, COALESCE(hospital_id, -1));

DROP TRIGGER IF EXISTS set_updated_at_rate_books ON public.rate_books;
CREATE TRIGGER set_updated_at_rate_books
  BEFORE UPDATE ON public.rate_books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_rate_clips ON public.rate_clips;
CREATE TRIGGER set_updated_at_rate_clips
  BEFORE UPDATE ON public.rate_clips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.rate_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_books FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rate_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_clips FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rate_books FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_books FROM anon;
REVOKE ALL ON TABLE public.rate_clips FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_clips FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_books TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_clips TO authenticated;
GRANT ALL ON TABLE public.rate_books TO service_role;
GRANT ALL ON TABLE public.rate_clips TO service_role;

DROP POLICY IF EXISTS "Members can view their own rate books" ON public.rate_books;
CREATE POLICY "Members can view their own rate books"
  ON public.rate_books FOR SELECT TO authenticated
  USING (member_id = private.get_user_member_id());

DROP POLICY IF EXISTS "Members can add their own rate books" ON public.rate_books;
CREATE POLICY "Members can add their own rate books"
  ON public.rate_books FOR INSERT TO authenticated
  WITH CHECK (
    member_id = private.get_user_member_id()
    AND organization_id = private.get_user_organization_id()
  );

DROP POLICY IF EXISTS "Members can update their own rate books" ON public.rate_books;
CREATE POLICY "Members can update their own rate books"
  ON public.rate_books FOR UPDATE TO authenticated
  USING (member_id = private.get_user_member_id())
  WITH CHECK (member_id = private.get_user_member_id());

DROP POLICY IF EXISTS "Members can delete their own rate books" ON public.rate_books;
CREATE POLICY "Members can delete their own rate books"
  ON public.rate_books FOR DELETE TO authenticated
  USING (member_id = private.get_user_member_id());

DROP POLICY IF EXISTS "Members can view their own rate clips" ON public.rate_clips;
CREATE POLICY "Members can view their own rate clips"
  ON public.rate_clips FOR SELECT TO authenticated
  USING (member_id = private.get_user_member_id());

DROP POLICY IF EXISTS "Members can add their own rate clips" ON public.rate_clips;
CREATE POLICY "Members can add their own rate clips"
  ON public.rate_clips FOR INSERT TO authenticated
  WITH CHECK (
    member_id = private.get_user_member_id()
    AND organization_id = private.get_user_organization_id()
  );

DROP POLICY IF EXISTS "Members can update their own rate clips" ON public.rate_clips;
CREATE POLICY "Members can update their own rate clips"
  ON public.rate_clips FOR UPDATE TO authenticated
  USING (member_id = private.get_user_member_id())
  WITH CHECK (member_id = private.get_user_member_id());

DROP POLICY IF EXISTS "Members can delete their own rate clips" ON public.rate_clips;
CREATE POLICY "Members can delete their own rate clips"
  ON public.rate_clips FOR DELETE TO authenticated
  USING (member_id = private.get_user_member_id());

DROP POLICY IF EXISTS "Staff can view org rate books" ON public.rate_books;
CREATE POLICY "Staff can view org rate books"
  ON public.rate_books FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() IN ('owner', 'admin', 'staff')
    AND private.get_user_member_id() IS NULL
  );

DROP POLICY IF EXISTS "Staff can view org rate clips" ON public.rate_clips;
CREATE POLICY "Staff can view org rate clips"
  ON public.rate_clips FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() IN ('owner', 'admin', 'staff')
    AND private.get_user_member_id() IS NULL
  );

DROP POLICY IF EXISTS service_role_all_rate_books ON public.rate_books;
CREATE POLICY service_role_all_rate_books
  ON public.rate_books TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_rate_clips ON public.rate_clips;
CREATE POLICY service_role_all_rate_clips
  ON public.rate_clips TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.rate_books IS
  'Member-named collections of published hospital cash clips. One default book per member.';
COMMENT ON TABLE public.rate_clips IS
  'Dated snapshot of one HCL tick. Not a live file pointer. Not an insurance quote.';
