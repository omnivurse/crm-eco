-- =============================================================================
-- Migration: 202605220001_member_portal_tables
-- Purpose: Member portal additions — change requests, documents, notifications,
--          service providers, and need attachments. ADDITIVE-ONLY.
--
-- Existing tables we do NOT recreate (per HARD RULE 2 — INTEGRATE, not overwrite):
--   - needs                  (covers member_needs use case)
--   - need_events            (covers need_status_history + need_comments)
--   - tickets                (covers support_tickets)
--   - ticket_comments        (covers support_ticket_messages)
-- =============================================================================

BEGIN;

-- ── 1. member_change_requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  request_type    text NOT NULL CHECK (request_type IN (
    'add_dependent','remove_dependent','upgrade_plan','downgrade_plan',
    'change_iua','change_effective_date','cancel_membership',
    'update_payment_method','other'
  )),
  status          text NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review','approved','rejected','withdrawn','completed'
  )),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_notes  text,
  decided_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_change_requests_org    ON member_change_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_change_requests_member ON member_change_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_member_change_requests_status ON member_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_member_change_requests_created
  ON member_change_requests(created_at DESC);

ALTER TABLE member_change_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_change_requests' AND policyname='mcr_org_select') THEN
    CREATE POLICY mcr_org_select ON member_change_requests
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_change_requests' AND policyname='mcr_member_insert') THEN
    CREATE POLICY mcr_member_insert ON member_change_requests
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_change_requests' AND policyname='mcr_admin_update') THEN
    CREATE POLICY mcr_admin_update ON member_change_requests
      FOR UPDATE USING (
        organization_id IN (
          SELECT om.organization_id FROM organization_members om
          WHERE om.user_id = auth.uid()
            AND om.role IN ('owner','super_admin','admin')
        )
      );
  END IF;
END $$;

-- ── 2. need_attachments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS need_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  need_id         uuid NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  file_name       text NOT NULL,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_need_attachments_need ON need_attachments(need_id);
CREATE INDEX IF NOT EXISTS idx_need_attachments_org  ON need_attachments(organization_id);

ALTER TABLE need_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='need_attachments' AND policyname='need_att_org_all') THEN
    CREATE POLICY need_att_org_all ON need_attachments
      FOR ALL USING (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 3. member_documents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  document_type   text NOT NULL,
  title           text NOT NULL,
  storage_path    text NOT NULL,
  mime_type       text,
  size_bytes      bigint,
  issued_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_documents_org    ON member_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_member ON member_documents(member_id, is_active);

ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_documents' AND policyname='member_docs_org_all') THEN
    CREATE POLICY member_docs_org_all ON member_documents
      FOR ALL USING (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 4. member_notifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title           text NOT NULL,
  body            text,
  category        text CHECK (category IN ('billing','need','plan','system','reminder','message')),
  priority        text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  action_url      text,
  is_read         boolean NOT NULL DEFAULT false,
  read_at         timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_notifications_unread
  ON member_notifications(member_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_notifications_org
  ON member_notifications(organization_id);

ALTER TABLE member_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_notifications' AND policyname='member_notif_org_all') THEN
    CREATE POLICY member_notif_org_all ON member_notifications
      FOR ALL USING (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 5. service_providers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_providers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        text NOT NULL CHECK (category IN (
    'telehealth','care','discount','labs','rx','hospital_debt_relief','other'
  )),
  name            text NOT NULL,
  description     text,
  logo_url        text,
  external_url    text NOT NULL,
  sso_kind        text NOT NULL DEFAULT 'none' CHECK (sso_kind IN ('none','mytelemedicine','custom')),
  sso_config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_filters    jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order      int  NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_providers_org_cat
  ON service_providers(organization_id, category, is_active);

ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_providers' AND policyname='svc_providers_org_select') THEN
    CREATE POLICY svc_providers_org_select ON service_providers
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_providers' AND policyname='svc_providers_admin_write') THEN
    CREATE POLICY svc_providers_admin_write ON service_providers
      FOR ALL USING (
        organization_id IN (
          SELECT om.organization_id FROM organization_members om
          WHERE om.user_id = auth.uid()
            AND om.role IN ('owner','super_admin','admin')
        )
      );
  END IF;
END $$;

-- ── 6. updated_at triggers ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_member_portal()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_mcr_updated_at') THEN
    CREATE TRIGGER trg_mcr_updated_at BEFORE UPDATE ON member_change_requests
      FOR EACH ROW EXECUTE FUNCTION set_updated_at_member_portal();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_member_docs_updated_at') THEN
    CREATE TRIGGER trg_member_docs_updated_at BEFORE UPDATE ON member_documents
      FOR EACH ROW EXECUTE FUNCTION set_updated_at_member_portal();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_svc_providers_updated_at') THEN
    CREATE TRIGGER trg_svc_providers_updated_at BEFORE UPDATE ON service_providers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at_member_portal();
  END IF;
END $$;

-- ── 7. Notify on need status change ─────────────────────────────────────────
-- When a need's status changes, create a member_notification.
CREATE OR REPLACE FUNCTION notify_member_on_need_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_title text;
  v_category text := 'need';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := CASE NEW.status
      WHEN 'in_review'  THEN 'Your need is now under review'
      WHEN 'processing' THEN 'Your need is being processed'
      WHEN 'paid'       THEN 'Sharing has been completed for your need'
      WHEN 'closed'     THEN 'Your need has been closed'
      ELSE 'Update on your need'
    END;

    INSERT INTO member_notifications (
      organization_id, member_id, title, body, category, priority, action_url
    ) VALUES (
      NEW.organization_id,
      NEW.member_id,
      v_title,
      'Status changed from ' || COALESCE(OLD.status, 'new') || ' to ' || NEW.status,
      v_category,
      CASE WHEN NEW.status IN ('paid','in_review') THEN 'high' ELSE 'normal' END,
      '/needs/' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_notify_member_on_need_status') THEN
    CREATE TRIGGER trg_notify_member_on_need_status
      AFTER UPDATE ON needs
      FOR EACH ROW EXECUTE FUNCTION notify_member_on_need_status_change();
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
