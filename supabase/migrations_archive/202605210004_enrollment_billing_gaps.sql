-- ============================================================================
-- Migration: 202605210004_enrollment_billing_gaps
-- Purpose:   Add missing schema for enrollment/billing/commissions upgrade
--            (legal_documents, agreement_signatures, inactive_reasons,
--             price_change_schedules, price_change_audit, payment_webhooks)
--            + additive ALTERs on enrollments, billing_schedules, enrollment_dependents
-- Guardrail: 100% additive — no DROP, no destructive ALTER
-- ============================================================================

BEGIN;

-- ── 1. inactive_reasons (GLOBAL lookup — not org-scoped) ────────────────────

CREATE TABLE IF NOT EXISTS inactive_reasons (
  code        text PRIMARY KEY,
  description text NOT NULL,
  category    text CHECK (category IN ('plan_change','cancellation','non_payment','admin','age_out','other'))
);

INSERT INTO inactive_reasons (code, description, category) VALUES
  ('plan_change_add_spouse',           'Plan change: adding spouse',              'plan_change'),
  ('plan_change_remove_spouse',        'Plan change: removing spouse',            'plan_change'),
  ('plan_change_add_child',            'Plan change: adding child',               'plan_change'),
  ('plan_change_remove_child',         'Plan change: removing child',             'plan_change'),
  ('plan_change_add_family',           'Plan change: upgrading to family plan',   'plan_change'),
  ('plan_change_to_member_only',       'Plan change: downgrading to member only', 'plan_change'),
  ('plan_change_iua',                  'Plan change: IUA level change',           'plan_change'),
  ('plan_change',                      'Plan change: general',                    'plan_change'),
  ('member_requested_cancellation',    'Member requested cancellation',           'cancellation'),
  ('non_payment',                      'Non-payment / payment failure',           'non_payment'),
  ('age_out',                          'Dependent aged out of coverage',          'age_out'),
  ('admin_cancellation',               'Administrative cancellation',             'admin'),
  ('expired_payment_method',           'Expired payment method',                  'non_payment')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE inactive_reasons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inactive_reasons' AND policyname = 'inactive_reasons_read_all'
  ) THEN
    CREATE POLICY inactive_reasons_read_all ON inactive_reasons
      FOR SELECT USING (true);
  END IF;
END $$;

-- ── 2. legal_documents ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type    text NOT NULL,
  document_name    text NOT NULL,
  product_id       uuid REFERENCES plans(id) ON DELETE SET NULL,
  content_html     text NOT NULL,
  version          int NOT NULL DEFAULT 1,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  effective_date   date,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_org ON legal_documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_status ON legal_documents (status) WHERE status = 'active';

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'legal_documents' AND policyname = 'legal_documents_select'
  ) THEN
    CREATE POLICY legal_documents_select ON legal_documents
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'legal_documents' AND policyname = 'legal_documents_insert'
  ) THEN
    CREATE POLICY legal_documents_insert ON legal_documents
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'super_admin', 'admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'legal_documents' AND policyname = 'legal_documents_update'
  ) THEN
    CREATE POLICY legal_documents_update ON legal_documents
      FOR UPDATE USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'super_admin', 'admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'legal_documents' AND policyname = 'legal_documents_delete'
  ) THEN
    CREATE POLICY legal_documents_delete ON legal_documents
      FOR DELETE USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'super_admin', 'admin')
        )
      );
  END IF;
END $$;

-- ── 3. agreement_signatures ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agreement_signatures (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id     uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  legal_document_id uuid REFERENCES legal_documents(id) ON DELETE SET NULL,
  agreement_type    text NOT NULL,
  signature_png     text,
  signer_name       text NOT NULL,
  signer_ip         inet,
  signer_user_agent text,
  signed_at         timestamptz NOT NULL DEFAULT now(),
  pdf_storage_path  text,
  pdf_generated_at  timestamptz,
  metadata          jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreement_signatures_enrollment ON agreement_signatures (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_agreement_signatures_org ON agreement_signatures (organization_id);

ALTER TABLE agreement_signatures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agreement_signatures' AND policyname = 'agreement_signatures_select'
  ) THEN
    CREATE POLICY agreement_signatures_select ON agreement_signatures
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agreement_signatures' AND policyname = 'agreement_signatures_insert'
  ) THEN
    CREATE POLICY agreement_signatures_insert ON agreement_signatures
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agreement_signatures' AND policyname = 'agreement_signatures_update'
  ) THEN
    CREATE POLICY agreement_signatures_update ON agreement_signatures
      FOR UPDATE USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'super_admin', 'admin')
        )
      );
  END IF;
END $$;

-- ── 4. price_change_schedules ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_change_schedules (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id                   uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  scheduled_date            date NOT NULL,
  status                    text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  old_pricing_snapshot      jsonb,
  new_pricing_snapshot      jsonb,
  affected_enrollments_count int DEFAULT 0,
  processed_count           int DEFAULT 0,
  failed_count              int DEFAULT 0,
  notify_members            boolean DEFAULT true,
  notes                     text,
  created_by                uuid REFERENCES profiles(id) ON DELETE SET NULL,
  executed_by               uuid REFERENCES profiles(id) ON DELETE SET NULL,
  executed_at               timestamptz,
  error_log                 jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_change_schedules_org_date ON price_change_schedules (organization_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_price_change_schedules_status ON price_change_schedules (status) WHERE status = 'pending';

ALTER TABLE price_change_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_change_schedules' AND policyname = 'price_change_schedules_select'
  ) THEN
    CREATE POLICY price_change_schedules_select ON price_change_schedules
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_change_schedules' AND policyname = 'price_change_schedules_modify'
  ) THEN
    CREATE POLICY price_change_schedules_modify ON price_change_schedules
      FOR ALL USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'super_admin', 'admin')
        )
      );
  END IF;
END $$;

-- ── 5. price_change_audit (immutable — INSERT + SELECT only) ────────────────

CREATE TABLE IF NOT EXISTS price_change_audit (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  schedule_id          uuid NOT NULL REFERENCES price_change_schedules(id) ON DELETE RESTRICT,
  enrollment_id        uuid NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  billing_schedule_id  uuid REFERENCES billing_schedules(id) ON DELETE SET NULL,
  old_amount           numeric(10,2),
  new_amount           numeric(10,2),
  change_reason        text,
  applied_at           timestamptz NOT NULL DEFAULT now(),
  notification_sent    boolean DEFAULT false,
  notification_sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_price_change_audit_schedule ON price_change_audit (schedule_id);
CREATE INDEX IF NOT EXISTS idx_price_change_audit_enrollment ON price_change_audit (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_price_change_audit_org ON price_change_audit (organization_id);

ALTER TABLE price_change_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_change_audit' AND policyname = 'price_change_audit_select'
  ) THEN
    CREATE POLICY price_change_audit_select ON price_change_audit
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_change_audit' AND policyname = 'price_change_audit_insert'
  ) THEN
    CREATE POLICY price_change_audit_insert ON price_change_audit
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ── 6. payment_webhooks ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid REFERENCES organizations(id) ON DELETE SET NULL,
  event_id         text UNIQUE NOT NULL,
  event_type       text NOT NULL,
  payload          jsonb NOT NULL,
  signature_valid  boolean NOT NULL,
  processed        boolean NOT NULL DEFAULT false,
  processed_at     timestamptz,
  processing_error text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_processed ON payment_webhooks (processed, created_at) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_event_type ON payment_webhooks (event_type);

ALTER TABLE payment_webhooks ENABLE ROW LEVEL SECURITY;

-- Service-role only (no user-facing access)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_webhooks' AND policyname = 'payment_webhooks_service_only'
  ) THEN
    CREATE POLICY payment_webhooks_service_only ON payment_webhooks
      FOR ALL USING (false);
  END IF;
END $$;

-- ── 7. ALTER enrollment_dependents (add missing columns) ────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollment_dependents' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE enrollment_dependents ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollment_dependents' AND column_name = 'inactive_date'
  ) THEN
    ALTER TABLE enrollment_dependents ADD COLUMN inactive_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollment_dependents' AND column_name = 'inactive_reason'
  ) THEN
    ALTER TABLE enrollment_dependents ADD COLUMN inactive_reason text REFERENCES inactive_reasons(code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollment_dependents' AND column_name = 'custom_fields'
  ) THEN
    ALTER TABLE enrollment_dependents ADD COLUMN custom_fields jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ── 8. ALTER enrollments (add missing columns) ──────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollments' AND column_name = 'inactive_reason'
  ) THEN
    ALTER TABLE enrollments ADD COLUMN inactive_reason text REFERENCES inactive_reasons(code);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollments' AND column_name = 'last_modified_by'
  ) THEN
    ALTER TABLE enrollments ADD COLUMN last_modified_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 9. ALTER billing_schedules (add missing columns) ────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_schedules' AND column_name = 'last_failure_id'
  ) THEN
    ALTER TABLE billing_schedules ADD COLUMN last_failure_id uuid REFERENCES billing_failures(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_schedules' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE billing_schedules ADD COLUMN idempotency_key text UNIQUE;
  END IF;
END $$;

-- ── 10. Unique partial index for billing_failures dedup ─────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS billing_failures_unique_txn
  ON billing_failures (billing_transaction_id)
  WHERE billing_transaction_id IS NOT NULL;

-- ── 11. Notify PostgREST to reload schema ───────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
