-- CRM habit-learning signal log (Phase 1).
-- Append-only per-user events for module visits / view selection / NBA feedback.
-- Aggregated nightly into profiles.ui_preferences.habits (no LLM required).
-- Retention: 90 days (purged by /api/cron/habits-aggregate).

CREATE TABLE IF NOT EXISTS public.crm_user_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  module_key TEXT NULL,
  entity_id UUID NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_user_signals_type_check CHECK (
    signal_type = ANY (ARRAY[
      'module_visit',
      'view_selected',
      'record_opened',
      'search_query',
      'nba_accepted',
      'nba_dismissed'
    ])
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_user_signals_user_created
  ON public.crm_user_signals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_user_signals_org_created
  ON public.crm_user_signals (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_user_signals_user_type_created
  ON public.crm_user_signals (user_id, signal_type, created_at DESC);

ALTER TABLE public.crm_user_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY crm_user_signals_select_own
    ON public.crm_user_signals FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_user_signals_insert_own
    ON public.crm_user_signals FOR INSERT
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No UPDATE/DELETE for end users — cron uses service role for retention purge.

COMMENT ON TABLE public.crm_user_signals IS
  'Lightweight CRM UX habit signals. Aggregated into profiles.ui_preferences.habits; never send raw rows to LLMs.';
