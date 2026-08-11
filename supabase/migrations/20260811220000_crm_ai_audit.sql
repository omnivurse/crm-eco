-- ============================================================================
-- CRM AI audit — metadata only (no prompt bodies, no PHI payloads).
-- Rollback: DROP TABLE IF EXISTS public.crm_ai_audit;
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_ai_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  actor_id uuid NULL,
  record_id uuid NULL,
  purpose text NOT NULL,
  model text NULL,
  tokens integer NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'llm',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_ai_audit_org_created
  ON public.crm_ai_audit (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_ai_audit_org_purpose_day
  ON public.crm_ai_audit (org_id, purpose, created_at DESC);

ALTER TABLE public.crm_ai_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_ai_audit_select_org ON public.crm_ai_audit;
CREATE POLICY crm_ai_audit_select_org ON public.crm_ai_audit
  FOR SELECT TO authenticated
  USING (
    org_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.crm_role IN ('crm_admin', 'crm_manager')
    )
  );

DROP POLICY IF EXISTS crm_ai_audit_insert_org ON public.crm_ai_audit;
CREATE POLICY crm_ai_audit_insert_org ON public.crm_ai_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

GRANT SELECT, INSERT ON public.crm_ai_audit TO authenticated;
GRANT ALL ON public.crm_ai_audit TO service_role;
