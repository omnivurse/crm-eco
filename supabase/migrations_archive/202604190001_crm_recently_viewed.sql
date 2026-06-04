-- Per-user "recently viewed" log for CRM records. Powers the rail at the
-- top of the record list pages in Layout V2 and the "jump back in"
-- experience in the global search.
--
-- Design notes:
--   - One row per (user, record); re-visits UPSERT the last_viewed_at
--     so we don't grow the table unbounded.
--   - Scoped by organization_id so the rail respects org boundaries.
--   - RLS: a user only sees their own rows.
--   - A purge job can clip rows older than 90 days if volume becomes
--     a concern — the index supports that query cheaply.

CREATE TABLE IF NOT EXISTS public.crm_recently_viewed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES public.crm_records(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.crm_modules(id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  view_count INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_recently_viewed_user_record
  ON public.crm_recently_viewed (user_id, record_id);

CREATE INDEX IF NOT EXISTS idx_crm_recently_viewed_user_time
  ON public.crm_recently_viewed (user_id, last_viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_recently_viewed_user_module_time
  ON public.crm_recently_viewed (user_id, module_id, last_viewed_at DESC);

ALTER TABLE public.crm_recently_viewed ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY crm_recently_viewed_select_own
    ON public.crm_recently_viewed FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_recently_viewed_insert_own
    ON public.crm_recently_viewed FOR INSERT
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_recently_viewed_update_own
    ON public.crm_recently_viewed FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_recently_viewed_delete_own
    ON public.crm_recently_viewed FOR DELETE
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
